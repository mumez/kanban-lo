# kanban-lo

A simple kanban board for local environments.
**Manage issues using files only** — the web UI operates on those files via WebDAV.

## Features

- **File-based** — `.md` files under `issues/{todo,working,done,pending}/` are the issues themselves
- **Minimal dependencies** — runs with just Docker (Caddy) and Node.js
- **Web UI** — an SPA built with SolidJS + daisyUI. Drag and drop to reorder and move between columns, create/edit/delete via modal
- **WebDAV** — the SPA reads and writes files over WebDAV. Issues can also be managed by manipulating files directly, without the UI
- **Admin CLI** — `kbl` (in `scripts/`) manages issues over WebDAV from the command line, for admins or coding agents

## Directory structure

```
kanban-lo/
├── issues/
│   ├── todo/          # Not started
│   ├── working/       # In progress
│   ├── done/          # Done
│   └── pending/       # Pending
├── _templates/
│   └── issue.md       # Issue format definition
├── web/               # SolidJS SPA
│   ├── src/
│   │   ├── types/     # Type definitions
│   │   ├── services/  # WebDAV client
│   │   ├── store/     # Reactive store
│   │   └── components/
│   ├── package.json
│   └── vite.config.ts
├── scripts/            # kbl admin CLI (Node + TypeScript)
│   └── src/
│       ├── cli.ts        # subcommand wiring
│       ├── webdavClient.ts # WebDAV client for the CLI
│       └── commands/
├── docker/
│   └── Dockerfile.caddy  # xcaddy + caddy-webdav
├── Caddyfile
└── docker-compose.yml
```

## Issue format

```markdown
# Title

Body (Markdown supported)
```

File names follow the `{timestamp}-{slug}.md` format.
Moving a file between column directories changes its status.

Card order within a column is optional: dragging cards writes it to `issues/{column}/_order.json`, a JSON array of filenames in display order. Without that file, cards are shown in whatever order the WebDAV server lists them.

## Setup

### Requirements

- Docker & Docker Compose
- Node.js 18+

### 1. Build the SPA

```bash
cd web
npm install
npm run build
```

### 2. Start the Caddy container

```bash
# From the repository root
docker compose up --build
```

Open http://localhost:8282 in your browser.

### Development mode

Run Caddy (WebDAV only) and the Vite dev server separately.

```bash
# Terminal 1: Caddy (WebDAV server)
docker compose up --build

# Terminal 2: Vite dev server (with HMR)
cd web
npm install
npm run dev
```

Open http://localhost:5173 in your browser.
Requests to `/dav/*` are automatically proxied by Vite to `localhost:8282`.

## Admin CLI (kbl)

`scripts/` is a standalone Node + TypeScript project providing `kbl`, a CLI that manages issues over WebDAV (no build step, run via `tsx`). Useful for admins or coding agents that need to inspect/manipulate issues without the browser UI.

```bash
cd scripts
npm install

# Point at your WebDAV server (defaults to http://localhost:8282/dav)
export KBL_DAV_BASE=http://localhost:8282/dav   # or pass --dav-base <url> per command

npx tsx src/cli.ts list-issues --status todo --max 10  # both optional; defaults shown
npx tsx src/cli.ts fetch-issue --id "1753600000000-example-issue"
npx tsx src/cli.ts change-issue --id "1753600000000-example-issue" --status done --append-content "Append content"
npx tsx src/cli.ts change-issue --id "1753600000000-example-issue" --content "New content"
npx tsx src/cli.ts create-issue --project project-a --subject "New subject" --content "New content"
npx tsx src/cli.ts list-projects
```

Run `npx tsx src/cli.ts <subcommand> --help` for the full option list. A `--status` change moves the issue to the top of the destination column's order (`issues/{column}/_order.json`).

## Coding agent skill

`skills/kanban-lo/` is an [Agent Skill](https://docs.claude.com/en/docs/claude-code/skills) that lets a coding agent (e.g. Claude Code) operate the board directly, without a human driving the UI or CLI. It wraps the `kbl` CLI's subcommands (`list-issues`, `fetch-issue`, `change-issue`, `create-issue`, `list-projects`) via `mise run`, and documents the required environment (`KBL_HOME` pointing at this checkout, `KBL_DAV_BASE` pointing at a reachable WebDAV server) plus guardrails such as confirming before `--content` overwrites an issue and checking `list-projects` before guessing a `--project` name.

To use it, copy or symlink `skills/kanban-lo/` into another project's skills directory (or point your agent's skill search path at this repo), and set `KBL_HOME`/`KBL_DAV_BASE` in that project's environment.

## mise tasks

[mise](https://mise.jdx.dev) task definitions in `mise.toml` (repository root) wrap the commands above:

```bash
mise run prepare       # install dependencies (web + cli)
mise run test          # run all unit tests (web + cli)
mise run build-web     # build the web SPA
mise run serve         # build the web SPA and start the Caddy server

mise run list-issues -- --status todo --max 10
mise run fetch-issue -- --id <id>
mise run change-issue -- --id <id> --status done
mise run create-issue -- --subject "new subject"
mise run list-projects
```

Run `mise tasks` to see the full list.

## Testing

```bash
cd web
npm run test              # component-level unit tests
npm run test:integration  # WebDAV integration tests (needs `docker compose up -d` running first)
```

```bash
cd scripts
npm run test       # kbl unit tests
npm run typecheck  # type-check without emitting
```

## WebDAV endpoints

| Path | Description |
|------|------|
| `GET /dav/{column}/` | List files in a column (PROPFIND) |
| `GET /dav/{column}/{id}.md` | Get an issue |
| `PUT /dav/{column}/{id}.md` | Create / update an issue |
| `MOVE /dav/{column}/{id}.md` | Move an issue (change column) |
| `DELETE /dav/{column}/{id}.md` | Delete an issue |

## Tech stack

| Role | Technology |
|------|------|
| Frontend | [SolidJS](https://solidjs.com) + TypeScript |
| UI components | [daisyUI](https://daisyui.com) + Tailwind CSS |
| Drag and drop | [@thisbeyond/solid-dnd](https://github.com/thisbeyond/solid-dnd) |
| WebDAV client | [webdav](https://github.com/perry-mitchell/webdav-client) |
| Web server | [Caddy](https://caddyserver.com) + [caddy-webdav](https://github.com/mholt/caddy-webdav) |
| Build tool | [Vite](https://vitejs.dev) |

## License

MIT
