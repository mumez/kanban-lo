import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { DragDropProvider, DragDropSensors } from "@thisbeyond/solid-dnd";
import KanbanColumn from "./KanbanColumn";
import { kanbanStore } from "../store/kanban";
import * as dav from "../services/webdav";
import type { Column } from "../types";

vi.mock("../services/webdav");

// createDroppable() requires a surrounding DragDropProvider context.
function renderColumn(column: Column) {
  return render(() => (
    <DragDropProvider>
      <DragDropSensors>
        <KanbanColumn column={column} />
      </DragDropSensors>
    </DragDropProvider>
  ));
}

describe("KanbanColumn", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    vi.mocked(dav.loadAllIssues).mockResolvedValue([]);
    await kanbanStore.reload();
  });

  it("shows an empty drop hint and a zero count when there are no issues", () => {
    renderColumn("todo");
    expect(screen.getByText("Drop here")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("lists only the issues belonging to this column, with the correct count", async () => {
    vi.mocked(dav.loadAllIssues).mockResolvedValue([
      { id: "1", subject: "In todo", content: "", column: "todo" },
      { id: "2", subject: "In working", content: "", column: "working" },
    ]);
    await kanbanStore.reload();

    renderColumn("todo");
    expect(screen.getByText("In todo")).toBeInTheDocument();
    expect(screen.queryByText("In working")).not.toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("opens the create modal for this column when the + button is clicked", () => {
    renderColumn("working");
    fireEvent.click(screen.getByTitle("Add to Working"));
    expect(kanbanStore.modal.open).toBe(true);
    expect(kanbanStore.modal.mode).toBe("create");
    expect(kanbanStore.modal.column).toBe("working");
  });
});
