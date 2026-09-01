import { describe, it, expect, vi, beforeEach } from "vitest";
import { kanbanStore } from "./kanban";
import * as dav from "../services/webdav";
import type { Issue } from "../types";

vi.mock("../services/webdav");

function issue(id: string, status: Issue["status"]): Issue {
  return { id, subject: id, content: "", status };
}

async function seed(issues: Issue[], projects: string[] = []) {
  vi.mocked(dav.loadAllIssues).mockResolvedValue(issues);
  vi.mocked(dav.loadProjects).mockResolvedValue(projects);
  await kanbanStore.reload();
}

describe("kanbanStore.reorderIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    kanbanStore.setSelectedProject(null);
  });

  it("reorders issues within a column and persists that column's order", async () => {
    await seed([issue("a", "todo"), issue("b", "todo"), issue("c", "todo")]);
    vi.mocked(dav.saveOrder).mockResolvedValue(undefined);

    await kanbanStore.reorderIssue("c", "todo", 0);

    expect(kanbanStore.issuesByColumn("todo").map((i) => i.id)).toEqual(["c", "a", "b"]);
    expect(dav.saveOrder).toHaveBeenCalledWith("todo", ["c.md", "a.md", "b.md"]);
    expect(dav.moveIssue).not.toHaveBeenCalled();
  });

  it("does nothing when dropped back at its current position", async () => {
    await seed([issue("a", "todo"), issue("b", "todo")]);

    await kanbanStore.reorderIssue("a", "todo", 0);

    expect(dav.saveOrder).not.toHaveBeenCalled();
  });

  it("moves an issue to another column at the given index and persists both columns' order", async () => {
    await seed([issue("a", "todo"), issue("b", "working"), issue("c", "working")]);
    vi.mocked(dav.moveIssue).mockResolvedValue({ ...issue("a", "working") });
    vi.mocked(dav.saveOrder).mockResolvedValue(undefined);

    await kanbanStore.reorderIssue("a", "working", 1);

    expect(dav.moveIssue).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), "working");
    expect(kanbanStore.issuesByColumn("todo")).toHaveLength(0);
    expect(kanbanStore.issuesByColumn("working").map((i) => i.id)).toEqual(["b", "a", "c"]);
    expect(dav.saveOrder).toHaveBeenCalledWith("working", ["b.md", "a.md", "c.md"]);
    expect(dav.saveOrder).toHaveBeenCalledWith("todo", []);
  });

  it("does nothing for an unknown issue id", async () => {
    await seed([issue("a", "todo")]);

    await kanbanStore.reorderIssue("missing", "todo", 0);

    expect(dav.moveIssue).not.toHaveBeenCalled();
    expect(dav.saveOrder).not.toHaveBeenCalled();
  });
});

