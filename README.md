# kanban-lo

A simple kanban board for local environments.
**Manage issues using files only** — the web UI operates on those files via WebDAV.

## Features

- **File-based** — `.md` files under `issues/{todo,working,done,pending}/` are the issues themselves
- **Minimal dependencies** — runs with just Docker (Caddy) and Node.js
- **Web UI** — an SPA built with SolidJS + daisyUI. Drag and drop between columns, create/edit/delete via modal
- **WebDAV** — the SPA reads and writes files over WebDAV. Issues can also be managed by manipulating files directly, without the UI

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

## Testing

```bash
cd web
npm run test              # component-level unit tests
npm run test:integration  # WebDAV integration tests (needs `docker compose up -d` running first)
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
