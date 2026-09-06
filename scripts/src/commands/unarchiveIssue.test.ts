import { describe, it, expect, vi, beforeEach } from "vitest";
import { unarchiveIssue } from "./unarchiveIssue";
import * as dav from "../webdavClient";
import type { Issue } from "../../../web/src/lib/issue-format";

vi.mock("../webdavClient");

let logSpy: any;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

it("restores the issue and prints it as JSON", async () => {
  const issue: Issue = { id: "abc", subject: "Subject", content: "Body", status: "todo" };
  vi.mocked(dav.unarchiveIssue).mockResolvedValue(issue);

  await unarchiveIssue({ id: "abc", status: "todo" });

  expect(dav.unarchiveIssue).toHaveBeenCalledWith("abc", "todo");
  expect(logSpy).toHaveBeenCalledWith(JSON.stringify(issue, null, 2));
});

it("throws a clear error when the archived issue doesn't exist", async () => {
  vi.mocked(dav.unarchiveIssue).mockRejectedValue(new Error("404"));

  await expect(unarchiveIssue({ id: "missing", status: "todo" })).rejects.toThrow(
    "Archived issue not found: missing"
  );
});
