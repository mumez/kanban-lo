import { describe, expect, it } from "vitest";
import type { Column } from "./issue-format";
import { COLUMNS } from "./issue-format";
import {
  columnHeaderDroppableId,
  columnShowsDropHint,
  pickKanbanDroppable,
  resolveDrop,
  type DroppableBox,
} from "./kanban-drag";

const isColumn = (id: string | number) => (COLUMNS as readonly string[]).includes(String(id));

function box(id: string, x: number, y: number, width: number, height: number): DroppableBox {
  return { id, left: x, top: y, right: x + width, bottom: y + height };
}

/** Geometry measured from an 8-card column: the column center sits on a middle card. */
function filledColumn(column: string, originX: number): DroppableBox[] {
  const cards = Array.from({ length: 8 }, (_, index) =>
    box(`${column}-${index}`, originX + 12, 84 + index * 89, 197, 81)
  );
  return [
    box(column, originX, 40, 221, 762),
    box(columnHeaderDroppableId(column), originX + 12, 52, 197, 20),
    ...cards,
  ];
}

function pick(point: { x: number; y: number }, droppables: DroppableBox[], activeId?: string) {
  return pickKanbanDroppable(point, droppables, { isColumn, activeId });
}

describe("pickKanbanDroppable", () => {
  const columns = [...filledColumn("todo", 16), ...filledColumn("working", 253)];

  it("selects the column header while the pointer is on the title of a tall column", () => {
    // closestCenter would pick working-0 here: the header is nearer that card's
    // center than the column center, so the column itself never lights up.
    expect(pick({ x: 363, y: 62 }, columns)).toBe(columnHeaderDroppableId("working"));
  });

  it("selects the card under the pointer even when that point is nearer the column center", () => {
    // Column center is y=421, inside working-3 (top 351, bottom 432).
    expect(pick({ x: 363, y: 397 }, columns)).toBe("working-3");
  });

  it("selects the nearest card in a gap instead of appending to the column", () => {
    expect(pick({ x: 363, y: 437 }, columns)).toBe("working-4");
  });

  it("appends when the pointer is inside the column below the last card", () => {
    expect(pick({ x: 363, y: 795 }, columns)).toBe("working");
  });

  it("inserts at the top when the pointer is in the column above every card", () => {
    expect(pick({ x: 270, y: 48 }, columns)).toBe(columnHeaderDroppableId("working"));
  });

  it("selects an empty column the pointer is inside", () => {
    const empty = [box("pending", 16, 40, 221, 200)];
    expect(pick({ x: 80, y: 120 }, empty)).toBe("pending");
  });

  it("falls back to the nearest card when the pointer is in the gap between columns", () => {
    expect(pick({ x: 240, y: 124 }, columns)).toBe("todo-0");
  });
});

describe("resolveDrop", () => {
  const columns: Column[] = ["todo", "working"];
  const ids: Partial<Record<Column, string[]>> = {
    todo: ["a", "b"],
    working: ["c"],
  };
  const issueIdsIn = (column: Column) => ids[column] ?? [];

  it("inserts at the top of the column for a header drop", () => {
    expect(resolveDrop(columnHeaderDroppableId("working"), columns, issueIdsIn)).toEqual({
      column: "working",
      toIndex: 0,
    });
  });

  it("appends for a column drop", () => {
    expect(resolveDrop("todo", columns, issueIdsIn)).toEqual({ column: "todo", toIndex: 2 });
  });

  it("inserts at the hovered card's index", () => {
    expect(resolveDrop("b", columns, issueIdsIn)).toEqual({ column: "todo", toIndex: 1 });
  });

  it("ignores a droppable that belongs to a hidden column", () => {
    expect(resolveDrop(columnHeaderDroppableId("done"), columns, issueIdsIn)).toBeUndefined();
    expect(resolveDrop("missing", columns, issueIdsIn)).toBeUndefined();
  });
});

describe("columnShowsDropHint", () => {
  it("lights the column for its own header, its body, and its cards", () => {
    expect(columnShowsDropHint("working", columnHeaderDroppableId("working"), ["c"])).toBe(true);
    expect(columnShowsDropHint("working", "working", ["c"])).toBe(true);
    expect(columnShowsDropHint("working", "c", ["c"])).toBe(true);
  });

  it("stays off when the active droppable is in another column", () => {
    expect(columnShowsDropHint("working", "a", ["c"])).toBe(false);
    expect(columnShowsDropHint("working", columnHeaderDroppableId("todo"), ["c"])).toBe(false);
  });
});
