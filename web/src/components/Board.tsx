import { type Component, For } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  type DragEventHandler,
} from "@thisbeyond/solid-dnd";
import type { Column } from "../types";
import { COLUMNS } from "../types";
import { kanbanStore } from "../store/kanban";
import KanbanColumn from "./KanbanColumn";

const Board: Component = () => {
  const handleDragEnd: DragEventHandler = ({ draggable, droppable }) => {
    if (!draggable || !droppable) return;
    const issueId = draggable.id as string;
    const toColumn = droppable.id as Column;
    kanbanStore.moveIssue(issueId, toColumn);
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>
      <DragDropSensors>
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 p-4">
          <For each={COLUMNS}>
            {(column) => <KanbanColumn column={column} />}
          </For>
        </div>

        {/* Ghost overlay while dragging */}
        <DragOverlay>
          {(draggable) => {
            const issue = draggable?.data as { subject: string } | undefined;
            return (
              <div class="card bg-base-100 shadow-xl border border-primary w-64 rotate-2 scale-105">
                <div class="card-body p-3">
                  <p class="text-sm font-semibold">{issue?.subject ?? ""}</p>
                </div>
              </div>
            );
          }}
        </DragOverlay>
      </DragDropSensors>
    </DragDropProvider>
  );
};

export default Board;
