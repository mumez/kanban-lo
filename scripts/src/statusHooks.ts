import { spawn } from "node:child_process";
import { accessSync, constants, readdirSync, statSync, type Dirent } from "node:fs";
import path from "node:path";

/**
 * Columns whose incoming moves run user hooks. Other columns stay quiet:
 * a move into `todo` or `done` is not an event anyone registered for.
 */
export const HOOK_STATUSES = ["reviewing", "releasing"] as const;
export type HookStatus = (typeof HOOK_STATUSES)[number];

/** How long a move must sit still before its hooks run. The board's drag-and-drop MOVEs the file and then writes `_order.json`; two seconds lets that settle, and lets a card that only passes through a column leave before hooks fire. */
export const DEFAULT_DEBOUNCE_MS = 2000;

export interface MovedIssue {
  /** Absolute path of the issue file in the column it moved into. */
  filePath: string;
  status: HookStatus;
  /** Filename without `.md`. Same issue keeps one debounce window across columns. */
  issueId: string;
}

const IGNORED_HOOK_SUFFIXES = [".example", ".sample", ".disabled", ".md", ".txt", ".bak"];

function isHookStatus(value: string): value is HookStatus {
  return (HOOK_STATUSES as readonly string[]).includes(value);
}

function isNodeError(err: unknown, code: string): boolean {
  return err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === code;
}

/**
 * Interpret an inotify `moved_to` path. The status is the parent directory
 * name, so `issues/reviewing/123-slug.md` is a reviewing move. Anything that
 * is not an issue markdown file directly inside a hooked column is ignored.
 */
export function parseMovedTo(filePath: string, issuesDir: string): MovedIssue | null {
  const relative = path.relative(path.resolve(issuesDir), path.resolve(filePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

  const parts = relative.split(path.sep);
  if (parts.length !== 2) return null;
  const [status, name] = parts;
  if (!isHookStatus(status)) return null;
  if (!name.endsWith(".md") || name.startsWith(".")) return null;

  const issueId = name.slice(0, -".md".length);
  if (issueId.length === 0) return null;

  return { filePath: path.resolve(filePath), status, issueId };
}

function isExecutable(filePath: string): boolean {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function isHookFile(entry: Dirent, fullPath: string): boolean {
  if (entry.isFile()) return true;
  if (!entry.isSymbolicLink()) return false;
  try {
    return statSync(fullPath).isFile();
  } catch {
    return false;
  }
}

function isIgnoredHookName(name: string): boolean {
  if (name.startsWith(".") || name.endsWith("~")) return true;
  return IGNORED_HOOK_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

/**
 * Hook scripts in one `moved_to` directory, in filename order (byte order,
 * so `000_`, `010_`, `020_` run in the order the numeric prefix suggests).
 * A hook is a `*.sh` file or any other executable file. Examples, notes, and
 * dotfiles are left alone. A missing directory means the user registered nothing.
 */
export function listHookScripts(movedToDir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(movedToDir, { withFileTypes: true });
  } catch (err) {
    if (isNodeError(err, "ENOENT")) return [];
    throw err;
  }

  const hooks: string[] = [];
  for (const entry of entries) {
    if (isIgnoredHookName(entry.name)) continue;
    const fullPath = path.join(movedToDir, entry.name);
    if (!isHookFile(entry, fullPath)) continue;
    if (entry.name.endsWith(".sh") || isExecutable(fullPath)) hooks.push(fullPath);
  }

  hooks.sort((left, right) => {
    const leftName = path.basename(left);
    const rightName = path.basename(right);
    if (leftName < rightName) return -1;
    if (leftName > rightName) return 1;
    return 0;
  });
  return hooks;
}

export interface HookRunResult {
  hookPath: string;
  exitCode: number;
}

export interface RunStatusHooksOptions {
  hooksDir: string;
  cwd: string;
  move: MovedIssue;
}

/**
 * Run `hooks/<status>/moved_to/` for one settled move. Scripts are read at
 * call time, so adding or removing a hook does not require a watcher restart.
 * One failure does not skip the rest: a later hook still runs, and the
 * failure is logged.
 *
 * Each hook receives the issue path and status as `$1` and `$2`, and the
 * same values as `KBL_FILE_PATH`, `KBL_STATUS`, and `KBL_BODY`
 * (`{"file_path","status"}`). A `*.sh` file that is not executable is run
 * with bash; anything executable is executed directly so its shebang works.
 */
export async function runStatusHooks(options: RunStatusHooksOptions): Promise<HookRunResult[]> {
  const { move } = options;
  const movedToDir = path.join(options.hooksDir, move.status, "moved_to");
  const hooks = listHookScripts(movedToDir);
  const base = path.basename(move.filePath);
  if (hooks.length === 0) {
    console.log(`[status-hooks] ${move.status} ${base} (no hooks)`);
    return [];
  }

  console.log(`[status-hooks] ${move.status} ${base} -> ${hooks.length} hook(s)`);
  const body = JSON.stringify({ file_path: move.filePath, status: move.status });
  const results: HookRunResult[] = [];
  for (const hookPath of hooks) {
    const result = await runHook(hookPath, move, options.cwd, body);
    results.push(result);
    if (result.exitCode !== 0) {
      console.error(`[status-hooks] hook exited ${result.exitCode}: ${hookPath}`);
    }
  }
  return results;
}

function runHook(hookPath: string, move: MovedIssue, cwd: string, body: string): Promise<HookRunResult> {
  const executable = isExecutable(hookPath);
  const command = executable ? hookPath : "bash";
  const args = executable ? [move.filePath, move.status] : [hookPath, move.filePath, move.status];

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        KBL_FILE_PATH: move.filePath,
        KBL_STATUS: move.status,
        KBL_BODY: body,
      },
      stdio: ["ignore", "inherit", "inherit"],
    });
    // `error` (spawn failed) and `close` can both fire; the first one wins.
    let settled = false;
    const finish = (exitCode: number) => {
      if (settled) return;
      settled = true;
      resolve({ hookPath, exitCode });
    };
    child.once("error", (err) => {
      console.error(`[status-hooks] could not run ${hookPath}: ${err.message}`);
      finish(1);
    });
    child.once("close", (code) => {
      finish(code ?? 1);
    });
  });
}
