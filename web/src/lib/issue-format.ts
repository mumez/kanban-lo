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

/** Optional YAML frontmatter. Blank values are omitted when an issue is written. */
export interface IssueFrontmatter {
  /** Project classification. Issues without one stay visible under every project filter. */
  project?: string;
  /** Pull request URL */
  pr?: string;
  /** Id of the agent session assigned to this issue */
  sessionId?: string;
}

// Issue type
export interface Issue extends IssueFrontmatter {
  /** Filename without extension, e.g. "1735000000000-fix-login-bug" */
  id: string;
  /** Title extracted from the Markdown H1 */
  subject: string;
  /** Body after the H1 */
  content: string;
  /** Status (column) this issue is in */
  status: Column;
}

// ----------------------------------------------------------------
// Markdown parse / serialize
// ----------------------------------------------------------------

const FRONTMATTER_KEYS = ["project", "pr", "sessionId"] as const;

/** A single-line frontmatter value, or undefined when missing or blank. */
function singleLine(value: string | undefined): string | undefined {
  const trimmed = value?.split(/[\r\n]/, 1)[0]?.trim();
  return trimmed ? trimmed : undefined;
}

/** Read one `key: value` line. `[ \t]` keeps an empty value from swallowing the next key. */
function frontmatterValue(frontmatter: string, key: (typeof FRONTMATTER_KEYS)[number]): string | undefined {
  const match = frontmatter.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
  return singleLine(match?.[1]);
}

/** "---\nproject: x\npr: url\nsessionId: id\n---\n# subject\n\ncontent" → parsed issue text */
export function parseMarkdown(
  text: string
): { subject: string; content: string } & IssueFrontmatter {
  let body = text.replace(/\r\n/g, "\n");
  const fields: IssueFrontmatter = {};

  if (body.startsWith("---\n")) {
    const end = body.indexOf("\n---", 4);
    if (end !== -1) {
      const frontmatter = body.slice(4, end);
      for (const key of FRONTMATTER_KEYS) {
        const value = frontmatterValue(frontmatter, key);
        if (value) fields[key] = value;
      }
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
  return { subject, content, ...fields };
}

/** Issue text → Markdown, with a frontmatter block only for values that are set. */
export function serializeMarkdown(
  subject: string,
  content: string,
  frontmatter?: IssueFrontmatter
): string {
  const body = content.trim();
  const lines = FRONTMATTER_KEYS.flatMap((key) => {
    const value = singleLine(frontmatter?.[key]);
    return value ? [`${key}: ${value}`] : [];
  });
  const header = lines.length > 0 ? `---\n${lines.join("\n")}\n---\n` : "";
  return header + (body ? `# ${subject}\n\n${body}\n` : `# ${subject}\n`);
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
