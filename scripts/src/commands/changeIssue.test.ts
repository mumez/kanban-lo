import { describe, it, expect, vi, beforeEach } from "vitest";
import { changeIssue } from "./changeIssue";
import * as dav from "../webdavClient";
import type { Issue } from "../../../web/src/lib/issue-format";

vi.mock("../webdavClient");

const baseIssue: Issue = { id: "abc", subject: "Subject", content: "old", status: "todo" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
});

it("throws when nothing to change is given", async () => {
  await expect(changeIssue({ id: "abc" })).rejects.toThrow(
    "change-issue requires at least one of --status, --content, --append-content, --project, --working-dir, --spec-level, --pr, or --session-id"
  );
  expect(dav.getIssue).not.toHaveBeenCalled();
});

it("throws when the issue doesn't exist", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(null);

  await expect(changeIssue({ id: "missing", content: "x" })).rejects.toThrow(
    "Issue not found: missing"
  );
});

it("updates content only", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  vi.mocked(dav.updateIssue).mockResolvedValue({ ...baseIssue, content: "new" });

  await changeIssue({ id: "abc", content: "new" });

  expect(dav.updateIssue).toHaveBeenCalledWith(baseIssue, { content: "new" });
  expect(dav.changeIssueStatus).not.toHaveBeenCalled();
});

it("changes status only", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  vi.mocked(dav.changeIssueStatus).mockResolvedValue({ ...baseIssue, status: "done" });

  await changeIssue({ id: "abc", status: "done" });

  expect(dav.updateIssue).not.toHaveBeenCalled();
  expect(dav.changeIssueStatus).toHaveBeenCalledWith(baseIssue, "done");
});

it("throws when both --content and --append-content are given", async () => {
  await expect(changeIssue({ id: "abc", content: "new", appendContent: "more" })).rejects.toThrow(
    "change-issue accepts only one of --content or --append-content"
  );
  expect(dav.getIssue).not.toHaveBeenCalled();
});

it("appends content to the existing content", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  vi.mocked(dav.updateIssue).mockResolvedValue({ ...baseIssue, content: "old\n\nmore" });

  await changeIssue({ id: "abc", appendContent: "more" });

  expect(dav.updateIssue).toHaveBeenCalledWith(baseIssue, { content: "old\n\nmore" });
  expect(dav.changeIssueStatus).not.toHaveBeenCalled();
});

it("uses append content as-is when the existing content is empty", async () => {
  const emptyContentIssue = { ...baseIssue, content: "" };
  vi.mocked(dav.getIssue).mockResolvedValue(emptyContentIssue);
  vi.mocked(dav.updateIssue).mockResolvedValue({ ...emptyContentIssue, content: "more" });

  await changeIssue({ id: "abc", appendContent: "more" });

  expect(dav.updateIssue).toHaveBeenCalledWith(emptyContentIssue, { content: "more" });
});

it("updates content before changing status when both are given", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  const withNewContent = { ...baseIssue, content: "new" };
  vi.mocked(dav.updateIssue).mockResolvedValue(withNewContent);
  vi.mocked(dav.changeIssueStatus).mockResolvedValue({ ...withNewContent, status: "done" });

  await changeIssue({ id: "abc", content: "new", status: "done" });

  expect(dav.updateIssue).toHaveBeenCalledWith(baseIssue, { content: "new" });
  expect(dav.changeIssueStatus).toHaveBeenCalledWith(withNewContent, "done");
});

it("replaces frontmatter values without touching content", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  vi.mocked(dav.updateIssue).mockResolvedValue({ ...baseIssue, pr: "https://github.com/org/repo/pull/1" });

  await changeIssue({ id: "abc", pr: "https://github.com/org/repo/pull/1", project: "project-b" });

  expect(dav.updateIssue).toHaveBeenCalledWith(baseIssue, {
    pr: "https://github.com/org/repo/pull/1",
    project: "project-b",
  });
  expect(dav.changeIssueStatus).not.toHaveBeenCalled();
});

it("passes an empty frontmatter value through so it gets removed", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue({ ...baseIssue, sessionId: "sess-1" });
  vi.mocked(dav.updateIssue).mockResolvedValue(baseIssue);

  await changeIssue({ id: "abc", sessionId: "" });

  expect(dav.updateIssue).toHaveBeenCalledWith({ ...baseIssue, sessionId: "sess-1" }, { sessionId: "" });
});

it("writes content and frontmatter in one update", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  vi.mocked(dav.updateIssue).mockResolvedValue(baseIssue);

  await changeIssue({ id: "abc", appendContent: "more", sessionId: "sess-2" });

  expect(dav.updateIssue).toHaveBeenCalledTimes(1);
  expect(dav.updateIssue).toHaveBeenCalledWith(baseIssue, { content: "old\n\nmore", sessionId: "sess-2" });
});

it("sets workingDir and specLevel", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  vi.mocked(dav.updateIssue).mockResolvedValue(baseIssue);

  await changeIssue({ id: "abc", workingDir: "/home/me/repo", specLevel: "detailed" });

  expect(dav.updateIssue).toHaveBeenCalledWith(baseIssue, { workingDir: "/home/me/repo", specLevel: "detailed" });
});

it("passes empty workingDir and specLevel through so they get removed", async () => {
  const issue = { ...baseIssue, workingDir: "/home/me/repo", specLevel: "detailed" };
  vi.mocked(dav.getIssue).mockResolvedValue(issue);
  vi.mocked(dav.updateIssue).mockResolvedValue(baseIssue);

  await changeIssue({ id: "abc", workingDir: "", specLevel: "" });

  expect(dav.updateIssue).toHaveBeenCalledWith(issue, { workingDir: "", specLevel: "" });
});
