import { type Component, createSignal, createEffect, Show, untrack } from "solid-js";
import { kanbanStore } from "../store/kanban";
import { COLUMN_LABELS } from "../types";
import type { Column } from "../types";

const IssueModal: Component = () => {
  const [subject, setSubject] = createSignal("");
  const [content, setContent] = createSignal("");
  const [targetColumn, setTargetColumn] = createSignal<Column>("todo");
  const [project, setProject] = createSignal("");
  const [workingDir, setWorkingDir] = createSignal("");
  const [specLevel, setSpecLevel] = createSignal("");
  const [pr, setPr] = createSignal("");
  const [sessionId, setSessionId] = createSignal("");

  /**
   * A column the form may target. A hidden choice snaps to the default
   * create column, except when editing an issue that already lives there —
   * hiding its column must not move it.
   */
  function columnToShow(target: Column): Column {
    if (kanbanStore.visibleColumns.includes(target)) return target;
    const issue = kanbanStore.modal.issue;
    if (kanbanStore.modal.mode === "edit" && issue) return issue.status;
    return kanbanStore.defaultCreateColumn;
  }

  // Prefill fields whenever the modal opens. Visibility is read untracked so
  // a settings reload does not wipe the title and body.
  createEffect(() => {
    if (kanbanStore.modal.open) {
      if (kanbanStore.modal.mode === "edit" && kanbanStore.modal.issue) {
        setSubject(kanbanStore.modal.issue.subject);
        setContent(kanbanStore.modal.issue.content);
        setTargetColumn(kanbanStore.modal.issue.status);
        setProject(kanbanStore.modal.issue.project ?? "");
        setWorkingDir(kanbanStore.modal.issue.workingDir ?? "");
        setSpecLevel(kanbanStore.modal.issue.specLevel ?? "");
        setPr(kanbanStore.modal.issue.pr ?? "");
        setSessionId(kanbanStore.modal.issue.sessionId ?? "");
      } else {
        setSubject("");
        setContent("");
        const requested = kanbanStore.modal.column;
        setTargetColumn(untrack(() => columnToShow(requested)));
        setProject(kanbanStore.selectedProject ?? "");
        setWorkingDir("");
        setSpecLevel("");
        setPr("");
        setSessionId("");
      }
    }
  });

  // If the selected column is hidden while the form is open, move the
  // selection onto a column the user can still see. Leave the other fields.
  createEffect(() => {
    if (!kanbanStore.modal.open) return;
    const target = targetColumn();
    const resolved = columnToShow(target);
    if (resolved !== target) setTargetColumn(resolved);
  });

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const s = subject().trim();
    if (!s) return;
    const p = project() || undefined;
    const column = columnToShow(targetColumn());

    if (kanbanStore.modal.mode === "create") {
      await kanbanStore.addIssue(column, s, content().trim(), p);
    } else if (kanbanStore.modal.issue) {
      const issue = kanbanStore.modal.issue;
      // Move first if the column changed, then update content
      if (issue.status !== column) {
        await kanbanStore.moveIssue(issue.id, column);
      }
      await kanbanStore.saveIssue(issue.id, s, content().trim(), {
        project: p,
        workingDir: workingDir().trim() || undefined,
        specLevel: specLevel().trim() || undefined,
        pr: pr().trim() || undefined,
        sessionId: sessionId().trim() || undefined,
      });
    }

    kanbanStore.closeModal();
  };

  const isCreate = () => kanbanStore.modal.mode === "create";

  return (
    <Show when={kanbanStore.modal.open}>
      {/* Backdrop. Create can be dismissed from here. Edit cannot — an
          accidental click would discard the draft. */}
      <div
        class="modal modal-open"
        onClick={(e) => {
          if (e.target === e.currentTarget && isCreate()) kanbanStore.closeModal();
        }}
      >
        <div
          class="modal-box flex flex-col !overflow-hidden"
          classList={{
            "w-full max-w-lg": isCreate(),
            // Extra edit fields sit beside the body. A wide, tall dialog keeps
            // the content area from being squeezed by them.
            "h-[85vh] w-11/12 max-w-6xl": !isCreate(),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between mb-4 shrink-0">
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

          <form onSubmit={handleSubmit} class="flex min-h-0 flex-1 flex-col gap-4">
            <div
              class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
              classList={{
                "lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden":
                  !isCreate(),
              }}
            >
              {/* Title */}
              <div class="form-control" classList={{ "lg:col-span-2": !isCreate() }}>
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

              {/* Body. While editing, this fills the space beside the extra fields. */}
              <div class="form-control" classList={{ "min-h-48 lg:h-full lg:min-h-0": !isCreate() }}>
                <label class="label shrink-0">
                  <span class="label-text font-medium">Content</span>
                  <span class="label-text-alt text-base-content/50">Markdown</span>
                </label>
                <textarea
                  class="textarea textarea-bordered w-full font-mono text-sm"
                  classList={{ "min-h-48 flex-1 lg:min-h-0": !isCreate() }}
                  rows={isCreate() ? 5 : 12}
                  placeholder="Enter details... (Markdown supported)"
                  value={content()}
                  onInput={(e) => setContent(e.currentTarget.value)}
                />
              </div>

              <div class="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
                {/* Column select */}
                <div class="form-control">
                  <label class="label" classList={{ "py-0": !isCreate() }}>
                    <span class="label-text font-medium">Column</span>
                  </label>
                  <select
                    class="select select-bordered w-full"
                    aria-label="Column"
                    value={targetColumn()}
                    onChange={(e) => setTargetColumn(e.currentTarget.value as Column)}
                  >
                    {kanbanStore.visibleColumns.map((col) => (
                      <option value={col}>{COLUMN_LABELS[col]}</option>
                    ))}
                  </select>
                </div>

                {/* Project select */}
                <Show when={kanbanStore.projects.length > 0}>
                  <div class="form-control">
                    <label class="label" classList={{ "py-0": !isCreate() }}>
                      <span class="label-text font-medium">Project</span>
                    </label>
                    <select
                      class="select select-bordered w-full"
                      aria-label="Project"
                      value={project()}
                      onChange={(e) => setProject(e.currentTarget.value)}
                    >
                      <option value="">(none)</option>
                      {kanbanStore.projects.map((p) => (
                        <option value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </Show>

                {/* Optional work context and links, only once the issue exists.
                    Two columns so they fit beside the content area. */}
                <Show when={!isCreate()}>
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div class="form-control">
                      <label class="label py-0" for="issue-working-dir">
                        <span class="label-text font-medium">Working Dir</span>
                      </label>
                      <input
                        id="issue-working-dir"
                        type="text"
                        class="input input-bordered w-full"
                        placeholder="/path/to/repo"
                        value={workingDir()}
                        onInput={(e) => setWorkingDir(e.currentTarget.value)}
                      />
                    </div>

                    <div class="form-control">
                      <label class="label py-0" for="issue-spec-level">
                        <span class="label-text font-medium">Spec Level</span>
                      </label>
                      <input
                        id="issue-spec-level"
                        type="text"
                        class="input input-bordered w-full"
                        value={specLevel()}
                        onInput={(e) => setSpecLevel(e.currentTarget.value)}
                      />
                    </div>

                    <div class="form-control sm:col-span-2">
                      <label class="label py-0" for="issue-pr">
                        <span class="label-text font-medium">PR URL</span>
                      </label>
                      <input
                        id="issue-pr"
                        type="text"
                        class="input input-bordered w-full"
                        placeholder="https://..."
                        value={pr()}
                        onInput={(e) => setPr(e.currentTarget.value)}
                      />
                    </div>

                    <div class="form-control sm:col-span-2">
                      <label class="label py-0" for="issue-session-id">
                        <span class="label-text font-medium">Session ID</span>
                      </label>
                      <input
                        id="issue-session-id"
                        type="text"
                        class="input input-bordered w-full"
                        placeholder="Agent session id"
                        value={sessionId()}
                        onInput={(e) => setSessionId(e.currentTarget.value)}
                      />
                    </div>
                  </div>
                </Show>

                {/* Error display */}
                <Show when={kanbanStore.error}>
                  <div class="alert alert-error text-sm">
                    <span>{kanbanStore.error}</span>
                  </div>
                </Show>
              </div>

            </div>

            {/* Action buttons stay in view while the fields scroll */}
            <div class="modal-action mt-0 shrink-0">
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
