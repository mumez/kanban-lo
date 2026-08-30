import { describe, it, expect } from "vitest";
import { parseMarkdown, serializeMarkdown, generateId, sortByOrder } from "./webdav";
import type { Issue } from "../types";

function issue(id: string): Issue {
  return { id, subject: id, content: "", column: "todo" };
}

describe("parseMarkdown", () => {
  it("splits the H1 subject from the body", () => {
    expect(parseMarkdown("# Fix login bug\n\nSteps to reproduce...")).toEqual({
      subject: "Fix login bug",
      content: "Steps to reproduce...",
    });
  });

  it("trims trailing whitespace from the body", () => {
    expect(parseMarkdown("# Title\n\nBody\n\n\n")).toEqual({
      subject: "Title",
      content: "Body",
    });
  });

  it("returns an empty body when there is no content after the subject", () => {
    expect(parseMarkdown("# Title only\n")).toEqual({
      subject: "Title only",
      content: "",
    });
  });

  it("returns an empty subject when there is no H1", () => {
    expect(parseMarkdown("Just a body, no heading")).toEqual({
      subject: "",
      content: "Just a body, no heading",
    });
  });
});

describe("serializeMarkdown", () => {
  it("renders subject and content as an H1 followed by the body", () => {
    expect(serializeMarkdown("Title", "Body text")).toBe("# Title\n\nBody text\n");
  });

  it("omits the blank separator when content is empty", () => {
    expect(serializeMarkdown("Title", "")).toBe("# Title\n");
  });

  it("trims surrounding whitespace from content", () => {
    expect(serializeMarkdown("Title", "  Body  \n")).toBe("# Title\n\nBody\n");
  });
});

describe("generateId", () => {
  it("builds a slug from the subject, prefixed with a timestamp", () => {
    const id = generateId("Fix Login Bug!!");
    expect(id).toMatch(/^\d+-fix-login-bug$/);
  });

  it("keeps CJK characters in the slug", () => {
    const id = generateId("ログイン修正");
    expect(id).toMatch(/^\d+-ログイン修正$/);
  });

  it("falls back to 'issue' when the subject has no sluggable characters", () => {
    const id = generateId("!!!");
    expect(id).toMatch(/^\d+-issue$/);
  });
});

describe("sortByOrder", () => {
  it("returns issues unchanged when there is no saved order", () => {
    const issues = [issue("a"), issue("b")];
    expect(sortByOrder(issues, [])).toEqual(issues);
  });

  it("orders issues per the saved '{id}.md' filename list", () => {
    const issues = [issue("a"), issue("b"), issue("c")];
    const sorted = sortByOrder(issues, ["c.md", "a.md", "b.md"]);
    expect(sorted.map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("appends issues missing from the order, preserving their original relative order", () => {
    const issues = [issue("a"), issue("b"), issue("c")];
    const sorted = sortByOrder(issues, ["b.md"]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("ignores order entries for issues that no longer exist", () => {
    const issues = [issue("a"), issue("b")];
    const sorted = sortByOrder(issues, ["ghost.md", "b.md", "a.md"]);
    expect(sorted.map((i) => i.id)).toEqual(["b", "a"]);
  });
});
