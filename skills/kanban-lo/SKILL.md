---
name: kanban-lo
description: Operate a Kanban-lo board (list, fetch, create, change, archive, and unarchive issues; set an issue's project, PR URL, or session id; and look up admin-maintained projects) via the `kbl` CLI, run through `mise run` from $KBL_HOME. Use when the user asks to list/view/create/update/archive issues "on kanban", "on the kanban board", "on kanban-lo", or "with kbl", or needs to know which projects exist before filing a new issue.
---

# kanban-lo

Drives the `kbl` admin CLI for [Kanban-lo](https://github.com/mumez/kanban-lo) — a WebDAV-backed
issue board with columns `todo`, `working`, `reviewing`, `releasing`, `done`, `pending`. `releasing` sits between `reviewing` and `done` and is shown by default. Any column may be hidden in the Web UI via `issues/_settings.json` (`hiddenStatuses`); `kbl` still accepts every status.

## Prerequisites

- `$KBL_HOME` must be set and point at a local kanban-lo checkout (the one containing
  `mise.toml` and `scripts/`).
- `KBL_DAV_BASE` must be set (or pass `--dav-base <url>` per command) to point at a reachable
  WebDAV server. Defaults to `http://localhost:8282/dav` if unset.
- Always `cd $KBL_HOME` before running `mise run` — the tasks are defined relative to that
  directory.
- Always put `--` between the task name and its flags: `mise run <task> -- <flags>`. Without it,
  `mise` will not forward the flags to the underlying `kbl` command.
- If you haven't confirmed `$KBL_HOME`/`KBL_DAV_BASE` are set in this session, run `echo
  "$KBL_HOME" "$KBL_DAV_BASE"` once before the first command rather than assuming; if `KBL_HOME`
  is empty, ask the user for the checkout path instead of guessing one.

## Commands

### List issues — `list-issues`

```
cd $KBL_HOME
mise run list-issues -- --status <column> --max <n>
```

| Flag | Required | Default | Notes |
|---|---|---|---|
| `--status` | no | `todo` | one of `todo`, `working`, `reviewing`, `releasing`, `done`, `pending` |
| `--max` | no | `10` | max issues returned |

If the user asks to list issues without naming a column, default `--status` to `todo`.

Output: one line per issue, `<id>\t<subject> [<project>]` (project omitted if unset), most
priority-first — the first line is "the top issue" if the user refers to one that way. If empty:
`No issues in "<status>".`

If it fails: `--status` omitted → CLI exits non-zero asking for `--status`; ask the user which
column, or default to `todo` per the convention above.

### Fetch an issue — `fetch-issue`

```
cd $KBL_HOME
mise run fetch-issue -- --id <id>
```

| Flag | Required |
|---|---|
| `--id` | yes |

Output: the issue's full content as JSON (subject, content, project, status, and `pr` / `sessionId` when set). Exits non-zero
with `Issue not found: <id>` on stderr if the id doesn't exist in any column.

If it fails: `Issue not found` → don't guess or retry with a modified id; run `list-issues`
across the likely columns and ask the user to confirm the correct id.

### Change an issue — `change-issue`

```
cd $KBL_HOME
mise run change-issue -- --id <id> [--status <column>] [--content <text>] [--append-content <text>] [--project <name>] [--pr <url>] [--session-id <id>]
```

| Flag | Required | Notes |
|---|---|---|
| `--id` | yes | |
| `--status` | no | one of `todo`, `working`, `reviewing`, `releasing`, `done`, `pending`; moves the issue to the top of the destination column |
| `--content` | no | replaces the issue's content entirely |
| `--append-content` | no | appends text to the existing content, after a blank line (the CLI adds it — don't add your own) |
| `--project` | no | replaces the issue's `project` frontmatter value |
| `--pr` | no | replaces the issue's `pr` (pull request URL) frontmatter value |
| `--session-id` | no | replaces the issue's `sessionId` (agent session id) frontmatter value |

Flags can be combined in one call (e.g. `--status reviewing --pr <url> --session-id ""`).
At least one flag besides `--id` is required — the CLI exits non-zero with `change-issue
requires at least one of --status, --content, --append-content, --project, --pr, or
--session-id` if none is given.

`--content` and `--append-content` are mutually exclusive, enforced by the CLI
(`change-issue accepts only one of --content or --append-content`) — use one or the other
depending on whether the user wants to replace or add to the issue body.

**Frontmatter (`project`, `pr`, `sessionId`)**: an issue file may start with a YAML frontmatter
block holding these three optional keys. Never edit that block through `--content` or
`--append-content` — those only touch the body below the `# Subject` line. Use the dedicated
flags instead:
- `--project` / `--pr` / `--session-id <value>` sets or replaces that one key. Keys you don't
  pass are kept as they are, and so are the subject and content.
- Pass an empty string (`--pr ""`) to remove a key ("clear the PR", "unassign the session").
- When setting a project name (not when clearing it with `--project ""`), resolve the name with `list-projects` first (see
  [project name matching](#project-name-matching)). The CLI doesn't validate it.
- No need to `fetch-issue` first, even when the user names the old value ("change project from
  xxx to yyy") — just set the new value.
- If one part of a request needs a question (e.g. no matching project), run the parts that
  don't depend on the answer now, report them as done, and ask only about the rest.
- In `fetch-issue` JSON, the real values are the top-level `project` / `pr` / `sessionId`
  fields. YAML-looking text inside `content` is just body text.

Output: the updated issue as JSON (same shape as `fetch-issue`); a removed key is absent.

🔴 **Checkpoint before `--content`** — the only flag that needs confirmation; every other flag
(including the frontmatter ones) runs directly. `--content` discards the issue's existing content entirely.
Before running it, confirm with the user that a full replace (not an append) is what they want —
if there's any ambiguity in the request, prefer `--append-content` or ask first.

If it fails: neither flag given → CLI rejects with the "requires at least one of" message; ask
the user what should change. Both `--content` and `--append-content` given → CLI rejects with
the "accepts only one of" message; pick the one that matches the user's intent (replace vs. add)
instead of retrying with both.

### List projects — `list-projects`

```
cd $KBL_HOME
mise run list-projects
```

No flags. Lists the admin-maintained projects from `issues/_projects.json`.

Output: one project name per line. If empty: `No projects defined.`

There's rarely a reason to call this on its own — its main use is checking which project names
already exist before passing `--project` to `create-issue` or `change-issue`, so the issue lands under an
existing project instead of a name that only differs by typo or casing.

#### Project name matching

Used before passing `--project` to `create-issue` or `change-issue`. Compare the user's name
with each line of `list-projects`, ignoring case and `-`, `_`, and spaces:
- Exactly one match → use the existing name as listed, and tell the user if it differs from what
  they typed (e.g. "used `kanban-lo` for KanbanLo").
- No match or several matches → ask the user before writing. Offer the closest existing names,
  or the new name as typed. A new name works, but it won't appear in the Web UI's project filter
  until an admin adds it to `issues/_projects.json`.

### Create an issue — `create-issue`

```
cd $KBL_HOME
mise run create-issue -- --subject <text> [--content <text>] [--project <name>] [--status <column>]
```

| Flag | Required | Default |
|---|---|---|
| `--subject` | yes | — |
| `--content` | no | `""` |
| `--project` | no | unset |
| `--status` | no | `todo` |

If the user names a project for `--project`, resolve it per
[project name matching](#project-name-matching) first — the CLI doesn't validate `--project`
against the list, so a near-miss silently creates a new, separate project.

If it fails: `--subject` omitted → CLI rejects the command; ask the user for a subject before
retrying, don't invent a placeholder one.

### Archiving — `archive-issue`, `unarchive-issue`, `list-archives`

Rarely used. If the user's request involves archiving, unarchiving, or listing archived issues,
read [references/archive.md](references/archive.md) for the full command details before acting.

## Intent → command examples

- "kanbanから最新10件のissue取って" (fetch the latest 10 issues from kanban)
  → `mise run list-issues -- --status todo --max 10`

- "kanbanにxxxの問題をissueとして登録して" (register problem xxx as an issue on kanban)
  → `mise run create-issue -- --subject "xxx" --content "..."`

- "kanbanのexample-issueに作業内容を書いてworkingにしておいて" (write work notes on
  example-issue and set it to working)
  → `mise run change-issue -- --id "example-issue" --status working --append-content "..."`

- "Set pr URL: https://github.com/org/repo/pull/12 to issue example-issue"
  → `mise run change-issue -- --id "example-issue" --pr "https://github.com/org/repo/pull/12"`

- "Change project of issue example-issue from ProjectA to ProjectB"
  → `mise run list-projects` to confirm the exact name of ProjectB, then
  `mise run change-issue -- --id "example-issue" --project "<confirmed name>"`

- "example-issueのsessionIdを外して" (remove the session id from example-issue)
  → `mise run change-issue -- --id "example-issue" --session-id ""`

- "kanbanにあるexample-issueを参照して、仕様を確認して" (look at example-issue on kanban
  to check the spec)
  → `mise run fetch-issue -- --id "example-issue"`

- "kanbanにこの不具合をissueとして登録して。プロジェクトはたぶんExampleProjectのはず" (register
  this bug as an issue on kanban; the project is probably ExampleProject)
  → `mise run list-projects` to confirm the exact existing name, then
  `mise run create-issue -- --subject "..." --project "<confirmed name>"`

- "kanbanのexample-issueをアーカイブして" (archive example-issue on kanban)
  → read [references/archive.md](references/archive.md), then
  `mise run archive-issue -- --id "example-issue"`

## Errors

The CLI prints the error message to stderr and exits non-zero (via `cli.ts`'s error wrapper);
there is no separate error JSON to parse — treat any non-zero exit as failure and surface the
stderr text.

## Don't

- Don't run `mise run <task> <flags>` without the `--` separator — `mise` silently drops the
  flags instead of forwarding them to `kbl`.
- Don't guess or fabricate an issue id — always get it from a prior `list-issues`/`fetch-issue`
  output or ask the user for it.
- Don't pass both `--content` and `--append-content` to `change-issue` — the CLI rejects it; pick
  one based on whether the user wants to replace or add to the content.
- Don't try to change `project`, `pr`, or `sessionId` by writing YAML into `--content` or
  `--append-content` — use `--project`, `--pr`, or `--session-id`.
- Don't run `change-issue --content` without confirming the user wants a full replace (see the
  checkpoint above) — it silently discards the existing content.
- Don't invent a `--subject` for `create-issue` when the user didn't give one — ask instead.
- Don't pass a `--project` name to `create-issue` or `change-issue` on a guess when it could be a near-miss of an
  existing one — run `list-projects` first; the CLI won't catch a typo'd or differently-cased
  duplicate for you.
- Don't treat a non-zero exit as success or swallow the stderr text — always surface it to the
  user.
