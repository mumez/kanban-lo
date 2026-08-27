import { type Component, Show } from "solid-js";
import { createDraggable } from "@thisbeyond/solid-dnd";
import type { Issue } from "../types";
import { kanbanStore } from "../store/kanban";

interface Props {
  issue: Issue;
}

const IssueCard: Component<Props> = (props) => {
  const draggable = createDraggable(props.issue.id, () => props.issue);

  return (
    <div
      use:draggable
      class="card bg-base-100 shadow-sm border border-base-300 cursor-grab active:cursor-grabbing"
      classList={{ "opacity-50": draggable.isActiveDraggable }}
    >
      <div class="card-body p-3 gap-2">
        {/* Title */}
        <h3 class="card-title text-sm font-semibold leading-snug break-words">
          {props.issue.subject}
        </h3>

        {/* Body preview */}
        <Show when={props.issue.content}>
          <p class="text-xs text-base-content/60 line-clamp-2 whitespace-pre-line">
            {props.issue.content}
          </p>
        </Show>

        {/* Action buttons */}
        <div class="card-actions justify-end mt-1">
          <button
            class="btn btn-ghost btn-xs"
            title="Edit"
            onClick={(e) => {
              e.stopPropagation();
              kanbanStore.openEditModal(props.issue);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            class="btn btn-ghost btn-xs text-error"
            title="Delete"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${props.issue.subject}"?`)) {
                kanbanStore.removeIssue(props.issue);
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IssueCard;
