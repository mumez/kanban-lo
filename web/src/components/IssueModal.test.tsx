import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@solidjs/testing-library";
import IssueModal from "./IssueModal";
import { kanbanStore } from "../store/kanban";
import * as dav from "../services/webdav";
import type { Issue } from "../types";

vi.mock("../services/webdav");

/** saveIssue/moveIssue only act on issues already present in the store,
 *  so edit tests must seed the store before opening the edit modal. */
async function seedAndEdit(issue: Issue) {
  vi.mocked(dav.loadAllIssues).mockResolvedValue([issue]);
  await kanbanStore.reload();
  kanbanStore.openEditModal(kanbanStore.issues[0]);
}

describe("IssueModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
  });

  it("is not rendered when the modal is closed", () => {
    render(() => <IssueModal />);
    expect(screen.queryByText("New Issue")).not.toBeInTheDocument();
  });

  it("creates an issue in the target column from the entered fields", async () => {
    vi.mocked(dav.createIssue).mockResolvedValue({
      id: "1-test-issue",
      subject: "Test issue",
      content: "Some details",
      column: "todo",
    });

    kanbanStore.openCreateModal("todo");
    render(() => <IssueModal />);

    fireEvent.input(screen.getByPlaceholderText("Enter issue title..."), {
      target: { value: "Test issue" },
    });
    fireEvent.input(screen.getByPlaceholderText(/Enter details/), {
      target: { value: "Some details" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(dav.createIssue).toHaveBeenCalledWith(
        "todo",
        "Test issue",
        "Some details",
        undefined
      )
    );
    await waitFor(() => expect(kanbanStore.modal.open).toBe(false));
  });

  it("prefills the fields with the issue being edited", async () => {
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", column: "working" };
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    expect(screen.getByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("saves edits without moving when the column is unchanged", async () => {
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", column: "working" };
    vi.mocked(dav.updateIssue).mockResolvedValue(undefined);

    await seedAndEdit(issue);
    render(() => <IssueModal />);

    fireEvent.input(screen.getByPlaceholderText("Enter issue title..."), {
      target: { value: "Updated title" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(dav.updateIssue).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1", subject: "Updated title" })
      )
    );
    expect(dav.moveIssue).not.toHaveBeenCalled();
  });

  it("moves the issue before saving when the column is changed", async () => {
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", column: "working" };
    vi.mocked(dav.moveIssue).mockResolvedValue({ ...issue, column: "done" });
    vi.mocked(dav.updateIssue).mockResolvedValue(undefined);

    await seedAndEdit(issue);
    render(() => <IssueModal />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(dav.moveIssue).toHaveBeenCalledWith(issue, "done"));
    await waitFor(() => expect(dav.updateIssue).toHaveBeenCalled());
  });

  it("submits the selected project when a project list is available", async () => {
    vi.mocked(dav.loadAllIssues).mockResolvedValue([]);
    vi.mocked(dav.loadProjects).mockResolvedValue(["project-a", "project-b"]);
    await kanbanStore.reload();

    vi.mocked(dav.createIssue).mockResolvedValue({
      id: "1",
      subject: "Test issue",
      content: "",
      column: "todo",
      project: "project-b",
    });

    kanbanStore.openCreateModal("todo");
    render(() => <IssueModal />);

    fireEvent.input(screen.getByPlaceholderText("Enter issue title..."), {
      target: { value: "Test issue" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Project" }), { target: { value: "project-b" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(dav.createIssue).toHaveBeenCalledWith("todo", "Test issue", "", "project-b")
    );
  });

  it("prefills the project select with the issue's project when editing", async () => {
    vi.mocked(dav.loadProjects).mockResolvedValue(["project-a", "project-b"]);
    const issue: Issue = {
      id: "1",
      subject: "Existing",
      content: "",
      column: "working",
      project: "project-a",
    };
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    expect(screen.getByRole("combobox", { name: "Project" })).toHaveValue("project-a");
  });
});
