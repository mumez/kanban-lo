import { type Component, Show } from "solid-js";
import { createSortable } from "@thisbeyond/solid-dnd";
import type { Issue } from "../types";
import { kanbanStore } from "../store/kanban";
import IssueProjectRow from "./IssueProjectRow";

interface Props {
  issue: Issue;
}

/** Spec level that means the specification is clear and the issue is ready for an AI agent. */
const AI_READY_SPEC_LEVEL = "clear";

const IssueCard: Component<Props> = (props) => {
  const sortable = createSortable(props.issue.id, { subject: props.issue.subject });

  return (
    <div
      use:sortable
      class="card bg-base-100 shadow-sm border border-base-300 cursor-grab active:cursor-grabbing"
      classList={{ "opacity-50": sortable.isActiveDraggable }}
    >
      <div class="card-body p-3 gap-2">
        {/* Title. The sparkle stays outside the heading so the subject name is unchanged. */}
        <div class="flex items-start gap-1.5">
          <h3 class="card-title min-w-0 flex-1 text-sm font-semibold leading-snug break-words">
            {props.issue.subject}
          </h3>
          <Show when={props.issue.specLevel === AI_READY_SPEC_LEVEL}>
            <span
              class="badge badge-warning mt-0.5 shrink-0 px-1"
              role="img"
              aria-label="AI ready"
              title="AI ready"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M15.98 1.804a1 1 0 0 0-1.96 0l-.24 1.192a1 1 0 0 1-.784.785l-1.192.238a1 1 0 0 0 0 1.962l1.192.238a1 1 0 0 1 .785.785l.238 1.192a1 1 0 0 0 1.962 0l.238-1.192a1 1 0 0 1 .785-.785l1.192-.238a1 1 0 0 0 0-1.962l-1.192-.238a1 1 0 0 1-.785-.785l-.238-1.192ZM6.949 5.684a1 1 0 0 0-1.898 0l-.683 2.051a1 1 0 0 1-.633.633l-2.051.683a1 1 0 0 0 0 1.898l2.051.684a1 1 0 0 1 .633.632l.683 2.051a1 1 0 0 0 1.898 0l.683-2.051a1 1 0 0 1 .633-.633l2.051-.683a1 1 0 0 0 0-1.898l-2.051-.683a1 1 0 0 1-.633-.633L6.95 5.684ZM13.949 13.684a1 1 0 0 0-1.898 0l-.184.551a1 1 0 0 1-.632.633l-.551.183a1 1 0 0 0 0 1.898l.551.183a1 1 0 0 1 .633.633l.183.551a1 1 0 0 0 1.898 0l.184-.551a1 1 0 0 1 .632-.633l.551-.183a1 1 0 0 0 0-1.898l-.551-.184a1 1 0 0 1-.633-.632l-.183-.551Z" />
              </svg>
            </span>
          </Show>
        </div>

        <IssueProjectRow project={props.issue.project} pr={props.issue.pr} />

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
            title="Copy ID"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(props.issue.id);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7 3a1 1 0 00-1 1v1H5a2 2 0 00-2 2v8a2 2 0 002 2h7a2 2 0 002-2v-1h1a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 00-1-1H7zm5 3V4H8v2h4zm2 1v8H5V7h9zM8 4h4v2H8V4z" />
            </svg>
          </button>
          <button
            class="btn btn-ghost btn-xs"
            title="View"
            onClick={(e) => {
              e.stopPropagation();
              kanbanStore.openViewModal(props.issue);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
            </svg>
          </button>
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
            class="btn btn-ghost btn-xs"
            title="Archive"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Archive "${props.issue.subject}"?`)) {
                kanbanStore.archiveIssue(props.issue);
              }
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4 3a1 1 0 00-1 1v2a1 1 0 001 1v8a2 2 0 002 2h8a2 2 0 002-2V7a1 1 0 001-1V4a1 1 0 00-1-1H4zm2 4h8v8H6V7zm2 2v4h4V9H8z" />
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