describe("kanbanStore.moveIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    kanbanStore.setSelectedProject(null);
  });

  it("appends the issue to the end of the target column", async () => {
    await seed([issue("a", "todo"), issue("b", "working")]);
    vi.mocked(dav.moveIssue).mockResolvedValue({ ...issue("a", "working") });
    vi.mocked(dav.saveOrder).mockResolvedValue(undefined);

    await kanbanStore.moveIssue("a", "working");

    expect(kanbanStore.issuesByColumn("working").map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("does nothing when the target column is unchanged", async () => {
    await seed([issue("a", "todo")]);

    await kanbanStore.moveIssue("a", "todo");

    expect(dav.moveIssue).not.toHaveBeenCalled();
  });
});

describe("kanbanStore project filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    kanbanStore.setSelectedProject(null);
  });

  it("exposes the admin-maintained project list loaded on reload", async () => {
    await seed([issue("a", "todo")], ["project-a", "project-b"]);

    expect(kanbanStore.projects).toEqual(["project-a", "project-b"]);
  });

  it("visibleIssuesByColumn shows every issue when no project is selected", async () => {
    const a = { ...issue("a", "todo"), project: "project-a" };
    const b = issue("b", "todo");
    await seed([a, b]);

    expect(kanbanStore.visibleIssuesByColumn("todo").map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("visibleIssuesByColumn narrows to the selected project and includes unclassified issues", async () => {
    const a = { ...issue("a", "todo"), project: "project-a" };
    const b = { ...issue("b", "todo"), project: "project-b" };
    const c = issue("c", "todo"); // no project
    await seed([a, b, c], ["project-a", "project-b"]);

    kanbanStore.setSelectedProject("project-a");

    expect(kanbanStore.visibleIssuesByColumn("todo").map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("issuesByColumn (used for _order.json bookkeeping) ignores the project filter", async () => {
    const a = { ...issue("a", "todo"), project: "project-a" };
    const b = { ...issue("b", "todo"), project: "project-b" };
    await seed([a, b], ["project-a", "project-b"]);

    kanbanStore.setSelectedProject("project-a");

    expect(kanbanStore.issuesByColumn("todo").map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("persists the selected project to localStorage, and clears it when set back to null", () => {
    kanbanStore.setSelectedProject("project-a");
    expect(localStorage.getItem("kanban-lo:selectedProject")).toBe("project-a");

    kanbanStore.setSelectedProject(null);
    expect(localStorage.getItem("kanban-lo:selectedProject")).toBeNull();
  });

  it("restores the previously selected project from localStorage on load", async () => {
    localStorage.setItem("kanban-lo:selectedProject", "project-b");
    vi.resetModules();
    const { kanbanStore: freshStore } = await import("./kanban");

    expect(freshStore.selectedProject).toBe("project-b");
  });
});

describe("kanbanStore search filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    kanbanStore.setSelectedProject(null);
    kanbanStore.setSearchQuery("");
  });

  it("visibleIssuesByColumn shows every issue when the search query is empty", async () => {
    const a = { ...issue("a", "todo"), subject: "Fix login bug" };
    const b = { ...issue("b", "todo"), subject: "Add dark mode" };
    await seed([a, b]);

    expect(kanbanStore.visibleIssuesByColumn("todo").map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("narrows to issues whose subject or content matches the query, case-insensitively, without reordering", async () => {
    const a = { ...issue("a", "todo"), subject: "Fix login bug" };
    const b = { ...issue("b", "todo"), subject: "Add dark mode", content: "Should respect LOGIN state" };
    const c = { ...issue("c", "todo"), subject: "Unrelated" };
    await seed([a, b, c]);

    kanbanStore.setSearchQuery("login");

    expect(kanbanStore.visibleIssuesByColumn("todo").map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("combines with the project filter", async () => {
    const a = { ...issue("a", "todo"), subject: "Fix login bug", project: "project-a" };
    const b = { ...issue("b", "todo"), subject: "Fix login typo", project: "project-b" };
    await seed([a, b], ["project-a", "project-b"]);

    kanbanStore.setSelectedProject("project-a");
    kanbanStore.setSearchQuery("login");

    expect(kanbanStore.visibleIssuesByColumn("todo").map((i) => i.id)).toEqual(["a"]);
  });

  it("issuesByColumn (used for _order.json bookkeeping) ignores the search query", async () => {
    const a = { ...issue("a", "todo"), subject: "Fix login bug" };
    const b = { ...issue("b", "todo"), subject: "Unrelated" };
    await seed([a, b]);

    kanbanStore.setSearchQuery("login");

    expect(kanbanStore.issuesByColumn("todo").map((i) => i.id)).toEqual(["a", "b"]);
  });
});

describe("kanbanStore.addIssue / saveIssue project field", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
    kanbanStore.setSelectedProject(null);
  });

  it("passes the project through to dav.createIssue", async () => {
    await seed([]);
    vi.mocked(dav.createIssue).mockResolvedValue({
      id: "1",
      subject: "New",
      content: "",
      status: "todo",
      project: "project-a",
    });

    await kanbanStore.addIssue("todo", "New", "", "project-a");

    expect(dav.createIssue).toHaveBeenCalledWith("todo", "New", "", "project-a");
    expect(kanbanStore.issues.find((i) => i.id === "1")?.project).toBe("project-a");
  });

  it("passes the project through to dav.updateIssue", async () => {
    await seed([issue("a", "todo")]);
    vi.mocked(dav.updateIssue).mockResolvedValue(undefined);

    await kanbanStore.saveIssue("a", "a", "", "project-a");

    expect(dav.updateIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a", project: "project-a" })
    );
    expect(kanbanStore.issues.find((i) => i.id === "a")?.project).toBe("project-a");
  });
});
