import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { DragDropProvider, DragDropSensors, SortableProvider } from "@thisbeyond/solid-dnd";
import IssueCard from "./IssueCard";
import { kanbanStore } from "../store/kanban";
import * as dav from "../services/webdav";
import type { Issue } from "../types";

vi.mock("../services/webdav");

const issue: Issue = {
  id: "1-fix-bug",
  subject: "Fix bug",
  content: "Details here",
  status: "todo",
};

// createSortable() requires a surrounding DragDropProvider + SortableProvider context.
function renderCard(cardIssue: Issue) {
  return render(() => (
    <DragDropProvider>
      <DragDropSensors>
        <SortableProvider ids={[cardIssue.id]}>
          <IssueCard issue={cardIssue} />
        </SortableProvider>
      </DragDropSensors>
    </DragDropProvider>
  ));
}

describe("IssueCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    kanbanStore.closeViewModal();
  });

  it("renders the subject and content", () => {
    renderCard(issue);
    expect(screen.getByText("Fix bug")).toBeInTheDocument();
    expect(screen.getByText("Details here")).toBeInTheDocument();
  });

  it("opens the view modal for this issue when View is clicked", () => {
    renderCard(issue);
    fireEvent.click(screen.getByTitle("View"));
    expect(kanbanStore.viewModal.open).toBe(true);
    expect(kanbanStore.viewModal.issue?.id).toBe(issue.id);
  });

  it("opens the edit modal for this issue when Edit is clicked", () => {
    renderCard(issue);
    fireEvent.click(screen.getByTitle("Edit"));
    expect(kanbanStore.modal.open).toBe(true);
    expect(kanbanStore.modal.mode).toBe("edit");
    expect(kanbanStore.modal.issue?.id).toBe(issue.id);
  });

  it("deletes the issue when Delete is confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(dav.deleteIssue).mockResolvedValue(undefined);

    renderCard(issue);
    fireEvent.click(screen.getByTitle("Delete"));

    await waitFor(() => expect(dav.deleteIssue).toHaveBeenCalledWith(issue));
  });

  it("does not delete the issue when the confirm dialog is dismissed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderCard(issue);
    fireEvent.click(screen.getByTitle("Delete"));

    expect(dav.deleteIssue).not.toHaveBeenCalled();
  });
});
