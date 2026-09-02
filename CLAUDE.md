# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General Rules

- Act based on facts. If you are unsure, state your assumptions.
- Write the minimum code that solves the problem.
- Documents should be written in plain English

## Implementation Rules

- Names matter. Always check that class/method/variable names are intentionally revealing. (Long names are fine)
- Always keep the DRY principle to make the code simple and clean.
- When adding a new feature, ensure it is covered by unit tests.

## Key Gotchas

## Project overview

kanban-lo is a file-based kanban board. Issues are Markdown files under `issues/{todo,working,done,pending}/`, and the SolidJS SPA reads/writes them directly over WebDAV — there is no backend API or database. An issue's status is which of those four directories its file lives in; changing status is a WebDAV `MOVE` (file rename between directories), not a field edit. In code, `Issue.status` (type `Column`) reflects this: the web app calls it a "column" in UI-facing naming (`Column`, `COLUMNS`, `KanbanColumn.tsx`, etc., matching the board metaphor), while the `kbl` CLI surfaces it as `--status`/`status` since there's no visual column there.

Issue file format (see `_templates/issue.md`):
```markdown
# Subject

Content (Markdown)
```
Filenames follow `{epoch-ms timestamp}-{slug}.md`, e.g. `1753600000000-example-issue.md`. The H1 is the subject; everything after it (minus leading blank lines) is the content.

An issue may optionally be classified under a project via a leading YAML frontmatter block:
```markdown
---
project: project-a
---
# Subject

Content (Markdown)
```
An issue with no frontmatter has no project and is always shown, regardless of the selected filter. The list of valid projects lives in `issues/_projects.json` (a JSON array of strings), which is admin-maintained by hand — the Web UI only reads it, to populate the project filter dropdown, and never writes it.

Card order within a column is optional, per-column state kept in `issues/{column}/_order.json` — a JSON array of `"{id}.md"` filenames, most-significant-first. If the file is absent (the default), cards fall back to whatever order the WebDAV directory listing returns. Cards not listed in `_order.json` (e.g. newly created ones) sort after the listed ones, keeping their original relative order. `_order.json` is kept in sync automatically: `createIssue` appends the new id to an existing order (a no-op if the column has none yet), and `deleteIssue` removes the id from it. There's no separate rename operation — an issue's id/filename is fixed at creation and never changes when its subject is edited, so nothing to sync there.

## Architecture

