// Kanban column definitions. `releasing` sits between reviewing and done.
export type Column = "todo" | "working" | "reviewing" | "releasing" | "done" | "pending";
export const COLUMNS: Column[] = ["todo", "working", "reviewing", "releasing", "done", "pending"];

// ----------------------------------------------------------------
// Board settings (issues/_settings.json)
// ----------------------------------------------------------------

export const SETTINGS_FILENAME = "_settings.json";

/** Admin-maintained display settings. `hiddenStatuses` omits columns from the Web UI. */
export interface BoardSettings {
  hiddenStatuses: Column[];
}

const COLUMN_SET: ReadonlySet<string> = new Set(COLUMNS);

/**
 * Parse `issues/_settings.json`. A missing `hiddenStatuses`, a non-array
 * value, or a non-object document means "show every column". Names that
 * are not columns are ignored. Invalid JSON throws.
 */
export function parseSettings(text: string): BoardSettings {
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { hiddenStatuses: [] };
  }

  const raw = (parsed as { hiddenStatuses?: unknown }).hiddenStatuses;
  if (!Array.isArray(raw)) return { hiddenStatuses: [] };

  const hidden: Column[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const status = entry.trim();
    if (!COLUMN_SET.has(status) || hidden.includes(status as Column)) continue;
    hidden.push(status as Column);
  }
  return { hiddenStatuses: hidden };
}

/** Columns in board order, minus any status listed in `hiddenStatuses`. */
export function visibleColumns(hiddenStatuses: readonly string[]): Column[] {
  const hidden = new Set(hiddenStatuses);
  return COLUMNS.filter((column) => !hidden.has(column));
}

// Issue type
export interface Issue {
  /** Filename without extension, e.g. "1735000000000-fix-login-bug" */
  id: string;
  /** Title extracted from the Markdown H1 */
  subject: string;
  /** Body after the H1 */
  content: string;
  /** Status (column) this issue is in */
  status: Column;
  /** Optional project classification, from the issue's YAML frontmatter */
  project?: string;
}

// ----------------------------------------------------------------
// Markdown parse / serialize
// ----------------------------------------------------------------

/** "---\nproject: x\n---\n# subject\n\ncontent" → { subject, content, project } */
export function parseMarkdown(
  text: string
): { subject: string; content: string; project?: string } {
  let body = text.replace(/\r\n/g, "\n");
  let project: string | undefined;

  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---", 4);
    if (end !== -1) {
      const frontmatter = body.slice(4, end);
      const match = frontmatter.match(/^project:\s*(.+)$/m);
      if (match) project = match[1].trim();
      body = body.slice(end + 4).replace(/^\n/, "");
    }
  }

  const lines = body.split("\n");
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
  return project ? { subject, content, project } : { subject, content };
}

/** { subject, content, project } → Markdown text */
export function serializeMarkdown(subject: string, content: string, project?: string): string {
  const body = content.trim();
  const frontmatter = project ? `---\nproject: ${project}\n---\n` : "";
  return frontmatter + (body ? `# ${subject}\n\n${body}\n` : `# ${subject}\n`);
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

// ----------------------------------------------------------------
// Column ordering (_order.json)
// ----------------------------------------------------------------

export const ORDER_FILENAME = "_order.json";

/**
 * Sort issues by a saved "{id}.md" filename order. Issues not listed in
 * `order` (e.g. newly created ones, or when there's no _order.json at all)
 * keep their original relative order, after the ordered ones.
 */
export function sortByOrder(issues: Issue[], order: string[]): Issue[] {
  if (order.length === 0) return issues;

  const rank = new Map(order.map((filename, i) => [filename.replace(/\.md$/, ""), i]));
  return [...issues].sort((a, b) => {
    const rankA = rank.get(a.id);
    const rankB = rank.get(b.id);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return 0;
  });
}
