import { type Component, For, Show } from "solid-js";
import { createDroppable } from "@thisbeyond/solid-dnd";
import type { Column } from "../types";
import { COLUMN_LABELS, COLUMN_COLORS } from "../types";
import { kanbanStore } from "../store/kanban";
import IssueCard from "./IssueCard";

interface Props {
  column: Column;
}

const KanbanColumn: Component<Props> = (props) => {
  const droppable = createDroppable(props.column);
  const issues = () => kanbanStore.issuesByColumn(props.column);

  return (
    <div
      use:droppable
      class="flex flex-col gap-3 min-h-[200px] rounded-xl p-3 bg-base-200 transition-colors"
      classList={{
        "ring-2 ring-primary ring-offset-1": droppable.isActiveDroppable,
        "bg-primary/5": droppable.isActiveDroppable,
      }}
    >
      {/* Column header */}
      <div class="flex items-center justify-between px-1">
        <div class="flex items-center gap-2">
          <span class={`badge badge-sm ${COLUMN_COLORS[props.column]}`}>
            {issues().length}
          </span>
          <h2 class="font-bold text-sm uppercase tracking-wide">
            {COLUMN_LABELS[props.column]}
          </h2>
        </div>
        <button
          class="btn btn-ghost btn-xs btn-circle"
          title={`Add to ${COLUMN_LABELS[props.column]}`}
          onClick={() => kanbanStore.openCreateModal(props.column)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Issue card list */}
      <div class="flex flex-col gap-2 flex-1">
        <For each={issues()}>
          {(issue) => <IssueCard issue={issue} />}
        </For>

        {/* Empty drop zone hint */}
        <Show when={issues().length === 0}>
          <div class="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-base-300 py-8 text-base-content/30 text-xs">
            Drop here
          </div>
        </Show>
      </div>
    </div>
  );
};

export default KanbanColumn;
