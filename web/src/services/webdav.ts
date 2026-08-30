import { createClient, type WebDAVClient, type FileStat } from "webdav";
import type { Column, Issue } from "../types";

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

// ----------------------------------------------------------------
// Markdown parse / serialize
// ----------------------------------------------------------------

/** "# subject\n\ncontent" → { subject, content } */
export function parseMarkdown(text: string): { subject: string; content: string } {
  const lines = text.split("\n");
  let subject = "";
  let contentStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#\s+(.+)/);
    if (match) {
      subject = match[1].trim();
      contentStart = i + 1;
      break;
    }
  }

  // Skip leading blank lines
  while (contentStart < lines.length && lines[contentStart].trim() === "") {
    contentStart++;
  }

  const content = lines.slice(contentStart).join("\n").trimEnd();
  return { subject, content };
}

/** { subject, content } → Markdown text */
export function serializeMarkdown(subject: string, content: string): string {
  const body = content.trim();
  return body ? `# ${subject}\n\n${body}\n` : `# ${subject}\n`;
}

// ----------------------------------------------------------------
// Filename utilities
// ----------------------------------------------------------------

/** Build a filename slug from a subject */
function toSlug(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/[^\w\u3040-\u9fff]+/g, "-") // Keep alphanumerics and CJK; replace other chars with hyphen
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Generate a new issue ID: "{timestamp}-{slug}" */
export function generateId(subject: string): string {
  return `${Date.now()}-${toSlug(subject) || "issue"}`;
}

/** Build a WebDAV path */
function davPath(column: Column, id: string): string {
  return `/${column}/${id}.md`;
}

// ----------------------------------------------------------------
// Column ordering (_order.json)
// ----------------------------------------------------------------

const ORDER_FILENAME = "_order.json";

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
 * Sort issues by a saved "{id}.md" filename order. Issues not listed in
 * `order` (e.g. newly created ones, or when there's no _order.json at all)
 * keep their original relative order, after the ordered ones.
 */
export function sortByOrder(issues: Issue[], order: string[]): Issue[] {
  if (order.length === 0) return issues;

  const rank = new Map(order.map((filename, i) => [filename.replace(/\.md$/, ""), i]));
  return [...issues].sort((a, b) => {
    const rankOf = (issue: Issue) => rank.get(issue.id) ?? Infinity;
    return rankOf(a) - rankOf(b);
  });
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
        const { subject, content } = parseMarkdown(text);
        return { id, subject, content, column };
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
  content: string
): Promise<Issue> {
  const client = getClient();
  const id = generateId(subject);
  const path = davPath(column, id);
  const text = serializeMarkdown(subject, content);

  await client.putFileContents(path, text, { overwrite: false });

  return { id, subject, content, column };
}

/** Update an issue's content (overwrite file in the same column) */
export async function updateIssue(issue: Issue): Promise<void> {
  const client = getClient();
  const path = davPath(issue.column, issue.id);
  const text = serializeMarkdown(issue.subject, issue.content);
  await client.putFileContents(path, text, { overwrite: true });
}

/** Move an issue to another column (WebDAV MOVE) */
export async function moveIssue(issue: Issue, toColumn: Column): Promise<Issue> {
  const client = getClient();
  const fromPath = davPath(issue.column, issue.id);
  const toPath = davPath(toColumn, issue.id);

  await client.moveFile(fromPath, toPath);

  return { ...issue, column: toColumn };
}

/** Delete an issue */
export async function deleteIssue(issue: Issue): Promise<void> {
  const client = getClient();
  const path = davPath(issue.column, issue.id);
  await client.deleteFile(path);
}

/** Load issues from all columns */
export async function loadAllIssues(): Promise<Issue[]> {
  const columns: Column[] = ["todo", "working", "done", "pending"];
  const results = await Promise.all(columns.map(listIssues));
  return results.flat();
}
