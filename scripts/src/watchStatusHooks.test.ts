import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { renameSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DEBOUNCE_MS, type MovedIssue } from "./statusHooks";
import {
  consumeLines,
  MoveDebouncer,
  startStatusHookWatcher,
  type StatusHookWatcher,
} from "./watchStatusHooks";

const hasInotifywait = spawnSync("which", ["inotifywait"]).status === 0;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (err) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

async function waitForText(filePath: string, timeoutMs: number): Promise<string> {
  const started = Date.now();
  for (;;) {
    const text = await readIfExists(filePath);
    if (text.length > 0) return text;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out after ${timeoutMs}ms waiting for ${filePath}`);
    }
    await delay(20);
  }
}

describe("consumeLines", () => {
  it("keeps a partial trailing line until the newline arrives", () => {
    const first = consumeLines("", "issues/reviewing/one.md\nissues/re");
    expect(first).toEqual({ lines: ["issues/reviewing/one.md"], rest: "issues/re" });
    expect(consumeLines(first.rest, "leasing/two.md\n")).toEqual({
      lines: ["issues/releasing/two.md"],
      rest: "",
    });
  });
});

describe("startStatusHookWatcher", () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
    root = undefined;
  });

  it("throws when a watched status directory is missing", async () => {
    const missing = await mkdtemp(path.join(tmpdir(), "kbl-watch-missing-"));
    root = missing;
    expect(() =>
      startStatusHookWatcher({ issuesDir: missing, hooksDir: missing, cwd: missing }),
    ).toThrow(/does not exist/);
  });

  describe.skipIf(!hasInotifywait)("inotify moved_to", () => {
    let watcher: StatusHookWatcher | undefined;

    afterEach(async () => {
      await watcher?.stop();
      watcher = undefined;
    });

    async function setup(): Promise<{ issuesDir: string; log: string }> {
      root = await mkdtemp(path.join(tmpdir(), "kbl-watch-"));
      const issuesDir = path.join(root, "issues");
      const hooksDir = path.join(root, "hooks");
      await mkdir(path.join(issuesDir, "working"), { recursive: true });
      await mkdir(path.join(issuesDir, "reviewing"), { recursive: true });
      await mkdir(path.join(issuesDir, "releasing"), { recursive: true });
      await mkdir(path.join(issuesDir, "holding"), { recursive: true });
      const log = path.join(root, "log");
      const quotedLog = `'${log.replaceAll("'", "'\\''")}'`;
      await writeHook(path.join(hooksDir, "reviewing", "moved_to", "000_hook.sh"), quotedLog, "reviewing");
      await writeHook(path.join(hooksDir, "working", "moved_to", "000_hook.sh"), quotedLog, "working");
      await writeHook(path.join(hooksDir, "releasing", "moved_to", "000_hook.sh"), quotedLog, "releasing");
      watcher = startStatusHookWatcher({
        issuesDir,
        hooksDir,
        cwd: root,
        debounceMs: 400,
      });
      await watcher.ready;
      return { issuesDir, log };
    }

    it("ignores a file created in the column and runs hooks after a move settles", async () => {
      const { issuesDir, log } = await setup();
      await writeFile(path.join(issuesDir, "reviewing", "created.md"), "# Created\n");
      await delay(600);
      expect(await readIfExists(log)).toBe("");

      await writeFile(path.join(issuesDir, "holding", "1-moved.md"), "# Moved\n");
      renameSync(path.join(issuesDir, "holding", "1-moved.md"), path.join(issuesDir, "reviewing", "1-moved.md"));

      await delay(150);
      expect(await readIfExists(log)).toBe("");
      const text = await waitForText(log, 3000);
      expect(text).toBe(`reviewing ${path.join(issuesDir, "reviewing", "1-moved.md")}\n`);
    });

    it("runs working hooks when an issue moves into working", async () => {
      const { issuesDir, log } = await setup();
      await writeFile(path.join(issuesDir, "holding", "4-start.md"), "# Start\n");
      renameSync(path.join(issuesDir, "holding", "4-start.md"), path.join(issuesDir, "working", "4-start.md"));

      const text = await waitForText(log, 3000);
      expect(text).toBe(`working ${path.join(issuesDir, "working", "4-start.md")}\n`);
    });

    it("runs only the column an issue is still in when it moves again inside the window", async () => {
      const { issuesDir, log } = await setup();
      const file = "2-pass.md";
      await writeFile(path.join(issuesDir, "holding", file), "# Pass\n");
      renameSync(path.join(issuesDir, "holding", file), path.join(issuesDir, "reviewing", file));
      await delay(100);
      renameSync(path.join(issuesDir, "reviewing", file), path.join(issuesDir, "releasing", file));

      const text = await waitForText(log, 3000);
      await delay(500);
      expect(await readFile(log, "utf8")).toBe(text);
      expect(text).toBe(`releasing ${path.join(issuesDir, "releasing", file)}\n`);
    });
  });
});

async function writeHook(hookPath: string, quotedLog: string, label: string): Promise<void> {
  await mkdir(path.dirname(hookPath), { recursive: true });
  await writeFile(hookPath, `#!/usr/bin/env bash\nprintf '${label} %s\\n' "$1" >> ${quotedLog}\n`);
}

describe.skipIf(!hasInotifywait)("watch-status-hooks.sh", () => {
  const script = fileURLToPath(new URL("../watch-status-hooks.sh", import.meta.url));
  let root: string | undefined;
  let child: ChildProcess | undefined;

  afterEach(async () => {
    if (child) await stopGroup(child);
    child = undefined;
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("stays resident, refuses a second start, and runs hooks for a moved issue", async () => {
    root = await mkdtemp(path.join(tmpdir(), "kbl-watch-sh-"));
    const issuesDir = path.join(root, "issues");
    const hooksDir = path.join(root, "hooks");
    const log = path.join(root, "log");
    const lock = path.join(root, "watcher.lock");
    await mkdir(path.join(issuesDir, "working"), { recursive: true });
    await mkdir(path.join(issuesDir, "reviewing"), { recursive: true });
    await mkdir(path.join(issuesDir, "releasing"), { recursive: true });
    await mkdir(path.join(issuesDir, "holding"), { recursive: true });
    const quotedLog = `'${log.replaceAll("'", "'\\''")}'`;
    await writeHook(path.join(hooksDir, "reviewing", "moved_to", "000_hook.sh"), quotedLog, "reviewing");

    const stdout: string[] = [];
    child = spawn(
      script,
      ["--issues-dir", issuesDir, "--hooks-dir", hooksDir, "--debounce-ms", "400"],
      {
        detached: true,
        env: { ...process.env, KBL_HOOK_WATCHER_LOCK: lock },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout?.on("data", (chunk: Buffer) => stdout.push(chunk.toString("utf8")));
    child.stderr?.on("data", (chunk: Buffer) => stdout.push(chunk.toString("utf8")));

    await waitForOutput(stdout, "debounce 400ms", 15000);

    const second = spawnSync(script, ["--issues-dir", issuesDir, "--hooks-dir", hooksDir], {
      env: { ...process.env, KBL_HOOK_WATCHER_LOCK: lock },
      encoding: "utf8",
    });
    expect(second.status).toBe(1);
    expect(second.stderr).toContain("status hook watcher is already running");

    await writeFile(path.join(issuesDir, "holding", "3-shell.md"), "# Shell\n");
    renameSync(path.join(issuesDir, "holding", "3-shell.md"), path.join(issuesDir, "reviewing", "3-shell.md"));
    expect(await waitForText(log, 5000)).toBe(`reviewing ${path.join(issuesDir, "reviewing", "3-shell.md")}\n`);
  }, 20000);
});

describe("MoveDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function moved(status: MovedIssue["status"], issueId: string): MovedIssue {
    return {
      filePath: `/issues/${status}/${issueId}.md`,
      status,
      issueId,
    };
  }

  it("waits out the window and runs once for duplicate moves of the same issue", async () => {
    const runs: MovedIssue[] = [];
    const present = new Set<string>();
    const debouncer = new MoveDebouncer({
      debounceMs: DEFAULT_DEBOUNCE_MS,
      fileExists: (filePath) => present.has(filePath),
      run: async (move) => {
        runs.push(move);
      },
    });
    const move = moved("reviewing", "1-a");
    present.add(move.filePath);

    debouncer.notify(move);
    debouncer.notify(move);
    await vi.advanceTimersByTimeAsync(1999);
    expect(runs).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);

    expect(runs).toEqual([move]);
  });

  it("keeps a separate window per issue", async () => {
    const runs: string[] = [];
    const debouncer = new MoveDebouncer({
      debounceMs: 2000,
      fileExists: () => true,
      run: async (move) => {
        runs.push(move.issueId);
      },
    });

    debouncer.notify(moved("reviewing", "a"));
    await vi.advanceTimersByTimeAsync(1500);
    debouncer.notify(moved("releasing", "b"));
    await vi.advanceTimersByTimeAsync(500);
    expect(runs).toEqual(["a"]);
    await vi.advanceTimersByTimeAsync(1500);
    expect(runs).toEqual(["a", "b"]);
  });

  it("runs only the latest column when the same issue moves again inside the window", async () => {
    const runs: MovedIssue[] = [];
    const present = new Set<string>();
    const debouncer = new MoveDebouncer({
      debounceMs: 2000,
      fileExists: (filePath) => present.has(filePath),
      run: async (move) => {
        runs.push(move);
      },
    });
    const reviewing = moved("reviewing", "1-a");
    const releasing = moved("releasing", "1-a");
    // Both paths stay present, so a timer that was not cancelled would still run.
    present.add(reviewing.filePath);
    present.add(releasing.filePath);

    debouncer.notify(reviewing);
    await vi.advanceTimersByTimeAsync(1500);
    debouncer.notify(releasing);
    await vi.advanceTimersByTimeAsync(2000);

    expect(runs).toEqual([releasing]);
  });

  it("does not run hooks when the file has left that column before the window ends", async () => {
    const runs: MovedIssue[] = [];
    const present = new Set<string>();
    const debouncer = new MoveDebouncer({
      debounceMs: 2000,
      fileExists: (filePath) => present.has(filePath),
      run: async (move) => {
        runs.push(move);
      },
    });
    const move = moved("reviewing", "1-a");
    present.add(move.filePath);
    debouncer.notify(move);
    present.delete(move.filePath);

    await vi.advanceTimersByTimeAsync(2000);
    expect(runs).toEqual([]);
  });

  it("logs a hook failure and stays up", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const debouncer = new MoveDebouncer({
      debounceMs: 2000,
      fileExists: () => true,
      run: async () => {
        throw new Error("boom");
      },
    });

    debouncer.notify(moved("reviewing", "1-a"));
    await vi.advanceTimersByTimeAsync(2000);

    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

it("prints the debounce message and no stack when KBL_HOOK_DEBOUNCE_MS is not an integer", () => {
  const result = spawnSync("npx", ["tsx", "src/watchStatusHooks.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, KBL_HOOK_DEBOUNCE_MS: "abc" },
    encoding: "utf8",
    timeout: 15000,
  });

  expect(result.status).toBe(1);
  const output = `${result.stdout}${result.stderr}`;
  expect(output).toContain("KBL_HOOK_DEBOUNCE_MS must be a non-negative integer, got abc");
  expect(output).not.toMatch(/\n\s+at /);
}, 20000);

function waitForOutput(chunks: string[], needle: string, timeoutMs: number): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (chunks.join("").includes(needle)) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for ${needle}. output:\n${chunks.join("")}`));
      }
    }, 20);
  });
}

function stopGroup(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const killer = setTimeout(() => {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    }, 2000);
    child.once("close", () => {
      clearTimeout(killer);
      resolve();
    });
    if (child.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
        return;
      } catch {
        // Fall through to signalling the child directly.
      }
    }
    child.kill("SIGTERM");
  });
}
