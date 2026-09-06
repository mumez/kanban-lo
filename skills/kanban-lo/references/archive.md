# Archiving issues (kanban-lo)

Less-frequently-used commands for archiving issues out of the board and restoring them. Follow
this link from the main [SKILL.md](../SKILL.md) only when the user's request involves archiving,
unarchiving, or listing archived issues.

Archiving moves an issue's file to `_archive/`, outside the four kanban columns, so it no longer
shows up in `list-issues` for any column. Unarchiving moves it back into a column.

## Archive an issue — `archive-issue`

```
cd $KBL_HOME
mise run archive-issue -- --id <id>
```

| Flag | Required |
|---|---|
| `--id` | yes |

Output: `Archived <id>`. Exits non-zero with `Issue not found: <id>` on stderr if the id doesn't
exist in any column.

## Restore an archived issue — `unarchive-issue`

```
cd $KBL_HOME
mise run unarchive-issue -- --id <id> [--status <column>]
```

| Flag | Required | Default | Notes |
|---|---|---|---|
| `--id` | yes | — | |
| `--status` | no | `todo` | one of `todo`, `working`, `done`, `pending`; column to restore into |

Output: the restored issue's full content as JSON (subject, content, project, status). Exits
non-zero with `Archived issue not found: <id>` on stderr if the id isn't currently archived.

## List archived issues — `list-archives`

```
cd $KBL_HOME
mise run list-archives
```

No flags. Output: one line per archived issue, `<id>\t<subject> [<project>]` (project omitted if
unset). If empty: `No archived issues.`

## Intent → command examples

- "kanbanのexample-issueをアーカイブして" (archive example-issue on kanban)
  → `mise run archive-issue -- --id "example-issue"`

- "kanbanでアーカイブしたexample-issueをtodoに戻して" (restore archived example-issue on
  kanban back to todo)
  → `mise run unarchive-issue -- --id "example-issue" --status todo`

- "kanbanのアーカイブ一覧見せて" (show the archive list on kanban)
  → `mise run list-archives`

## Don't

- Don't run `mise run <task> <flags>` without the `--` separator — same pitfall as the other
  commands; `mise` silently drops the flags.
- Don't guess or fabricate an issue id for `archive-issue`/`unarchive-issue` — get it from a
  prior `list-issues`/`list-archives`/`fetch-issue` output or ask the user.
- Don't assume `unarchive-issue` defaults `--status` to anything other than `todo` unless the
  user specifies a column.
- Don't treat a non-zero exit as success or swallow the stderr text — always surface it to the
  user, same as the other commands.
