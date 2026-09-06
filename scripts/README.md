# kbl — kanban-lo admin CLI

A standalone Node + TypeScript CLI (no build step, run via `tsx`) that manages issues over WebDAV. Useful for admins or coding agents that need to inspect/manipulate issues without the browser UI.

## Setup

```bash
cd scripts
npm install

# Point at your WebDAV server (defaults to http://localhost:8282/dav)
export KBL_DAV_BASE=http://localhost:8282/dav   # or pass --dav-base <url> per command
```

Run `npx tsx src/cli.ts <subcommand> --help` for a subcommand's full option list.

## Commands

| Command | Description |
|---|---|
| `list-issues [--status <column>] [--max <n>]` | List issues in a column, most-priority-first. Defaults: `todo`, `10`. |
| `fetch-issue --id <id>` | Print an issue's full content (subject/content/project/status) as JSON. |
| `create-issue --subject <text> [--content <text>] [--project <name>] [--status <column>]` | Create a new issue. Defaults: empty content, no project, `todo`. |
| `change-issue --id <id> [--status <column>] [--content <text>] [--append-content <text>]` | Change an issue's status and/or content. `--content`/`--append-content` are mutually exclusive. A `--status` change moves the issue to the top of the destination column's order (`issues/{column}/_order.json`). |
| `archive-issue --id <id>` | Archive an issue: move its file to `issues/_archive/`, out of its column. Archived issues aren't visible on the board. |
| `unarchive-issue --id <id> [--status <column>]` | Restore an archived issue into a column. Default: `todo`. |
| `list-archives` | List archived issues. |
| `list-projects` | List the admin-maintained projects from `issues/_projects.json`. |

### Examples

```bash
npx tsx src/cli.ts list-issues --status todo --max 10
npx tsx src/cli.ts fetch-issue --id "1753600000000-example-issue"
npx tsx src/cli.ts create-issue --project project-a --subject "New subject" --content "New content"
npx tsx src/cli.ts change-issue --id "1753600000000-example-issue" --status done --append-content "Append content"
npx tsx src/cli.ts change-issue --id "1753600000000-example-issue" --content "New content"
npx tsx src/cli.ts archive-issue --id "1753600000000-example-issue"
npx tsx src/cli.ts unarchive-issue --id "1753600000000-example-issue" --status todo
npx tsx src/cli.ts list-archives
npx tsx src/cli.ts list-projects
```

## mise tasks

Each subcommand also has a `mise run` task (from the repository root), which wraps the same `npx tsx src/cli.ts` calls:

```bash
mise run list-issues -- --status todo --max 10
mise run fetch-issue -- --id <id>
mise run create-issue -- --subject "new subject"
mise run change-issue -- --id <id> --status done
mise run archive-issue -- --id <id>
mise run unarchive-issue -- --id <id> --status todo
mise run list-archives
mise run list-projects
```

## Testing

```bash
npm run test       # kbl unit tests
npm run typecheck  # type-check without emitting
```
