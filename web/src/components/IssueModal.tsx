import { type Component, createSignal, createEffect, Show } from "solid-js";
import { kanbanStore } from "../store/kanban";
import { COLUMN_LABELS, COLUMNS } from "../types";
import type { Column } from "../types";

const IssueModal: Component = () => {
  const [subject, setSubject] = createSignal("");
  const [content, setContent] = createSignal("");
  const [targetColumn, setTargetColumn] = createSignal<Column>("todo");

  // Prefill fields whenever the modal opens
  createEffect(() => {
    if (kanbanStore.modal.open) {
      if (kanbanStore.modal.mode === "edit" && kanbanStore.modal.issue) {
        setSubject(kanbanStore.modal.issue.subject);
        setContent(kanbanStore.modal.issue.content);
        setTargetColumn(kanbanStore.modal.issue.column);
      } else {
        setSubject("");
        setContent("");
        setTargetColumn(kanbanStore.modal.column);
      }
    }
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const s = subject().trim();
    if (!s) return;

    if (kanbanStore.modal.mode === "create") {
      await kanbanStore.addIssue(targetColumn(), s, content().trim());
    } else if (kanbanStore.modal.issue) {
      const issue = kanbanStore.modal.issue;
      // Move first if the column changed, then update content
      if (issue.column !== targetColumn()) {
        await kanbanStore.moveIssue(issue.id, targetColumn());
      }
      await kanbanStore.saveIssue(issue.id, s, content().trim());
    }

    kanbanStore.closeModal();
  };

  const isCreate = () => kanbanStore.modal.mode === "create";

  return (
    <Show when={kanbanStore.modal.open}>
      {/* Backdrop */}
      <div
        class="modal modal-open"
        onClick={(e) => {
          if (e.target === e.currentTarget) kanbanStore.closeModal();
        }}
      >
        <div class="modal-box w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div class="flex items-center justify-between mb-4">
            <h3 class="font-bold text-lg">
              {isCreate() ? "New Issue" : "Edit Issue"}
            </h3>
            <button
              class="btn btn-ghost btn-sm btn-circle"
              onClick={() => kanbanStore.closeModal()}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} class="flex flex-col gap-4">
            {/* Title */}
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Title <span class="text-error">*</span></span>
              </label>
              <input
                type="text"
                class="input input-bordered w-full"
                placeholder="Enter issue title..."
                value={subject()}
                onInput={(e) => setSubject(e.currentTarget.value)}
                autofocus
                required
              />
            </div>

            {/* Body */}
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Content</span>
                <span class="label-text-alt text-base-content/50">Markdown</span>
              </label>
              <textarea
                class="textarea textarea-bordered w-full font-mono text-sm"
                rows={6}
                placeholder="Enter details... (Markdown supported)"
                value={content()}
                onInput={(e) => setContent(e.currentTarget.value)}
              />
            </div>

            {/* Column select */}
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Column</span>
              </label>
              <select
                class="select select-bordered w-full"
                value={targetColumn()}
                onChange={(e) => setTargetColumn(e.currentTarget.value as Column)}
              >
                {COLUMNS.map((col) => (
                  <option value={col}>{COLUMN_LABELS[col]}</option>
                ))}
              </select>
            </div>

            {/* Error display */}
            <Show when={kanbanStore.error}>
              <div class="alert alert-error text-sm">
                <span>{kanbanStore.error}</span>
              </div>
            </Show>

            {/* Action buttons */}
            <div class="modal-action mt-2">
              <button
                type="button"
                class="btn btn-ghost"
                onClick={() => kanbanStore.closeModal()}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                classList={{ loading: kanbanStore.loading }}
                disabled={kanbanStore.loading || !subject().trim()}
              >
                {isCreate() ? "Create" : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Show>
  );
};

export default IssueModal;
