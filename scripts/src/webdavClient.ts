import { createClient, type WebDAVClient, type FileStat } from "webdav";
import {
  type Column,
  type Issue,
  parseMarkdown,
  serializeMarkdown,
  generateId,
  sortByOrder,
  ORDER_FILENAME,
} from "../../web/src/lib/issue-format";

export const COLUMNS: Column[] = ["todo", "working", "done", "pending"];

const DEFAULT_DAV_BASE = "http://localhost:8282/dav";

let _client: WebDAVClient | null = null;
let _davBaseOverride: string | null = null;

/** Override the WebDAV base URL (e.g. from a --dav-base CLI flag). Must be called before any other function. */
export function configureDavBase(base: string): void {
  _davBaseOverride = base;
  _client = null;
}

function getClient(): WebDAVClient {
  if (!_client) {
    const base = _davBaseOverride ?? process.env.KBL_DAV_BASE ?? DEFAULT_DAV_BASE;
    _client = createClient(base);
  }
  return _client;
}

function davPath(column: Column, id: string): string {
  return `/${column}/${id}.md`;
}

function orderPath(column: Column): string {
  return `/${column}/${ORDER_FILENAME}`;
}

// ----------------------------------------------------------------
// Column ordering (_order.json)
// ----------------------------------------------------------------

/** Load the saved card order for a column, as "{id}.md" filenames. Empty when no _order.json exists. */
export async function loadOrder(column: Column): Promise<string[]> {
  const client = getClient();
  try {
    const text = (await client.getFileContents(orderPath(column), {
      format: "text",
    })) as string;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist the card order for a column, as "{id}.md" filenames */
export async function saveOrder(column: Column, filenames: string[]): Promise<void> {
  const client = getClient();
  await client.putFileContents(orderPath(column), JSON.stringify(filenames), {
    overwrite: true,
  });
}

async function addToOrder(column: Column, id: string): Promise<void> {
  const order = await loadOrder(column);
  if (order.length === 0) return;
  await saveOrder(column, [...order, `${id}.md`]);
}

async function removeFromOrder(column: Column, id: string): Promise<void> {
  const order = await loadOrder(column);
  const filtered = order.filter((filename) => filename !== `${id}.md`);
  if (filtered.length !== order.length) {
    await saveOrder(column, filtered);
  }
}

/** Insert an id at the top of a column's saved order, removing it from elsewhere in that order first. */
async function insertAtTopOfOrder(column: Column, id: string): Promise<void> {
  const order = await loadOrder(column);
  const filtered = order.filter((filename) => filename !== `${id}.md`);
  await saveOrder(column, [`${id}.md`, ...filtered]);
}

// ----------------------------------------------------------------
// WebDAV operations
// ----------------------------------------------------------------

/** List all issues in a column, sorted per the column's _order.json (if any) */
export async function listIssues(column: Column): Promise<Issue[]> {
  const client = getClient();

  let items: FileStat[];
  try {
    const result = await client.getDirectoryContents(`/${column}`);
    items = Array.isArray(result) ? result : (result as { data: FileStat[] }).data;
  } catch {
    return [];
  }

  const mdFiles = items.filter((item) => item.type === "file" && item.basename.endsWith(".md"));

  const issues = await Promise.all(
    mdFiles.map(async (item): Promise<Issue | null> => {
      try {
        const id = item.basename.replace(/\.md$/, "");
        const text = (await client.getFileContents(davPath(column, id), {
          format: "text",
        })) as string;
        const { subject, content, project } = parseMarkdown(text);
        return { id, subject, content, column, project };
      } catch {
        return null;
      }
    })
  );

  const order = await loadOrder(column);
  return sortByOrder(issues.filter((i): i is Issue => i !== null), order);
}

/** Find a single issue by id across all columns. Returns null if not found. */
export async function getIssue(id: string): Promise<Issue | null> {
  const client = getClient();
  for (const column of COLUMNS) {
    try {
      const text = (await client.getFileContents(davPath(column, id), {
        format: "text",
      })) as string;
      const { subject, content, project } = parseMarkdown(text);
      return { id, subject, content, column, project };
    } catch {
      // Not in this column; keep looking.
    }
  }
  return null;
}

/** Create a new issue */
export async function createIssue(
  column: Column,
  subject: string,
  content: string,
  project?: string
): Promise<Issue> {
  const client = getClient();
  const id = generateId(subject);
  const path = davPath(column, id);
  const text = serializeMarkdown(subject, content, project);

  await client.putFileContents(path, text, { overwrite: false });
  await addToOrder(column, id);

  return project ? { id, subject, content, column, project } : { id, subject, content, column };
}

/** Update an issue's content (overwrite file in the same column) */
export async function updateIssueContent(issue: Issue, content: string): Promise<Issue> {
  const client = getClient();
  const updated: Issue = { ...issue, content };
  const path = davPath(issue.column, issue.id);
  const text = serializeMarkdown(updated.subject, updated.content, updated.project);
  await client.putFileContents(path, text, { overwrite: true });
  return updated;
}

/**
 * Move an issue to another column and place it at the top of the
 * destination column's order, removing it from the source column's order.
 * Mirrors kanbanStore.reorderIssue's dual-column bookkeeping, specialized
 * to "insert at top" (this CLI's semantics for a status change).
 */
export async function changeIssueStatus(issue: Issue, toColumn: Column): Promise<Issue> {
  if (issue.column === toColumn) {
    await insertAtTopOfOrder(toColumn, issue.id);
    return issue;
  }

  const client = getClient();
  const fromPath = davPath(issue.column, issue.id);
  const toPath = davPath(toColumn, issue.id);
  await client.moveFile(fromPath, toPath);

  await removeFromOrder(issue.column, issue.id);
  await insertAtTopOfOrder(toColumn, issue.id);

  return { ...issue, column: toColumn };
}
