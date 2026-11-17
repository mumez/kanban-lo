import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_DEBOUNCE_MS,
  MoveDebouncer,
  listHookScripts,
  parseMovedTo,
  runStatusHooks,
  type MovedIssue,
} from "./statusHooks";

function moved(status: MovedIssue["status"], issueId: string): MovedIssue {
  return {
    filePath: `/issues/${status}/${issueId}.md`,
    status,
    issueId,
  };
}

describe("parseMovedTo", () => {
  const issuesDir = "/repo/issues";

  it("reads reviewing and releasing from the directory the file moved into", () => {
    expect(parseMovedTo("/repo/issues/reviewing/1753600000000-example.md", issuesDir)).toEqual({
      filePath: "/repo/issues/reviewing/1753600000000-example.md",
      status: "reviewing",
      issueId: "1753600000000-example",
    });
    expect(parseMovedTo("/repo/issues/releasing/9-ship-it.md", issuesDir)).toEqual({
      filePath: "/repo/issues/releasing/9-ship-it.md",
      status: "releasing",
      issueId: "9-ship-it",
    });
  });

  it("ignores other columns, non-markdown files, and nested paths", () => {
    expect(parseMovedTo("/repo/issues/todo/1-a.md", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/working/1-a.md", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/done/1-a.md", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/pending/1-a.md", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/reviewing/_order.json", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/reviewing/.gitkeep", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/reviewing/.hidden.md", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/reviewing/nested/1-a.md", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues-other/reviewing/1-a.md", issuesDir)).toBeNull();
    expect(parseMovedTo("/repo/issues/reviewing/../todo/1-a.md", issuesDir)).toBeNull();
  });
});

describe("listHookScripts", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "kbl-hooks-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns an empty list when the directory is missing", () => {
    expect(listHookScripts(path.join(root, "missing"))).toEqual([]);
  });

  it("lists .sh files and other executables in filename order, skipping notes and examples", async () => {
    const dir = path.join(root, "moved_to");
    await mkdir(dir);
    await writeFile(path.join(dir, "010_second.sh"), "echo second\n");
    await writeFile(path.join(dir, "000_first.sh"), "echo first\n");
    await writeFile(path.join(dir, "2_two.sh"), "echo two\n");
    await writeFile(path.join(dir, "10_ten.sh"), "echo ten\n");
    await writeFile(path.join(dir, "015_tool"), "#!/bin/sh\necho tool\n");
    await chmod(path.join(dir, "015_tool"), 0o755);
    await writeFile(path.join(dir, "030_note"), "not a hook\n");
    await writeFile(path.join(dir, "000_hook.sh.example"), "echo example\n");
    await writeFile(path.join(dir, "README.md"), "docs\n");
    await writeFile(path.join(dir, ".gitkeep"), "");
    await mkdir(path.join(dir, "040_dir.sh"));

    expect(listHookScripts(dir).map((hook) => path.basename(hook))).toEqual([
      "000_first.sh",
      "010_second.sh",
      "015_tool",
      "10_ten.sh",
      "2_two.sh",
    ]);
  });
});

describe("runStatusHooks", () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "kbl-run-hooks-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("runs hooks in filename order with the file path, status, and JSON body", async () => {
    const dir = path.join(root, "hooks", "reviewing", "moved_to");
    await mkdir(dir, { recursive: true });
    const log = path.join(root, "log");
    const quotedLog = `'${log.replaceAll("'", "'\\''")}'`;
    await writeFile(
      path.join(dir, "010_second.sh"),
      `printf 'second %s %s %s\\n' "$1" "$2" "$KBL_BODY" >> ${quotedLog}\n`,
    );
    await writeFile(
      path.join(dir, "000_first.sh"),
      `printf 'first %s %s %s\\n' "$1" "$2" "$KBL_STATUS" >> ${quotedLog}\n`,
    );
    await writeFile(path.join(dir, "000_hook.sh.example"), `printf 'example\\n' >> ${quotedLog}\n`);

    const move = moved("reviewing", "1753600000000-example");
    const results = await runStatusHooks({ hooksDir: path.join(root, "hooks"), cwd: root, move });

    expect(results.map((result) => result.exitCode)).toEqual([0, 0]);
    const lines = (await readFile(log, "utf8")).trim().split("\n");
    expect(lines[0]).toBe(`first ${move.filePath} reviewing reviewing`);
    expect(JSON.parse(lines[1].slice("second /issues/reviewing/1753600000000-example.md reviewing ".length))).toEqual({
      file_path: move.filePath,
      status: "reviewing",
    });
  });

  it("runs an executable whose name does not end in .sh", async () => {
    const dir = path.join(root, "hooks", "releasing", "moved_to");
    await mkdir(dir, { recursive: true });
    const log = path.join(root, "log");
    const quotedLog = `'${log.replaceAll("'", "'\\''")}'`;
    const hook = path.join(dir, "000_notify");
    await writeFile(hook, `#!/usr/bin/env bash\nprintf 'notify %s\\n' "$2" >> ${quotedLog}\n`);
    await chmod(hook, 0o755);

    const move = moved("releasing", "9-ship");
    await runStatusHooks({ hooksDir: path.join(root, "hooks"), cwd: root, move });

    expect(await readFile(log, "utf8")).toBe("notify releasing\n");
  });

  it("continues with the next hook when one exits non-zero", async () => {
    const dir = path.join(root, "hooks", "reviewing", "moved_to");
    await mkdir(dir, { recursive: true });
    const log = path.join(root, "log");
    const quotedLog = `'${log.replaceAll("'", "'\\''")}'`;
    await writeFile(path.join(dir, "000_fail.sh"), "exit 3\n");
    await writeFile(path.join(dir, "010_ok.sh"), `printf 'ok\\n' >> ${quotedLog}\n`);

    const results = await runStatusHooks({
      hooksDir: path.join(root, "hooks"),
      cwd: root,
      move: moved("reviewing", "1-a"),
    });

    expect(results.map((result) => result.exitCode)).toEqual([3, 0]);
    expect(await readFile(log, "utf8")).toBe("ok\n");
  });

  it("does nothing when the status has no hooks directory", async () => {
    const results = await runStatusHooks({
      hooksDir: path.join(root, "hooks"),
      cwd: root,
      move: moved("releasing", "1-a"),
    });
    expect(results).toEqual([]);
  });
});

describe("MoveDebouncer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a two second window", () => {
    expect(DEFAULT_DEBOUNCE_MS).toBe(2000);
  });

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
