import { describe, it, expect, vi, beforeEach } from "vitest";
import { createIssue } from "./createIssue";
import * as dav from "../webdavClient";
import type { Issue } from "../../../web/src/lib/issue-format";

vi.mock("../webdavClient");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

it("creates an issue in the given column with subject/content/project", async () => {
  const created: Issue = {
    id: "123-new-issue",
    subject: "New issue",
    content: "body",
    status: "todo",
    project: "project-a",
  };
  vi.mocked(dav.createIssue).mockResolvedValue(created);

  await createIssue({ subject: "New issue", content: "body", project: "project-a", status: "todo" });

  expect(dav.createIssue).toHaveBeenCalledWith("todo", "New issue", "body", "project-a");
});

it("passes an undefined project through when none is given", async () => {
  vi.mocked(dav.createIssue).mockResolvedValue({
    id: "123-new-issue",
    subject: "New issue",
    content: "",
    status: "todo",
  });

  await createIssue({ subject: "New issue", content: "", status: "todo" });

  expect(dav.createIssue).toHaveBeenCalledWith("todo", "New issue", "", undefined);
});
