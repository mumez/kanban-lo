import { describe, it, expect, afterEach } from "vitest";
import * as dav from "./webdav";
import type { Column, Issue } from "../types";

/**
 * Exercises services/webdav.ts against a real WebDAV server.
 * Requires `docker compose up -d` (from the repo root) to be running,
 * and VITE_DAV_BASE pointed at it — see .env.integration.
 */
describe("webdav service (integration)", () => {
  const cleanup: { column: Column; id: string }[] = [];

  afterEach(async () => {
    for (const { column, id } of cleanup.splice(0)) {
      await dav.deleteIssue({ id, subject: "", content: "", column }).catch(() => {});
    }
  });

  it("creates an issue that shows up when listing its column", async () => {
    const created = await dav.createIssue("todo", `Integration ${Date.now()}`, "hello");
    cleanup.push({ column: "todo", id: created.id });

    const todoIssues = await dav.listIssues("todo");
    expect(todoIssues).toContainEqual(created);
  });

  it("persists content updates written with updateIssue", async () => {
    const created = await dav.createIssue("todo", `Integration ${Date.now()}`, "original");
    cleanup.push({ column: "todo", id: created.id });

    await dav.updateIssue({ ...created, content: "updated" });

    const todoIssues = await dav.listIssues("todo");
    expect(todoIssues.find((i) => i.id === created.id)?.content).toBe("updated");
  });

  it("moves an issue's file between column directories", async () => {
    const created = await dav.createIssue("todo", `Integration ${Date.now()}`, "body");

    const moved = await dav.moveIssue(created, "working");
    cleanup.push({ column: "working", id: moved.id });

    expect((await dav.listIssues("todo")).some((i) => i.id === created.id)).toBe(false);
    expect((await dav.listIssues("working")).some((i) => i.id === moved.id)).toBe(true);
  });

  it("removes the file so it no longer appears in listings", async () => {
    const created = await dav.createIssue("todo", `Integration ${Date.now()}`, "body");

    await dav.deleteIssue(created);

    expect((await dav.listIssues("todo")).some((i) => i.id === created.id)).toBe(false);
  });

  it("aggregates issues from every column via loadAllIssues", async () => {
    const inTodo = await dav.createIssue("todo", `Integration todo ${Date.now()}`, "");
    cleanup.push({ column: "todo", id: inTodo.id });
    const inDone = await dav.createIssue("done", `Integration done ${Date.now()}`, "");
    cleanup.push({ column: "done", id: inDone.id });

    const all = await dav.loadAllIssues();

    const byId = (i: Issue) => [inTodo.id, inDone.id].includes(i.id);
    expect(all.filter(byId)).toHaveLength(2);
  });
});
