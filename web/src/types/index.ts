// Column/Issue live in lib/issue-format.ts (framework-agnostic, reused by
// scripts/kbl) — re-exported here for existing app-side imports.
export type { Column, Issue } from "../lib/issue-format";
import type { Column } from "../lib/issue-format";

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

// Modal operation mode
export type ModalMode = "create" | "edit";

// SolidJS custom directive types for @thisbeyond/solid-dnd
declare module "solid-js" {
  namespace JSX {
    interface Directives {
      sortable: any;
      droppable: any;
      draggable: any;
    }
  }
}

