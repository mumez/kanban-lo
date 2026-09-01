// Kanban column definitions
export type Column = "todo" | "working" | "done" | "pending";

// Issue type
export interface Issue {
  /** Filename without extension, e.g. "1735000000000-fix-login-bug" */
  id: string;
  /** Title extracted from the Markdown H1 */
  subject: string;
  /** Body after the H1 */
  content: string;
  /** Column this issue belongs to */
  column: Column;
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
    const rankOf = (issue: Issue) => rank.get(issue.id) ?? Infinity;
    return rankOf(a) - rankOf(b);
  });
}
