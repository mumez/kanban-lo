import type { Column } from "./issue-format";
import { COLUMNS } from "./issue-format";

/**
 * Drop-target geometry for the board.
 *
 * `@thisbeyond/solid-dnd`'s `closestCenter` compares the drag point to each
 * droppable's center. A column droppable is the whole column, so once it
 * holds enough cards its center sits in the middle of the stack. The purple
 * column highlight (`isActiveDroppable`) then only appears in a thin band
 * around that center, and a drag over the title lands on a card with no
 * highlight at all. Shrinking the viewport brings that band back on screen,
 * which is why the drop zone seems to return when the window is smaller.
 *
 * Hit testing here uses the rectangle under the pointer. The title is its
 * own droppable (insert at the top). A card under the pointer wins over the
 * column even when the column center is nearer. Empty space below the last
 * card appends.
 */

const HEADER_PREFIX = "top:";

const COLUMN_IDS: ReadonlySet<string> = new Set(COLUMNS);

export interface DroppableBox {
  id: string | number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface DropPoint {
  x: number;
  y: number;
}

export function columnHeaderDroppableId(column: string): string {
  return `${HEADER_PREFIX}${column}`;
}

function columnOfHeaderDroppable(id: string | number): string | undefined {
  const value = String(id);
  if (!value.startsWith(HEADER_PREFIX)) return undefined;
  return value.slice(HEADER_PREFIX.length);
}

function isColumnDroppableId(id: string | number): boolean {
  return COLUMN_IDS.has(String(id));
}

function area(box: DroppableBox): number {
  return Math.max(0, box.right - box.left) * Math.max(0, box.bottom - box.top);
}

function contains(box: DroppableBox, point: DropPoint): boolean {
  return point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
}

function centerOf(box: DroppableBox): DropPoint {
  return { x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 };
}

function distance(first: DropPoint, second: DropPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/** Lowest score wins. An exact tie keeps the droppable already under the pointer. */
function bestBy(
  boxes: readonly DroppableBox[],
  score: (box: DroppableBox) => number,
  activeId: string | number | null | undefined
): DroppableBox {
  let best = boxes[0];
  let bestScore = score(best);
  for (const candidate of boxes.slice(1)) {
    const candidateScore = score(candidate);
    if (candidateScore < bestScore || (candidateScore === bestScore && candidate.id === activeId)) {
      best = candidate;
      bestScore = candidateScore;
    }
  }
  return best;
}

function cardsIn(column: DroppableBox, boxes: readonly DroppableBox[]): DroppableBox[] {
  return boxes.filter((box) => {
    if (isColumnDroppableId(box.id) || columnOfHeaderDroppable(box.id)) return false;
    return contains(column, centerOf(box));
  });
}

export function pickKanbanDroppable(
  point: DropPoint,
  droppables: readonly DroppableBox[],
  options: {
    isColumn: (id: string | number) => boolean;
    activeId?: string | number | null;
  }
): string | number | null {
  const live = droppables.filter((box) => area(box) > 0);
  if (live.length === 0) return null;

  const containing = live.filter((box) => contains(box, point));
  const specific = containing.filter((box) => !options.isColumn(box.id));
  if (specific.length > 0) {
    return bestBy(specific, area, options.activeId).id;
  }

  const columns = containing.filter((box) => options.isColumn(box.id));
  if (columns.length > 0) {
    const column = bestBy(columns, area, options.activeId);
    const cards = cardsIn(column, live);
    if (cards.length === 0) return column.id;

    const firstTop = Math.min(...cards.map((card) => card.top));
    const lastBottom = Math.max(...cards.map((card) => card.bottom));
    if (point.y >= lastBottom) return column.id;
    if (point.y <= firstTop) {
      const header = live.find((box) => columnOfHeaderDroppable(box.id) === String(column.id));
      return header?.id ?? column.id;
    }
    return bestBy(cards, (card) => distance(point, centerOf(card)), options.activeId).id;
  }

  const targets = live.filter((box) => !options.isColumn(box.id));
  const pool = targets.length > 0 ? targets : live;
  return bestBy(pool, (box) => distance(point, centerOf(box)), options.activeId).id;
}

export interface CollisionDraggable {
  transformed: { center: DropPoint };
}

export interface CollisionDroppable {
  id: string | number;
  layout: { left: number; top: number; right: number; bottom: number };
}

/** Adapter from solid-dnd's collision callback to {@link pickKanbanDroppable}. */
export function detectKanbanCollision<T extends CollisionDroppable>(
  draggable: CollisionDraggable,
  droppables: readonly (T | null | undefined)[],
  activeId: string | number | null
): T | null {
  const boxes: DroppableBox[] = [];
  const byId = new Map<string | number, T>();
  for (const droppable of droppables) {
    if (!droppable) continue;
    const { left, top, right, bottom } = droppable.layout;
    boxes.push({ id: droppable.id, left, top, right, bottom });
    byId.set(droppable.id, droppable);
  }
  const id = pickKanbanDroppable(draggable.transformed.center, boxes, {
    isColumn: isColumnDroppableId,
    activeId,
  });
  if (id == null) return null;
  return byId.get(id) ?? null;
}

export function resolveDrop(
  droppableId: string,
  columns: readonly Column[],
  issueIdsIn: (column: Column) => readonly string[]
): { column: Column; toIndex: number } | undefined {
  const headerColumn = columnOfHeaderDroppable(droppableId);
  if (headerColumn) {
    if (!(columns as readonly string[]).includes(headerColumn)) return undefined;
    return { column: headerColumn as Column, toIndex: 0 };
  }

  if ((columns as readonly string[]).includes(droppableId)) {
    const column = droppableId as Column;
    return { column, toIndex: issueIdsIn(column).length };
  }

  const column = columns.find((candidate) => issueIdsIn(candidate).includes(droppableId));
  if (!column) return undefined;
  return { column, toIndex: issueIdsIn(column).indexOf(droppableId) };
}

export function columnShowsDropHint(
  column: string,
  activeId: string | number,
  cardIds: readonly string[]
): boolean {
  if (activeId === column || activeId === columnHeaderDroppableId(column)) return true;
  return cardIds.includes(String(activeId));
}
