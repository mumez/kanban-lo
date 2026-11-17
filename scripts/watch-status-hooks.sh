#!/usr/bin/env bash
# Resident watcher for issues/reviewing and issues/releasing.
# Runs the scripts in hooks/<status>/moved_to/ when an issue file is moved in.
# See hooks/README.md. A second start exits without disturbing the one already running.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lock_file="${KBL_HOOK_WATCHER_LOCK:-$root/hooks/.watcher.lock}"

if ! command -v inotifywait >/dev/null 2>&1; then
  echo "inotifywait is required. Install inotify-tools and run this script again." >&2
  exit 1
fi

mkdir -p "$(dirname "$lock_file")"
exec 9>"$lock_file"
if ! flock -n 9; then
  echo "status hook watcher is already running" >&2
  exit 1
fi

cd "$root/scripts"
# exec keeps this process (and the lock on fd 9) for the life of the watcher.
exec npx tsx src/watchStatusHooks.ts "$@"
