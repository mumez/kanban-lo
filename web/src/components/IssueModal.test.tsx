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
  beforeEach(async () => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    kanbanStore.setSelectedProject(null);
    vi.mocked(dav.loadAllIssues).mockResolvedValue([]);
    vi.mocked(dav.loadProjects).mockResolvedValue([]);
    vi.mocked(dav.loadSettings).mockResolvedValue({ hiddenStatuses: [] });
    await kanbanStore.reload();
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
      status: "todo",
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
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", status: "working" };
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    expect(screen.getByDisplayValue("Existing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("saves edits without moving when the column is unchanged", async () => {
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", status: "working" };
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
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", status: "working" };
    vi.mocked(dav.moveIssue).mockResolvedValue({ ...issue, status: "done" });
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
      status: "todo",
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

  it("prefills the project select with the active project filter when creating", async () => {
    vi.mocked(dav.loadAllIssues).mockResolvedValue([]);
    vi.mocked(dav.loadProjects).mockResolvedValue(["project-a", "project-b"]);
    await kanbanStore.reload();
    kanbanStore.setSelectedProject("project-b");

    kanbanStore.openCreateModal("todo");
    render(() => <IssueModal />);

    expect(screen.getByRole("combobox", { name: "Project" })).toHaveValue("project-b");
  });

  it("prefills the project select with the issue's project when editing", async () => {
    vi.mocked(dav.loadProjects).mockResolvedValue(["project-a", "project-b"]);
    const issue: Issue = {
      id: "1",
      subject: "Existing",
      content: "",
      status: "working",
      project: "project-a",
    };
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    expect(screen.getByRole("combobox", { name: "Project" })).toHaveValue("project-a");
  });

  it("offers releasing between reviewing and done when nothing is hidden", () => {
    kanbanStore.openCreateModal("todo");
    render(() => <IssueModal />);

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Todo",
      "Working",
      "Reviewing",
      "Releasing",
      "Done",
      "Pending",
    ]);
  });

  it("creates in the first visible column when the selected one is hidden mid-form", async () => {
    kanbanStore.openCreateModal("todo");
    render(() => <IssueModal />);

    fireEvent.input(screen.getByPlaceholderText("Enter issue title..."), {
      target: { value: "Still drafting" },
    });

    vi.mocked(dav.loadSettings).mockResolvedValue({ hiddenStatuses: ["todo"] });
    await kanbanStore.reload();

    expect(screen.getByPlaceholderText("Enter issue title...")).toHaveValue("Still drafting");
    expect(screen.getByRole("combobox", { name: "Column" })).toHaveValue("working");
    expect(screen.queryByRole("option", { name: "Todo" })).not.toBeInTheDocument();

    vi.mocked(dav.createIssue).mockResolvedValue({
      id: "1",
      subject: "Still drafting",
      content: "",
      status: "working",
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(dav.createIssue).toHaveBeenCalledWith("working", "Still drafting", "", undefined)
    );
  });

  it("does not move an issue when its own column is hidden while it is being edited", async () => {
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", status: "todo" };
    vi.mocked(dav.updateIssue).mockResolvedValue(undefined);
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    vi.mocked(dav.loadSettings).mockResolvedValue({ hiddenStatuses: ["todo"] });
    await kanbanStore.reload();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(dav.updateIssue).toHaveBeenCalled());
    expect(dav.moveIssue).not.toHaveBeenCalled();
  });

  function follows(earlier: Element, later: Element) {
    return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }

  it("does not show PR URL or session id inputs when creating an issue", () => {
    kanbanStore.openCreateModal("todo");
    render(() => <IssueModal />);

    expect(screen.queryByLabelText("PR URL")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Session ID")).not.toBeInTheDocument();
  });

  it("shows PR URL and session id inputs below the other fields when editing", async () => {
    vi.mocked(dav.loadProjects).mockResolvedValue(["project-a"]);
    const issue: Issue = {
      id: "1",
      subject: "Existing",
      content: "Body",
      status: "working",
      project: "project-a",
      pr: "https://github.com/org/repo/pull/12",
      sessionId: "sess-42",
    };
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    const pr = screen.getByLabelText("PR URL");
    const sessionId = screen.getByLabelText("Session ID");
    expect(pr).toHaveValue("https://github.com/org/repo/pull/12");
    expect(sessionId).toHaveValue("sess-42");
    expect(follows(screen.getByRole("combobox", { name: "Project" }), pr)).toBe(true);
    expect(follows(pr, sessionId)).toBe(true);
    expect(follows(sessionId, screen.getByRole("button", { name: "Save" }))).toBe(true);
  });

  it("shows empty PR URL and session id inputs when the issue has neither", async () => {
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", status: "working" };
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    expect(screen.getByLabelText("PR URL")).toHaveValue("");
    expect(screen.getByLabelText("Session ID")).toHaveValue("");
  });

  it("saves the PR URL and session id entered in the edit form", async () => {
    const issue: Issue = { id: "1", subject: "Existing", content: "Body", status: "working" };
    vi.mocked(dav.updateIssue).mockResolvedValue(undefined);
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    fireEvent.input(screen.getByLabelText("PR URL"), {
      target: { value: " https://github.com/org/repo/pull/9 " },
    });
    fireEvent.input(screen.getByLabelText("Session ID"), { target: { value: "sess-9" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(dav.updateIssue).toHaveBeenCalled());
    const written = vi.mocked(dav.updateIssue).mock.calls[0][0];
    expect(written.pr).toBe("https://github.com/org/repo/pull/9");
    expect(written.sessionId).toBe("sess-9");
    expect(dav.moveIssue).not.toHaveBeenCalled();
  });

  it("clears the PR URL and session id when those inputs are left blank", async () => {
    const issue: Issue = {
      id: "1",
      subject: "Existing",
      content: "Body",
      status: "working",
      pr: "https://github.com/org/repo/pull/9",
      sessionId: "sess-9",
    };
    vi.mocked(dav.updateIssue).mockResolvedValue(undefined);
    await seedAndEdit(issue);
    render(() => <IssueModal />);

    fireEvent.input(screen.getByLabelText("PR URL"), { target: { value: "  " } });
    fireEvent.input(screen.getByLabelText("Session ID"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(dav.updateIssue).toHaveBeenCalled());
    const written = vi.mocked(dav.updateIssue).mock.calls[0][0];
    expect(written.pr).toBeUndefined();
    expect(written.sessionId).toBeUndefined();
  });

  it("omits columns listed in hiddenStatuses from the column dropdown", async () => {
    vi.mocked(dav.loadSettings).mockResolvedValue({ hiddenStatuses: ["reviewing"] });
    await kanbanStore.reload();

    kanbanStore.openCreateModal("todo");
    render(() => <IssueModal />);

    expect(screen.queryByRole("option", { name: "Reviewing" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Todo" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Done" })).toBeInTheDocument();
  });
});
