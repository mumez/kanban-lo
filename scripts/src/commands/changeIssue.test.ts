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

it("throws when neither --status nor --content is given", async () => {
  await expect(changeIssue({ id: "abc" })).rejects.toThrow(
    "change-issue requires at least one of --status, --content, or --append-content"
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
  vi.mocked(dav.updateIssueContent).mockResolvedValue({ ...baseIssue, content: "new" });

  await changeIssue({ id: "abc", content: "new" });

  expect(dav.updateIssueContent).toHaveBeenCalledWith(baseIssue, "new");
  expect(dav.changeIssueStatus).not.toHaveBeenCalled();
});

it("changes status only", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  vi.mocked(dav.changeIssueStatus).mockResolvedValue({ ...baseIssue, status: "done" });

  await changeIssue({ id: "abc", status: "done" });

  expect(dav.updateIssueContent).not.toHaveBeenCalled();
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
  vi.mocked(dav.updateIssueContent).mockResolvedValue({ ...baseIssue, content: "old\n\nmore" });

  await changeIssue({ id: "abc", appendContent: "more" });

  expect(dav.updateIssueContent).toHaveBeenCalledWith(baseIssue, "old\n\nmore");
  expect(dav.changeIssueStatus).not.toHaveBeenCalled();
});

it("updates content before changing status when both are given", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(baseIssue);
  const withNewContent = { ...baseIssue, content: "new" };
  vi.mocked(dav.updateIssueContent).mockResolvedValue(withNewContent);
  vi.mocked(dav.changeIssueStatus).mockResolvedValue({ ...withNewContent, status: "done" });

  await changeIssue({ id: "abc", content: "new", status: "done" });

  expect(dav.updateIssueContent).toHaveBeenCalledWith(baseIssue, "new");
  expect(dav.changeIssueStatus).toHaveBeenCalledWith(withNewContent, "done");
});
