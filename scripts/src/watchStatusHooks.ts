import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
  DEFAULT_DEBOUNCE_MS,
  HOOK_STATUSES,
  MoveDebouncer,
  parseMovedTo,
  runStatusHooks,
} from "./statusHooks";

/** Split a stdout chunk into complete lines, keeping a trailing partial line. */
export function consumeLines(buffered: string, chunk: string): { lines: string[]; rest: string } {
  const parts = (buffered + chunk).split("\n");
  const rest = parts.pop() ?? "";
  return { lines: parts, rest };
}

export function repoRootFromHere(importMetaUrl: string): string {
  // scripts/src/<this file> → repository root
  return path.resolve(path.dirname(fileURLToPath(importMetaUrl)), "../..");
}

function fileIsPresent(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function parseDebounce(raw: string, label: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${label} must be a non-negative integer, got ${raw}`);
  }
  return Number(raw);
}

function debounceFromEnv(): number {
  const raw = process.env.KBL_HOOK_DEBOUNCE_MS;
  if (raw === undefined || raw === "") return DEFAULT_DEBOUNCE_MS;
  return parseDebounce(raw, "KBL_HOOK_DEBOUNCE_MS");
}

export interface StatusHookWatcher {
  /** Resolves once inotifywait is listening. Rejects if it exits first. */
  ready: Promise<void>;
  /** Resolves when inotifywait exits, including after `stop`. */
  exited: Promise<number | null>;
  stop: () => Promise<void>;
}

/**
 * Watch `issues/reviewing` and `issues/releasing` for inotify `moved_to`
 * (a rename into the directory — not a create, and not an in-place edit)
 * and run that column's hooks after the debounce window.
 */
export function startStatusHookWatcher(options: {
  issuesDir: string;
  hooksDir: string;
  cwd: string;
  debounceMs?: number;
}): StatusHookWatcher {
  const issuesDir = path.resolve(options.issuesDir);
  const hooksDir = path.resolve(options.hooksDir);
  const debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  const statusDirs = HOOK_STATUSES.map((status) => path.join(issuesDir, status));
  for (const dir of statusDirs) {
    if (!existsSync(dir)) {
      throw new Error(`status directory does not exist: ${dir}`);
    }
  }

  const debouncer = new MoveDebouncer({
    debounceMs,
    fileExists: fileIsPresent,
    run: async (move) => {
      await runStatusHooks({ hooksDir, cwd: options.cwd, move });
    },
  });

  const child = spawn("inotifywait", ["-m", "-e", "moved_to", "--format", "%w%f", ...statusDirs], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let settled = false;
  let resolveReady: () => void = () => {};
  let rejectReady: (err: Error) => void = () => {};
  let resolveExited: (code: number | null) => void = () => {};
  const readyTimeout = setTimeout(() => {
    rejectReady(new Error("inotifywait did not establish watches"));
  }, 5000);
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = () => {
      if (settled) return;
      settled = true;
      clearTimeout(readyTimeout);
      resolve();
    };
    rejectReady = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(readyTimeout);
      reject(err);
    };
  });
  const exited = new Promise<number | null>((resolve) => {
    resolveExited = resolve;
  });

  if (!child.stdout || !child.stderr) {
    rejectReady(new Error("inotifywait stdio was not piped"));
    resolveExited(null);
    return { ready, exited, stop: async () => stopChild(child) };
  }

  let buffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    const consumed = consumeLines(buffer, chunk.toString("utf8"));
    buffer = consumed.rest;
    for (const line of consumed.lines) {
      if (line.length === 0) continue;
      const move = parseMovedTo(line, issuesDir);
      if (move) debouncer.notify(move);
    }
  });

  let stderr = "";
  child.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf8");
    process.stderr.write(text);
    if (settled) return;
    stderr += text;
    if (stderr.includes("Watches established.")) resolveReady();
  });

  child.once("error", (err) => {
    const message = err instanceof Error ? err.message : String(err);
    rejectReady(new Error(`inotifywait failed to start: ${message}`));
  });
  child.once("close", (code, signal) => {
    resolveExited(code);
    const detail = stderr.trim();
    rejectReady(
      new Error(
        `inotifywait exited (${signal ?? code}) before watches were established${detail ? `: ${detail}` : ""}`,
      ),
    );
  });

  return {
    ready,
    exited,
    stop: async () => {
      clearTimeout(readyTimeout);
      debouncer.cancelAll();
      await stopChild(child);
    },
  };
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const killer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, 1000);
    child.once("close", () => {
      clearTimeout(killer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

async function main(): Promise<void> {
  const repoRoot = repoRootFromHere(import.meta.url);
  const program = new Command();
  program
    .name("watch-status-hooks")
    .description("Watch issues/reviewing and issues/releasing and run hooks when an issue file is moved in")
    .option("--issues-dir <path>", "issues directory", path.join(repoRoot, "issues"))
    .option("--hooks-dir <path>", "hooks directory", path.join(repoRoot, "hooks"))
    .option(
      "--debounce-ms <ms>",
      "milliseconds to wait after the last move of an issue before running hooks",
      (value: string) => parseDebounce(value, "--debounce-ms"),
      debounceFromEnv(),
    );

  program.parse(process.argv);
  const opts = program.opts<{ issuesDir: string; hooksDir: string; debounceMs: number }>();

  let watcher: StatusHookWatcher;
  try {
    watcher = startStatusHookWatcher({
      issuesDir: opts.issuesDir,
      hooksDir: opts.hooksDir,
      cwd: repoRoot,
      debounceMs: opts.debounceMs,
    });
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  try {
    await watcher.ready;
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    await watcher.stop();
    process.exit(1);
  }

  const statusDirs = HOOK_STATUSES.map((status) => path.resolve(opts.issuesDir, status));
  console.log(`[status-hooks] watching ${statusDirs.join(" ")} (debounce ${opts.debounceMs}ms)`);

  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void watcher.stop().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const code = await watcher.exited;
  if (stopping) return;
  console.error(`[status-hooks] inotifywait exited (${code ?? "unknown"})`);
  process.exit(code === 0 ? 0 : 1);
}

function isExecutedDirectly(): boolean {
  const self = fileURLToPath(import.meta.url);
  // tsx sometimes leaves the script path in argv[1], sometimes further along.
  return process.argv.some((arg) => arg.length > 0 && path.resolve(arg) === self);
}

if (isExecutedDirectly()) {
  void main();
}
