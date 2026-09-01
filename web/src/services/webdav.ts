import { createClient, type WebDAVClient, type FileStat } from "webdav";
import {
  type Column,
  type Issue,
  parseMarkdown,
  serializeMarkdown,
  generateId,
  sortByOrder,
  ORDER_FILENAME,
} from "../lib/issue-format";

export { parseMarkdown, serializeMarkdown, generateId, sortByOrder };

// WebDAV base URL (/dav → Vite proxy → Caddy). Overridable so integration
// tests can point directly at a running Caddy container.
const DAV_BASE = import.meta.env.VITE_DAV_BASE ?? "/dav";

let _client: WebDAVClient | null = null;

function getClient(): WebDAVClient {
  if (!_client) {
    _client = createClient(DAV_BASE);
  }
  return _client;
}

/** Build a WebDAV path */
function davPath(column: Column, id: string): string {
  return `/${column}/${id}.md`;
}

// ----------------------------------------------------------------
// Column ordering (_order.json)
// ----------------------------------------------------------------

function orderPath(column: Column): string {
  return `/${column}/${ORDER_FILENAME}`;
}

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
    // No order file yet, or it's unreadable/invalid — fall back to default order.
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

/**
 * Append an id to a column's saved order, keeping _order.json accurate for
 * newly created issues. A no-op when the column has no explicit order yet —
 * there's nothing to keep in sync, and the default (directory listing) order
 * already surfaces the new file.
 */
async function addToOrder(column: Column, id: string): Promise<void> {
  const order = await loadOrder(column);
  if (order.length === 0) return;
  await saveOrder(column, [...order, `${id}.md`]);
}

/**
 * Remove an id from a column's saved order, so deleted issues don't linger
 * as stale entries in _order.json. A no-op when the id isn't listed.
 */
async function removeFromOrder(column: Column, id: string): Promise<void> {
  const order = await loadOrder(column);
  const filtered = order.filter((filename) => filename !== `${id}.md`);
  if (filtered.length !== order.length) {
    await saveOrder(column, filtered);
  }
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
    // Directory empty or missing
    return [];
  }

  const mdFiles = items.filter(
    (item) => item.type === "file" && item.basename.endsWith(".md")
  );

  const issues = await Promise.all(
    mdFiles.map(async (item): Promise<Issue | null> => {
      try {
        // Build the path from basename rather than trusting item.filename,
        // which the webdav client mis-resolves when DAV_BASE has a path
        // component (e.g. an absolute base URL used in integration tests).
        const id = item.basename.replace(/\.md$/, "");
        const text = (await client.getFileContents(davPath(column, id), {
          format: "text",
        })) as string;
        const { subject, content, project } = parseMarkdown(text);
        return { id, subject, content, status: column, project };
      } catch {
        return null;
      }
    })
  );

  const order = await loadOrder(column);
  return sortByOrder(issues.filter((i): i is Issue => i !== null), order);
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

  return project
    ? { id, subject, content, status: column, project }
    : { id, subject, content, status: column };
}

/** Update an issue's content (overwrite file in the same column) */
export async function updateIssue(issue: Issue): Promise<void> {
  const client = getClient();
  const path = davPath(issue.status, issue.id);
  const text = serializeMarkdown(issue.subject, issue.content, issue.project);
  await client.putFileContents(path, text, { overwrite: true });
}

/** Move an issue to another column (WebDAV MOVE) */
export async function moveIssue(issue: Issue, toColumn: Column): Promise<Issue> {
  const client = getClient();
  const fromPath = davPath(issue.status, issue.id);
  const toPath = davPath(toColumn, issue.id);

  await client.moveFile(fromPath, toPath);

  return { ...issue, status: toColumn };
}

/** Delete an issue */
export async function deleteIssue(issue: Issue): Promise<void> {
  const client = getClient();
  const path = davPath(issue.status, issue.id);
  await client.deleteFile(path);
  await removeFromOrder(issue.status, issue.id);
}

/** Load issues from all columns */
export async function loadAllIssues(): Promise<Issue[]> {
  const columns: Column[] = ["todo", "working", "done", "pending"];
  const results = await Promise.all(columns.map(listIssues));
  return results.flat();
}

/**
 * Load the admin-maintained project list from issues/_projects.json.
 * Empty when the file is absent — the UI treats that as "no project filter".
 */
export async function loadProjects(): Promise<string[]> {
  const client = getClient();
  try {
    const text = (await client.getFileContents("/_projects.json", {
      format: "text",
    })) as string;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
