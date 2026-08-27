// Kanban column definitions
export type Column = "todo" | "working" | "done" | "pending";

export const COLUMNS: Column[] = ["todo", "working", "done", "pending"];

export const COLUMN_LABELS: Record<Column, string> = {
  todo: "Todo",
  working: "Working",
  done: "Done",
  pending: "Pending",
};

// Column colors (daisyUI badge/border colors)
export const COLUMN_COLORS: Record<Column, string> = {
  todo: "badge-neutral",
  working: "badge-info",
  done: "badge-success",
  pending: "badge-warning",
};

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
}

// Modal operation mode
export type ModalMode = "create" | "edit";
