import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchIssue } from "./fetchIssue";
import * as dav from "../webdavClient";
import type { Issue } from "../../../web/src/lib/issue-format";

vi.mock("../webdavClient");

let logSpy: any;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

it("prints the issue as JSON", async () => {
  const issue: Issue = { id: "abc", subject: "Subject", content: "Body", status: "todo" };
  vi.mocked(dav.getIssue).mockResolvedValue(issue);

  await fetchIssue("abc");

  expect(dav.getIssue).toHaveBeenCalledWith("abc");
  expect(logSpy).toHaveBeenCalledWith(JSON.stringify(issue, null, 2));
});

it("throws when the issue doesn't exist", async () => {
  vi.mocked(dav.getIssue).mockResolvedValue(null);

  await expect(fetchIssue("missing")).rejects.toThrow("Issue not found: missing");
});
