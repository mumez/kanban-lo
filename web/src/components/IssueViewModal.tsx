import { type Component, Show, createMemo } from "solid-js";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { kanbanStore } from "../store/kanban";

const IssueViewModal: Component = () => {
  const html = createMemo(() => {
    const issue = kanbanStore.viewModal.issue;
    if (!issue) return "";
    return DOMPurify.sanitize(marked.parse(issue.content, { async: false }) as string);
  });

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

            <div class="prose max-w-none" innerHTML={html()} />

            <div class="modal-action mt-4">
              <button class="btn btn-ghost" onClick={() => kanbanStore.closeViewModal()}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Show>
  );
};

export default IssueViewModal;
