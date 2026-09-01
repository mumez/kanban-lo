import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "webdav";

vi.mock("webdav", () => ({
  createClient: vi.fn(),
}));

function fakeClient() {
  return {
    getFileContents: vi.fn(),
    putFileContents: vi.fn(),
    moveFile: vi.fn(),
    deleteFile: vi.fn(),
    getDirectoryContents: vi.fn(),
  };
}

let client: ReturnType<typeof fakeClient>;

// webdavClient.ts caches its client lazily; re-importing per test with a
// fresh module registry keeps each test's mock client isolated.
async function loadWebdavClient() {
  vi.resetModules();
  client = fakeClient();
  vi.mocked(createClient).mockReturnValue(client as any);
  return import("./webdavClient");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("loadOrder / saveOrder", () => {
  it("returns an empty array when _order.json doesn't exist", async () => {
    const dav = await loadWebdavClient();
    client.getFileContents.mockRejectedValue(new Error("404"));

    expect(await dav.loadOrder("todo")).toEqual([]);
  });

  it("parses the saved order file", async () => {
    const dav = await loadWebdavClient();
    client.getFileContents.mockResolvedValue(JSON.stringify(["a.md", "b.md"]));

    expect(await dav.loadOrder("todo")).toEqual(["a.md", "b.md"]);
  });

  it("persists the order as JSON", async () => {
    const dav = await loadWebdavClient();
    client.putFileContents.mockResolvedValue(undefined);

    await dav.saveOrder("todo", ["a.md", "b.md"]);

    expect(client.putFileContents).toHaveBeenCalledWith(
      "/todo/_order.json",
      JSON.stringify(["a.md", "b.md"]),
      { overwrite: true }
    );
  });
});

describe("getIssue", () => {
  it("finds an issue by searching each column", async () => {
    const dav = await loadWebdavClient();
    client.getFileContents.mockImplementation((path: string) => {
      if (path === "/working/abc.md") return Promise.resolve("# Subject\n\nBody");
      return Promise.reject(new Error("404"));
    });

    const issue = await dav.getIssue("abc");

    expect(issue).toEqual({ id: "abc", subject: "Subject", content: "Body", status: "working" });
  });

  it("returns null when the id isn't in any column", async () => {
    const dav = await loadWebdavClient();
    client.getFileContents.mockRejectedValue(new Error("404"));

    expect(await dav.getIssue("missing")).toBeNull();
  });
});

describe("createIssue", () => {
  it("writes the markdown file and leaves _order.json untouched when none exists yet", async () => {
    const dav = await loadWebdavClient();
    client.putFileContents.mockResolvedValue(undefined);
    client.getFileContents.mockRejectedValue(new Error("404")); // no _order.json

    const issue = await dav.createIssue("todo", "New issue", "body", "project-a");

    expect(issue.subject).toBe("New issue");
    expect(issue.content).toBe("body");
    expect(issue.status).toBe("todo");
    expect(issue.project).toBe("project-a");
    expect(client.putFileContents).toHaveBeenCalledTimes(1);
    expect(client.putFileContents).toHaveBeenCalledWith(
      `/todo/${issue.id}.md`,
      "---\nproject: project-a\n---\n# New issue\n\nbody\n",
      { overwrite: false }
    );
  });

  it("appends the new id to an existing order", async () => {
    const dav = await loadWebdavClient();
    client.putFileContents.mockResolvedValue(undefined);
    client.getFileContents.mockResolvedValue(JSON.stringify(["existing.md"]));

    const issue = await dav.createIssue("todo", "New issue", "body");

    expect(client.putFileContents).toHaveBeenCalledWith(
      "/todo/_order.json",
      JSON.stringify(["existing.md", `${issue.id}.md`]),
      { overwrite: true }
    );
  });
});

describe("updateIssueContent", () => {
  it("overwrites the file with the new content, preserving subject and project", async () => {
    const dav = await loadWebdavClient();
    client.putFileContents.mockResolvedValue(undefined);

    const issue = { id: "abc", subject: "Subject", content: "old", status: "todo" as const, project: "project-a" };
    const updated = await dav.updateIssueContent(issue, "new content");

    expect(updated.content).toBe("new content");
    expect(client.putFileContents).toHaveBeenCalledWith(
      "/todo/abc.md",
      "---\nproject: project-a\n---\n# Subject\n\nnew content\n",
      { overwrite: true }
    );
  });
});

describe("changeIssueStatus", () => {
  it("inserts the issue at the top of the same column's order when the column doesn't change", async () => {
    const dav = await loadWebdavClient();
    client.getFileContents.mockResolvedValue(JSON.stringify(["a.md", "abc.md", "b.md"]));
    client.putFileContents.mockResolvedValue(undefined);

    const issue = { id: "abc", subject: "S", content: "", status: "todo" as const };
    const result = await dav.changeIssueStatus(issue, "todo");

    expect(result).toEqual(issue);
    expect(client.moveFile).not.toHaveBeenCalled();
    expect(client.putFileContents).toHaveBeenCalledWith(
      "/todo/_order.json",
      JSON.stringify(["abc.md", "a.md", "b.md"]),
      { overwrite: true }
    );
  });

  it("moves the file and reorders both the source and destination columns", async () => {
    const dav = await loadWebdavClient();
    client.moveFile.mockResolvedValue(undefined);
    client.putFileContents.mockResolvedValue(undefined);
    client.getFileContents.mockImplementation((path: string) => {
      if (path === "/todo/_order.json") return Promise.resolve(JSON.stringify(["abc.md", "x.md"]));
      if (path === "/done/_order.json") return Promise.resolve(JSON.stringify(["y.md"]));
      return Promise.reject(new Error("404"));
    });

    const issue = { id: "abc", subject: "S", content: "", status: "todo" as const };
    const result = await dav.changeIssueStatus(issue, "done");

    expect(result.status).toBe("done");
    expect(client.moveFile).toHaveBeenCalledWith("/todo/abc.md", "/done/abc.md");
    expect(client.putFileContents).toHaveBeenCalledWith(
      "/todo/_order.json",
      JSON.stringify(["x.md"]),
      { overwrite: true }
    );
    expect(client.putFileContents).toHaveBeenCalledWith(
      "/done/_order.json",
      JSON.stringify(["abc.md", "y.md"]),
      { overwrite: true }
    );
  });
});
