import { describe, it, expect, vi, beforeEach } from "vitest";
import { archiveIssue } from "./archiveIssue";
import * as dav from "../webdavClient";
import type { Issue } from "../../../web/src/lib/issue-format";

vi.mock("../webdavClient");

let logSpy: any;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

it("archives the issue and prints a confirmation", async () => {
  const issue: Issue = { id: "abc", subject: "Subject", content: "Body", status: "todo" };
  vi.mocked(dav.getIssue).mockResolvedValue(issue);
  vi.mocked(dav.archiveIssue).mockResolvedValue(undefined);

  await archiveIssue("abc");

  expect(dav.archiveIssue).toHaveBeenCalledWith(issue);
  expect(logSpy).toHaveBeenCalledWith("Archived abc");
});

it("throws when the issue doesn't exist", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(null);

  await expect(archiveIssue("missing")).rejects.toThrow("Issue not found: missing");
  expect(dav.archiveIssue).not.toHaveBeenCalled();
});
