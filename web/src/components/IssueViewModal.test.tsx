import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import IssueViewModal from "./IssueViewModal";
import { kanbanStore } from "../store/kanban";
import type { Issue } from "../types";

const issue: Issue = {
  id: "1-fix-bug",
  subject: "Fix bug",
  content: "# Heading\n\nSome **bold** text.",
  column: "todo",
  project: "project-a",
};

describe("IssueViewModal", () => {
  beforeEach(() => {
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
});
