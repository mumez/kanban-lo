import { type Component, For } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  type CollisionDetector,
  type DragEventHandler,
} from "@thisbeyond/solid-dnd";
import { kanbanStore } from "../store/kanban";
import { detectKanbanCollision, resolveDrop } from "../lib/kanban-drag";
import KanbanColumn from "./KanbanColumn";

/**
 * Wide-screen tracks, keyed by how many columns are shown. A count below the
 * smallest key uses that key; a count above the largest uses that key. The
 * next column is one new entry here.
 */
const WIDE_SCREEN_TRACK_CLASS: Record<number, string> = {
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

const WIDE_SCREEN_TRACK_COUNTS = Object.keys(WIDE_SCREEN_TRACK_CLASS).map(Number);
const MIN_WIDE_SCREEN_TRACKS = Math.min(...WIDE_SCREEN_TRACK_COUNTS);

function wideScreenTrackClass(columnCount: number): string {
  const fitting = WIDE_SCREEN_TRACK_COUNTS.filter((count) => count <= columnCount);
  const tracks = fitting.length > 0 ? Math.max(...fitting) : MIN_WIDE_SCREEN_TRACKS;
  return WIDE_SCREEN_TRACK_CLASS[tracks];
}

const collisionDetector: CollisionDetector = (draggable, droppables, context) =>
  detectKanbanCollision(draggable, droppables, context.activeDroppableId);

const Board: Component = () => {
  const handleDragEnd: DragEventHandler = ({ draggable, droppable }) => {
    if (!draggable || !droppable) return;
    const resolved = resolveDrop(String(droppable.id), kanbanStore.visibleColumns, (column) =>
      kanbanStore.issuesByColumn(column).map((issue) => issue.id)
    );
    if (!resolved) return;
    kanbanStore.reorderIssue(String(draggable.id), resolved.column, resolved.toIndex);
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd} collisionDetector={collisionDetector}>
      <DragDropSensors>
        <div
          class={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 ${wideScreenTrackClass(kanbanStore.visibleColumns.length)}`}
        >
          <For each={kanbanStore.visibleColumns}>
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
