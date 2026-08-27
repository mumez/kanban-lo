import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { Column, Issue, ModalMode } from "../types";
import * as dav from "../services/webdav";

// ----------------------------------------------------------------
// Issue store
// ----------------------------------------------------------------

const [issues, setIssues] = createStore<Issue[]>([]);

/** Reload all issues from WebDAV */
async function reload() {
  const all = await dav.loadAllIssues();
  setIssues(all);
}

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
async function addIssue(column: Column, subject: string, content: string) {
  await run(async () => {
    const newIssue = await dav.createIssue(column, subject, content);
    setIssues(produce((draft) => draft.push(newIssue)));
  });
}

/** Update an issue */
async function saveIssue(id: string, subject: string, content: string) {
  const idx = issues.findIndex((i) => i.id === id);
  if (idx === -1) return;

  const updated: Issue = { ...issues[idx], subject, content };
  await run(async () => {
    await dav.updateIssue(updated);
    setIssues(idx, { subject, content });
  });
}

/** Move an issue to another column */
async function moveIssue(issueId: string, toColumn: Column) {
  const idx = issues.findIndex((i) => i.id === issueId);
  if (idx === -1) return;
  if (issues[idx].column === toColumn) return;

  const moved = await run(async () => {
    return dav.moveIssue(issues[idx], toColumn);
  });
  if (moved) {
    setIssues(idx, "column", toColumn);
  }
}

/** Delete an issue */
async function removeIssue(issue: Issue) {
  await run(async () => {
    await dav.deleteIssue(issue);
    setIssues((prev) => prev.filter((i) => i.id !== issue.id));
  });
}

/** Issues filtered by column (derived getter) */
function issuesByColumn(column: Column): Issue[] {
  return issues.filter((i) => i.column === column);
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

  // derived
  issuesByColumn,

  // modal actions
  openCreateModal,
  openEditModal,
  closeModal,

  // data actions
  init,
  addIssue,
  saveIssue,
  moveIssue,
  removeIssue,
  reload,
};
