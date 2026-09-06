import { describe, it, expect, vi, beforeEach } from "vitest";
import { listArchives } from "./listArchives";
import * as dav from "../webdavClient";

vi.mock("../webdavClient");

let logSpy: any;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

it("prints one line per archived issue", async () => {
  vi.mocked(dav.listArchivedIssues).mockResolvedValue([
    { id: "a", subject: "Subject a", content: "" },
    { id: "b", subject: "Subject b", content: "", project: "project-a" },
  ]);

  await listArchives();

  expect(logSpy).toHaveBeenCalledTimes(2);
  expect(logSpy).toHaveBeenNthCalledWith(1, "a\tSubject a");
  expect(logSpy).toHaveBeenNthCalledWith(2, "b\tSubject b [project-a]");
});

it("prints a placeholder message when there are no archived issues", async () => {
  vi.mocked(dav.listArchivedIssues).mockResolvedValue([]);

  await listArchives();

  expect(logSpy).toHaveBeenCalledWith("No archived issues.");
});
