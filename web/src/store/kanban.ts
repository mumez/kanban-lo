import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { Column, Issue, ModalMode } from "../types";
import { COLUMNS } from "../types";
import * as dav from "../services/webdav";

// ----------------------------------------------------------------
// Issue store
// ----------------------------------------------------------------

const [issues, setIssues] = createStore<Issue[]>([]);

/** Reload all issues and the project list from WebDAV */
async function reload() {
  const [all, projectList] = await Promise.all([dav.loadAllIssues(), dav.loadProjects()]);
  setIssues(all);
  setProjects(Array.isArray(projectList) ? projectList : []);
}

// ----------------------------------------------------------------
// Project filter
// ----------------------------------------------------------------

/** Admin-maintained project list, from issues/_projects.json (read-only in the UI) */
const [projects, setProjects] = createSignal<string[]>([]);

/** Currently selected project filter; null means "all" */
const [selectedProject, setSelectedProject] = createSignal<string | null>(null);

// ----------------------------------------------------------------
// Loading / error state
// ----------------------------------------------------------------

const [loading, setLoading] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);

async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
  setLoading(true);
  setError(null);
  try {
    const result = await fn();
    return result;
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
    return undefined;
  } finally {
    setLoading(false);
  }
}

// ----------------------------------------------------------------
// Modal state
// ----------------------------------------------------------------

interface ModalState {
  open: boolean;
  mode: ModalMode;
  column: Column;
  issue: Issue | null;
}

const [modal, setModal] = createStore<ModalState>({
  open: false,
  mode: "create",
  column: "todo",
  issue: null,
});

function openCreateModal(column: Column) {
  setModal({ open: true, mode: "create", column, issue: null });
}

function openEditModal(issue: Issue) {
  setModal({ open: true, mode: "edit", column: issue.column, issue });
}

function closeModal() {
  setModal({ open: false });
}

// ----------------------------------------------------------------
// Actions
// ----------------------------------------------------------------

/** Initial load */
async function init() {
  await run(reload);
}

/** Create an issue */
async function addIssue(column: Column, subject: string, content: string, project?: string) {
  await run(async () => {
    const newIssue = await dav.createIssue(column, subject, content, project);
    setIssues(produce((draft) => draft.push(newIssue)));
  });
}

/** Update an issue */
async function saveIssue(id: string, subject: string, content: string, project?: string) {
  const idx = issues.findIndex((i) => i.id === id);
  if (idx === -1) return;

  const updated: Issue = { ...issues[idx], subject, content, project };
  await run(async () => {
    await dav.updateIssue(updated);
    setIssues(idx, { subject, content, project });
  });
}

/** Move an issue to another column, appending it to the end */
async function moveIssue(issueId: string, toColumn: Column) {
  const issue = issues.find((i) => i.id === issueId);
  if (!issue || issue.column === toColumn) return;
  await reorderIssue(issueId, toColumn, issuesByColumn(toColumn).length);
}

/**
 * Move an issue to a specific position within a column (same column for a
 * plain reorder, a different one when dragged across columns), and persist
 * the affected column(s)' order to _order.json.
 */
async function reorderIssue(issueId: string, toColumn: Column, toIndex: number) {
  const issue = issues.find((i) => i.id === issueId);
  if (!issue) return;
  const fromColumn = issue.column;

  const targetIds = issuesByColumn(toColumn)
    .map((i) => i.id)
    .filter((id) => id !== issueId);
  const clampedIndex = Math.max(0, Math.min(toIndex, targetIds.length));
  targetIds.splice(clampedIndex, 0, issueId);

  const sourceIds =
    fromColumn === toColumn
      ? targetIds
      : issuesByColumn(fromColumn)
          .map((i) => i.id)
          .filter((id) => id !== issueId);

  if (fromColumn === toColumn) {
    const currentIds = issuesByColumn(toColumn).map((i) => i.id);
    if (currentIds.join() === targetIds.join()) return; // dropped back in place
  }

  await run(async () => {
    if (fromColumn !== toColumn) {
      await dav.moveIssue(issue, toColumn);
    }

    const byId = new Map(issues.map((i) => [i.id, i]));
    const orderedIds = COLUMNS.flatMap((column) => {
      if (column === toColumn) return targetIds;
      if (column === fromColumn) return sourceIds;
      return issuesByColumn(column).map((i) => i.id);
    });
    setIssues(
      orderedIds.map((id) => {
        const original = byId.get(id)!;
        return id === issueId ? { ...original, column: toColumn } : original;
      })
    );

    await dav.saveOrder(toColumn, targetIds.map((id) => `${id}.md`));
    if (fromColumn !== toColumn) {
      await dav.saveOrder(fromColumn, sourceIds.map((id) => `${id}.md`));
    }
  });
}

/** Delete an issue */
async function removeIssue(issue: Issue) {
  await run(async () => {
    await dav.deleteIssue(issue);
    setIssues((prev) => prev.filter((i) => i.id !== issue.id));
  });
}

/**
 * Issues filtered by column (derived getter). Deliberately ignores the
 * project filter — reorderIssue relies on this for the full per-column id
 * list it writes to _order.json, so filtering here would drop issues hidden
 * by the project filter from that file. Use `visibleIssuesByColumn` for
 * rendering instead.
 */
function issuesByColumn(column: Column): Issue[] {
  return issues.filter((i) => i.column === column);
}

/** Issues to render for a column: issuesByColumn narrowed by the selected project filter */
function visibleIssuesByColumn(column: Column): Issue[] {
  const project = selectedProject();
  return issuesByColumn(column).filter((i) => project === null || i.project === project);
}

// ----------------------------------------------------------------
// Exports
// ----------------------------------------------------------------

export const kanbanStore = {
  // state
  get issues() {
    return issues;
  },
  get loading() {
    return loading();
  },
  get error() {
    return error();
  },
  get modal() {
    return modal;
  },
  get projects() {
    return projects();
  },
  get selectedProject() {
    return selectedProject();
  },

  // derived
  issuesByColumn,
  visibleIssuesByColumn,

  // modal actions
  openCreateModal,
  openEditModal,
  closeModal,

  // data actions
  init,
  addIssue,
  saveIssue,
  moveIssue,
  reorderIssue,
  removeIssue,
  reload,
  setSelectedProject,
};
