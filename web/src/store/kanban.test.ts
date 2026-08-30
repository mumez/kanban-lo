import { describe, it, expect, vi, beforeEach } from "vitest";
import { kanbanStore } from "./kanban";
import * as dav from "../services/webdav";
import type { Issue } from "../types";

vi.mock("../services/webdav");

function issue(id: string, column: Issue["column"]): Issue {
  return { id, subject: id, content: "", column };
}

async function seed(issues: Issue[]) {
  vi.mocked(dav.loadAllIssues).mockResolvedValue(issues);
  await kanbanStore.reload();
}

describe("kanbanStore.reorderIssue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kanbanStore.closeModal();
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
