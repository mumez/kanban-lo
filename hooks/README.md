# Status hooks

Optional scripts that run when an issue file is **moved into** `issues/working`, `issues/reviewing`, or `issues/releasing`. Creating a file in the column, editing it in place, reordering cards inside the column, or moving a file out does not run hooks.

The directories that ship here contain examples only. Nothing runs until you add a script.

## Register a hook

Copy the example, or add any other file, under the column you care about:

```
hooks/working/moved_to/000_hook.sh
hooks/reviewing/moved_to/000_hook.sh
hooks/releasing/moved_to/010_notify.sh
```

Files run in filename order (`000` before `010` before `020`). The order is byte order, so pad numbers with zeros. A hook is either a `*.sh` file (run with bash when it is not executable) or any other executable file (run directly, so a shebang works). Dotfiles, `*.example`, `*.md`, and `*.txt` are skipped.

Hooks are read when a move settles. Adding or removing a script does not require a restart.

One hook exiting non-zero does not skip the later ones. The watcher logs the exit code and continues.

## What a hook receives

| | |
|---|---|
| `$1` / `KBL_FILE_PATH` | Absolute path of the issue file |
| `$2` / `KBL_STATUS` | `working`, `reviewing`, or `releasing` |
| `KBL_BODY` | JSON: `{"file_path":"...","status":"reviewing"}` |

The working directory is the repository root. Stdin is empty, so a script that reads it reaches end-of-file immediately.

## Debounce

The watcher waits **2 seconds** after the last move of an issue before it runs hooks. Each issue has its own window.

That wait matches the Web UI. A drag-and-drop MOVEs the markdown file and then writes `issues/<column>/_order.json`. Hooks that read the file or the column order see the settled result.

If the same issue moves again inside the window (for example from `reviewing` into `releasing`), the earlier column is forgotten. Hooks run only for the column the file is still in when the window ends. A card that passes through `reviewing` and lands in `releasing` within 2 seconds runs the releasing hooks only. A card that leaves for `done`, `todo`, or `pending` before the window ends runs nothing.

Override the wait with `--debounce-ms <milliseconds>` or `KBL_HOOK_DEBOUNCE_MS`.

## Run the watcher

Run it once, on the Linux machine whose disk holds `issues/`, and leave it running. WebDAV moves from the UI or from `kbl` show up as renames on that disk. `inotifywait` (`inotify-tools`) has to be installed.

```bash
# from the repository root
mise run watch-status-hooks

# or
scripts/watch-status-hooks.sh
```

A second start exits with `status hook watcher is already running` and does not start another copy. Stop the running one with Ctrl-C (or SIGTERM).

`kbl` does not start this process and does not run hooks by itself.
