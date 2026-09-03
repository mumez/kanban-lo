---
name: kanban-lo
description: Operate a Kanban-lo board (list, fetch, create, and change issues, and look up admin-maintained projects) via the `kbl` CLI, run through `mise run` from $KBL_HOME. Use when the user asks to list/view/create/update issues "on kanban", "on the kanban board", "on kanban-lo", or "with kbl", or needs to know which projects exist before filing a new issue.
---

# kanban-lo

Drives the `kbl` admin CLI for [Kanban-lo](https://github.com/mumez/kanban-lo) — a WebDAV-backed
issue board with four columns: `todo`, `working`, `done`, `pending`.

## Prerequisites

- `$KBL_HOME` must be set and point at a local kanban-lo checkout (the one containing
  `mise.toml` and `scripts/`).
- `KBL_DAV_BASE` must be set (or pass `--dav-base <url>` per command) to point at a reachable
  WebDAV server. Defaults to `http://localhost:8282/dav` if unset.
- Always `cd $KBL_HOME` before running `mise run` — the tasks are defined relative to that
  directory.
- Always put `--` between the task name and its flags: `mise run <task> -- <flags>`. Without it,
  `mise` will not forward the flags to the underlying `kbl` command.

## Commands

### List issues — `list-issues`

```
cd $KBL_HOME
mise run list-issues -- --status <column> --max <n>
```

| Flag | Required | Default | Notes |
|---|---|---|---|
| `--status` | no | `todo` | one of `todo`, `working`, `done`, `pending` |
| `--max` | no | `10` | max issues returned |

If the user asks to list issues without naming a column, default `--status` to `todo`.

Output: one line per issue, `<id>\t<subject> [<project>]` (project omitted if unset), most
priority-first. If empty: `No issues in "<status>".`

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

Output: the issue's full content as JSON (subject, content, project, status). Exits non-zero
with `Issue not found: <id>` on stderr if the id doesn't exist in any column.

If it fails: `Issue not found` → don't guess or retry with a modified id; run `list-issues`
across the likely columns and ask the user to confirm the correct id.

### Change an issue — `change-issue`

```
cd $KBL_HOME
mise run change-issue -- --id <id> [--status <column>] [--content <text>] [--append-content <text>]
```

| Flag | Required | Notes |
|---|---|---|
| `--id` | yes | |
| `--status` | no | one of `todo`, `working`, `done`, `pending`; moves the issue to the top of the destination column |
| `--content` | no | replaces the issue's content entirely |
| `--append-content` | no | appends text to the existing content |

At least one of `--status`, `--content`, or `--append-content` is required — the CLI exits
non-zero with `change-issue requires at least one of --status, --content, or --append-content`
if none is given. `--content` and `--append-content` are also mutually exclusive, enforced by the
CLI (`change-issue accepts only one of --content or --append-content`) — use one or the other
depending on whether the user wants to replace or add to the issue body.

🔴 **Checkpoint before `--content`**: this flag discards the issue's existing content entirely.
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
already exist before passing `--project` to `create-issue`, so the new issue lands under an
existing project instead of a name that only differs by typo or casing.

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

If the user names a project for `--project` and you're not sure it matches an existing one
exactly (casing, spelling), run `list-projects` first and use the existing name if there's a
match — the CLI doesn't validate `--project` against the list, so a near-miss silently creates a
new, separate project.

If it fails: `--subject` omitted → CLI rejects the command; ask the user for a subject before
retrying, don't invent a placeholder one.

## Intent → command examples

- "kanbanから最新10件のissue取って" (fetch the latest 10 issues from kanban)
  → `mise run list-issues -- --status todo --max 10`

- "kanbanにxxxの問題をissueとして登録して" (register problem xxx as an issue on kanban)
  → `mise run create-issue -- --subject "xxx" --content "..."`

- "kanbanのexample-issueに作業内容を書いてworkingにしておいて" (write work notes on
  example-issue and set it to working)
  → `mise run change-issue -- --id "example-issue" --status working --append-content "..."`

- "kanbanにあるexample-issueを参照して、仕様を確認して" (look at example-issue on kanban
  to check the spec)
  → `mise run fetch-issue -- --id "example-issue"`

- "kanbanにこの不具合をissueとして登録して。プロジェクトはたぶんExampleProjectのはず" (register
  this bug as an issue on kanban; the project is probably ExampleProject)
  → `mise run list-projects` to confirm the exact existing name, then
  `mise run create-issue -- --subject "..." --project "<confirmed name>"`

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
- Don't run `change-issue --content` without confirming the user wants a full replace (see the
  checkpoint above) — it silently discards the existing content.
- Don't invent a `--subject` for `create-issue` when the user didn't give one — ask instead.
- Don't pass a `--project` name to `create-issue` on a guess when it could be a near-miss of an
  existing one — run `list-projects` first; the CLI won't catch a typo'd or differently-cased
  duplicate for you.
- Don't treat a non-zero exit as success or swallow the stderr text — always surface it to the
  user.
