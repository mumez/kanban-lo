import { type Component, Show, createMemo, createSignal, createEffect } from "solid-js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { kanbanStore } from "../store/kanban";

const IssueViewModal: Component = () => {
  const [editing, setEditing] = createSignal(false);
  const [editedContent, setEditedContent] = createSignal("");

  // Leave edit mode whenever a different issue is shown (or the modal closes)
  createEffect((prevId: string | null) => {
    const id = kanbanStore.viewModal.open ? kanbanStore.viewModal.issue?.id ?? null : null;
    if (id !== prevId) setEditing(false);
    return id;
  }, null);

  const html = createMemo(() => {
    const issue = kanbanStore.viewModal.issue;
    if (!issue) return "";
    return DOMPurify.sanitize(marked.parse(issue.content, { async: false }) as string);
  });

  const handleToggleEdit = async () => {
    const issue = kanbanStore.viewModal.issue;
    if (!issue) return;

    if (editing()) {
      await kanbanStore.saveIssue(issue.id, issue.subject, editedContent(), issue.project);
      const updated = kanbanStore.issues.find((i) => i.id === issue.id);
      if (updated) kanbanStore.openViewModal(updated);
      setEditing(false);
    } else {
      setEditedContent(issue.content);
      setEditing(true);
    }
  };

  return (
    <Show when={kanbanStore.viewModal.open && kanbanStore.viewModal.issue}>
      {(issue) => (
        <div
          class="modal modal-open"
          onClick={(e) => {
            if (e.target === e.currentTarget) kanbanStore.closeViewModal();
          }}
        >
          <div
            class="modal-box w-11/12 max-w-4xl"
            classList={{ "h-[80vh] flex flex-col": editing() }}
            onClick={(e) => e.stopPropagation()}
          >
            <div class="flex items-start justify-between mb-4">
              <div>
                <h3 class="font-bold text-2xl">{issue().subject}</h3>
                <Show when={issue().project}>
                  <span class="badge badge-ghost badge-sm mt-2">{issue().project}</span>
                </Show>
              </div>
              <button
                class="btn btn-ghost btn-sm btn-circle"
                onClick={() => kanbanStore.closeViewModal()}
              >
                ✕
              </button>
            </div>

            <Show
              when={editing()}
              fallback={<div class="prose max-w-none" innerHTML={html()} />}
            >
              <textarea
                class="textarea textarea-bordered w-full flex-1 font-mono text-sm"
                value={editedContent()}
                onInput={(e) => setEditedContent(e.currentTarget.value)}
              />
            </Show>

            <div class="modal-action mt-4">
              <button class="btn btn-ghost" onClick={() => kanbanStore.closeViewModal()}>
                Close
              </button>
              <button
                class="btn btn-primary"
                classList={{ loading: kanbanStore.loading }}
                disabled={kanbanStore.loading}
                onClick={handleToggleEdit}
              >
                {editing() ? "Save" : "Edit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default IssueViewModal;
