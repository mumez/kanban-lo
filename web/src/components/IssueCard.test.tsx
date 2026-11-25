import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import { DragDropProvider, DragDropSensors, SortableProvider } from "@thisbeyond/solid-dnd";
import IssueCard from "./IssueCard";
import { kanbanStore } from "../store/kanban";
import * as dav from "../services/webdav";
import { visibleLabel } from "../test/visible-label";
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

  it("links the pull request in a new tab when a PR URL is set", () => {
    renderCard({ ...issue, pr: "https://github.com/org/repo/pull/12" });

    const link = screen.getByRole("link", { name: /github\.com\/org\/repo\/pull\/12/ });
    expect(link).toHaveAttribute("href", "https://github.com/org/repo/pull/12");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAttribute("title", "https://github.com/org/repo/pull/12");
    expect(visibleLabel(link)).toBe("PR");
  });

  it("places the pull request button to the right of the project name", () => {
    renderCard({
      ...issue,
      project: "project-a",
      pr: "https://github.com/org/repo/pull/12",
    });

    const project = screen.getByText("project-a");
    const link = screen.getByRole("link", { name: /pull request/i });
    expect(project.parentElement).toBe(link.parentElement);
    expect(project.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("does not show a pull request link when the issue has none", () => {
    renderCard(issue);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not link a pull request value that is not an http URL", () => {
    renderCard({ ...issue, pr: "javascript:alert(1)" });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("copies the issue id to the clipboard when Copy ID is clicked", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    renderCard(issue);
    fireEvent.click(screen.getByTitle("Copy ID"));

    expect(writeText).toHaveBeenCalledWith(issue.id);
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

  it("archives the issue when Archive is confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(dav.archiveIssue).mockResolvedValue(undefined);

    renderCard(issue);
    fireEvent.click(screen.getByTitle("Archive"));

    await waitFor(() => expect(dav.archiveIssue).toHaveBeenCalledWith(issue));
  });

  it("does not archive the issue when the confirm dialog is dismissed", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderCard(issue);
    fireEvent.click(screen.getByTitle("Archive"));

    expect(dav.archiveIssue).not.toHaveBeenCalled();
  });
});
