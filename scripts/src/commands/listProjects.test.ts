import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProjects } from "./listProjects";
import * as dav from "../webdavClient";

vi.mock("../webdavClient");

let logSpy: any;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

it("prints one line per project", async () => {
  vi.mocked(dav.listProjects).mockResolvedValue(["project-a", "project-b"]);

  await listProjects();

  expect(logSpy).toHaveBeenCalledTimes(2);
  expect(logSpy).toHaveBeenNthCalledWith(1, "project-a");
  expect(logSpy).toHaveBeenNthCalledWith(2, "project-b");
});

it("prints a placeholder message when no projects are defined", async () => {
  vi.mocked(dav.listProjects).mockResolvedValue([]);

  await listProjects();

  expect(logSpy).toHaveBeenCalledWith("No projects defined.");
});