- `web/src/lib/issue-format.ts` — framework-agnostic issue logic with no Vite or WebDAV-client dependency: `Column`/`Issue` types, Markdown parse/serialize (`parseMarkdown`/`serializeMarkdown`, which also handle the optional `project` frontmatter), filename/slug generation (`generateId`), and order sorting (`sortByOrder`/`ORDER_FILENAME`). Split out specifically so it can be imported by both `web/src/services/webdav.ts` and the standalone `scripts/kbl` CLI without pulling in Vite (`import.meta.env`) or SolidJS.
- `web/src/services/webdav.ts` — the only layer the web app uses to talk to WebDAV. Re-exports the pure logic from `lib/issue-format.ts` and owns the `_order.json` read/write (`loadOrder`/`saveOrder`) and all CRUD + `moveFile` calls against the `webdav` client. Requests go to `/dav/*`. `listIssues` applies `sortByOrder` before returning.
- `web/src/store/kanban.ts` — single SolidJS store (`kanbanStore`) holding all app state: the issue list, the project list, the selected project filter, loading/error flags, and modal state. All UI reads/mutates state through this store's exported actions (`addIssue`, `saveIssue`, `moveIssue`, `reorderIssue`, `removeIssue`, `init`, `reload`, `setSelectedProject`) rather than calling `webdav.ts` directly. `run()` wraps every async action to centralize loading/error handling. `reorderIssue(issueId, toColumn, toIndex)` is the one primitive for both same-column reordering and cross-column moves; it persists `_order.json` for every column it touches. `moveIssue` is a thin wrapper that calls it with an end-of-column index (used by the modal's column dropdown, where position doesn't matter). `issuesByColumn` always returns every issue in a column (unfiltered) since `reorderIssue` relies on it for the full per-column id list it writes to `_order.json`; `visibleIssuesByColumn` narrows that by the selected project filter and is what components render.
- `web/src/components/` — `Board.tsx` (columns + drag-and-drop via `@thisbeyond/solid-dnd`, using `createSortable`/`SortableProvider` for reorderable cards and `closestCenter` collision detection) → `KanbanColumn.tsx` → `IssueCard.tsx`, plus `IssueModal.tsx` for create/edit driven by `kanbanStore.modal`. `Board`'s `onDragEnd` resolves the drop target's column and index (from an item id or a column's empty-area droppable) and calls `kanbanStore.reorderIssue`.
- `web/src/types/index.ts` — re-exports `Column`/`Issue` from `lib/issue-format.ts` (kept as the app-facing import path) and centralizes `COLUMNS`/`COLUMN_LABELS`/`COLUMN_COLORS`/`ModalMode`, plus the `solid-js` JSX `Directives` augmentation for `@thisbeyond/solid-dnd`'s `use:sortable`/`use:droppable` attributes.
- `scripts/` — `kbl`, a standalone Node + TypeScript CLI (own `package.json`/`tsconfig.json`, run via `tsx`, no build step) for admins or coding agents to manage issues over WebDAV without the browser UI. `scripts/src/webdavClient.ts` is its WebDAV boundary — imports the same `lib/issue-format.ts` from `web/` (relative import) rather than duplicating parsing/ordering logic, and adds `getIssue` (search all columns by id) and `changeIssueStatus` (move + insert at the top of the destination column's order, unlike the app's index-based `reorderIssue`). `scripts/src/commands/*.ts` hold one function per subcommand; `scripts/src/cli.ts` wires them up with `commander`. The WebDAV base URL comes from `KBL_DAV_BASE` (default `http://localhost:8282/dav`) or a `--dav-base` flag.

Routing of a WebDAV path: `/dav/{column}/{id}.md` → Vite dev proxy (`vite.config.ts`, dev only) or Caddy directly (prod) → `webdav` Caddy module rooted at `/data/issues` (see `Caddyfile`) → `issues/{column}/{id}.md` on disk. The `webdav` Caddy module is configured with `prefix /dav` (not `uri strip_prefix`) — required so the MOVE handler's `Destination` header, which still carries the `/dav` prefix, resolves against the same root as the request path.

## Commands

All frontend commands run from `web/`:

```bash
npm install       # install deps
npm run dev        # Vite dev server on :5173 (proxies /dav to :8282)
npm run build       # tsc typecheck + vite build → web/dist
npm run preview      # preview the production build
npm run test        # component-level unit tests (Vitest + jsdom + @solidjs/testing-library)
npm run test:watch    # unit tests in watch mode
npm run test:integration # WebDAV integration tests against a real Caddy container
```

Unit tests (`vitest.config.ts`) mock `services/webdav.ts` — the app's only I/O boundary — and exercise the real `kanbanStore` and components against jsdom.

Integration tests (`vitest.integration.config.ts`, files named `*.integration.test.ts`) run in Node against a real WebDAV server and need `docker compose up -d` (from the repo root) running first. They point `services/webdav.ts` at `http://localhost:8282/dav` via `VITE_DAV_BASE` in `web/.env.integration` (`DAV_BASE` in `webdav.ts` falls back to the relative `/dav` used in the browser). Each test cleans up the issue files it creates.

Backend (WebDAV + static file serving), from the repo root:

```bash
docker compose up --build   # builds the Caddy image and serves web/dist + issues/ via WebDAV on :8282
```

For local development, run `docker compose up --build` (WebDAV only) alongside `npm run dev` in `web/` (HMR frontend), rather than rebuilding the SPA for every change.

`kbl` CLI commands run from `scripts/`:

```bash
npm install                # install deps
npx tsx src/cli.ts <subcommand> ...  # run a subcommand (no build step)
npm run typecheck          # tsc --noEmit
npm run test               # Vitest unit tests
```

Subcommands: `list-issues [--status <column>] [--max N]` (defaults: `todo`, `10`), `fetch-issue --id <id>`, `change-issue --id <id> [--status <column>] [--content <text>]`, `create-issue --subject <text> [--project <name>] [--content <text>] [--status <column>]`, `list-projects`. Unit tests mock `webdavClient.ts` (command tests) or the `webdav` npm package's `createClient` (`webdavClient.test.ts` itself), mirroring how `web/`'s tests mock `services/webdav.ts`.
