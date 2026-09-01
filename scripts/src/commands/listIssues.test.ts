import { describe, it, expect, vi, beforeEach } from "vitest";
import { listIssues } from "./listIssues";
import * as dav from "../webdavClient";
import type { Issue } from "../../../web/src/lib/issue-format";

vi.mock("../webdavClient");

function issue(id: string): Issue {
  return { id, subject: `Subject ${id}`, content: "", status: "todo" };
}

let logSpy: any;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

it("prints one line per issue, most-priority-first, capped at max", async () => {
  vi.mocked(dav.listIssues).mockResolvedValue([issue("a"), issue("b"), issue("c")]);

  await listIssues({ status: "todo", max: 2 });

  expect(dav.listIssues).toHaveBeenCalledWith("todo");
  expect(logSpy).toHaveBeenCalledTimes(2);
  expect(logSpy).toHaveBeenNthCalledWith(1, "a\tSubject a");
  expect(logSpy).toHaveBeenNthCalledWith(2, "b\tSubject b");
});

it("prints a placeholder message when the column is empty", async () => {
  vi.mocked(dav.listIssues).mockResolvedValue([]);

  await listIssues({ status: "todo", max: 10 });

  expect(logSpy).toHaveBeenCalledWith('No issues in "todo".');
});

it("includes the project tag when an issue has one", async () => {
  vi.mocked(dav.listIssues).mockResolvedValue([{ ...issue("a"), project: "project-a" }]);

  await listIssues({ status: "todo", max: 10 });

  expect(logSpy).toHaveBeenCalledWith("a\tSubject a [project-a]");
});
