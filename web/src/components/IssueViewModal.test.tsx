import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@solidjs/testing-library";
import IssueViewModal from "./IssueViewModal";
import { kanbanStore } from "../store/kanban";
import * as dav from "../services/webdav";
import type { Issue } from "../types";

vi.mock("../services/webdav");

const issue: Issue = {
  id: "1-fix-bug",
  subject: "Fix bug",
  content: "# Heading\n\nSome **bold** text.",
  status: "todo",
  project: "project-a",
};

/** saveIssue only acts on issues already present in the store, so the edit
 *  test must seed the store before opening the view modal. */
async function seedAndOpen(seedIssue: Issue) {
  vi.mocked(dav.loadAllIssues).mockResolvedValue([seedIssue]);
  await kanbanStore.reload();
  kanbanStore.openViewModal(kanbanStore.issues[0]);
}

describe("IssueViewModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeViewModal();
  });

  it("renders nothing when closed", () => {
    render(() => <IssueViewModal />);
    expect(screen.queryByText("Fix bug")).not.toBeInTheDocument();
  });

  it("shows the subject, project badge and rendered Markdown content when open", () => {
    kanbanStore.openViewModal(issue);
    render(() => <IssueViewModal />);

    expect(screen.getByText("Fix bug")).toBeInTheDocument();
    expect(screen.getByText("project-a")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Heading" })).toBeInTheDocument();
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("strips raw script tags from the rendered content", () => {
    kanbanStore.openViewModal({ ...issue, content: '<script>window.xss = true</script>Safe text' });
    render(() => <IssueViewModal />);

    expect(document.querySelector("script")).not.toBeInTheDocument();
    expect(screen.getByText("Safe text")).toBeInTheDocument();
  });

  it("closes when the close button is clicked", () => {
    kanbanStore.openViewModal(issue);
    render(() => <IssueViewModal />);

    screen.getByText("Close").click();

    expect(kanbanStore.viewModal.open).toBe(false);
  });

  it("toggles into edit mode showing the raw Markdown in a textarea", async () => {
    kanbanStore.openViewModal(issue);
    const { container } = render(() => <IssueViewModal />);

    screen.getByText("Edit").click();

    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe(issue.content);
    expect(screen.getByText("Save")).toBeInTheDocument();
  });

  it("saves the edited content and returns to view mode when toggled again", async () => {
    vi.mocked(dav.updateIssue).mockResolvedValue(undefined);
    await seedAndOpen(issue);
    const { container } = render(() => <IssueViewModal />);

    screen.getByText("Edit").click();
    await waitFor(() => expect(screen.getByRole("textbox")).toBeInTheDocument());
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    textarea.value = "Updated **content**";
    textarea.dispatchEvent(new Event("input", { bubbles: true }));

    screen.getByText("Save").click();

    await waitFor(() =>
      expect(dav.updateIssue).toHaveBeenCalledWith(
        expect.objectContaining({ id: issue.id, content: "Updated **content**" })
      )
    );
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(kanbanStore.viewModal.issue?.content).toBe("Updated **content**");
  });
});
