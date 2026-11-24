import { type Component, createSignal, createEffect, Show, untrack } from "solid-js";
import { kanbanStore } from "../store/kanban";
import { COLUMN_LABELS } from "../types";
import type { Column } from "../types";
import IssueEditContextFields from "./IssueEditContextFields";

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
          class={
            isCreate()
              ? "modal-box flex w-full max-w-lg flex-col !overflow-hidden"
              : "modal-box flex h-[85vh] w-11/12 max-w-6xl flex-col !overflow-hidden"
          }
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
            <Show
              when={isCreate()}
              fallback={
                <div class="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden">
                  <TitleField subject={subject()} onSubject={setSubject} class="lg:col-span-2" />
                  <ContentField
                    content={content()}
                    onContent={setContent}
                    rows={12}
                    class="min-h-48 lg:h-full lg:min-h-0"
                    textareaClass="min-h-48 flex-1 lg:min-h-0"
                  />
                  <div class="flex min-h-0 flex-col gap-4 lg:overflow-y-auto">
                    <ColumnField
                      targetColumn={targetColumn()}
                      onTargetColumn={setTargetColumn}
                      labelClass="label py-0"
                    />
                    <ProjectField project={project()} onProject={setProject} labelClass="label py-0" />
                    <IssueEditContextFields
                      workingDir={workingDir()}
                      specLevel={specLevel()}
                      pr={pr()}
                      sessionId={sessionId()}
                      onWorkingDir={setWorkingDir}
                      onSpecLevel={setSpecLevel}
                      onPr={setPr}
                      onSessionId={setSessionId}
                    />
                    <FormError />
                  </div>
                </div>
              }
            >
              <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
                <TitleField subject={subject()} onSubject={setSubject} />
                <ContentField content={content()} onContent={setContent} rows={5} />
                <ColumnField targetColumn={targetColumn()} onTargetColumn={setTargetColumn} />
                <ProjectField project={project()} onProject={setProject} />
                <FormError />
              </div>
            </Show>

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

function TitleField(props: { subject: string; onSubject: (value: string) => void; class?: string }) {
  return (
    <div class={`form-control ${props.class ?? ""}`}>
      <label class="label">
        <span class="label-text font-medium">Title <span class="text-error">*</span></span>
      </label>
      <input
        type="text"
        class="input input-bordered w-full"
        placeholder="Enter issue title..."
        value={props.subject}
        onInput={(e) => props.onSubject(e.currentTarget.value)}
        autofocus
        required
      />
    </div>
  );
}

function ContentField(props: {
  content: string;
  onContent: (value: string) => void;
  rows: number;
  class?: string;
  textareaClass?: string;
}) {
  return (
    <div class={`form-control ${props.class ?? ""}`}>
      <label class="label shrink-0">
        <span class="label-text font-medium">Content</span>
        <span class="label-text-alt text-base-content/50">Markdown</span>
      </label>
      <textarea
        class={`textarea textarea-bordered w-full font-mono text-sm ${props.textareaClass ?? ""}`}
        rows={props.rows}
        placeholder="Enter details... (Markdown supported)"
        value={props.content}
        onInput={(e) => props.onContent(e.currentTarget.value)}
      />
    </div>
  );
}

function ColumnField(props: {
  targetColumn: Column;
  onTargetColumn: (column: Column) => void;
  labelClass?: string;
}) {
  return (
    <div class="form-control">
      <label class={props.labelClass ?? "label"}>
        <span class="label-text font-medium">Column</span>
      </label>
      <select
        class="select select-bordered w-full"
        aria-label="Column"
        value={props.targetColumn}
        onChange={(e) => props.onTargetColumn(e.currentTarget.value as Column)}
      >
        {kanbanStore.visibleColumns.map((col) => (
          <option value={col}>{COLUMN_LABELS[col]}</option>
        ))}
      </select>
    </div>
  );
}

function ProjectField(props: {
  project: string;
  onProject: (project: string) => void;
  labelClass?: string;
}) {
  return (
    <Show when={kanbanStore.projects.length > 0}>
      <div class="form-control">
        <label class={props.labelClass ?? "label"}>
          <span class="label-text font-medium">Project</span>
        </label>
        <select
          class="select select-bordered w-full"
          aria-label="Project"
          value={props.project}
          onChange={(e) => props.onProject(e.currentTarget.value)}
        >
          <option value="">(none)</option>
          {kanbanStore.projects.map((p) => (
            <option value={p}>{p}</option>
          ))}
        </select>
      </div>
    </Show>
  );
}

function FormError() {
  return (
    <Show when={kanbanStore.error}>
      <div class="alert alert-error text-sm">
        <span>{kanbanStore.error}</span>
      </div>
    </Show>
  );
}

export default IssueModal;
