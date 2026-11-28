import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import {
  aiReadySpecLevel,
  COLUMNS,
  frontmatterOf,
  parseSettings,
  parseSpecLevels,
  visibleColumns,
} from "./issue-format";

describe("parseSettings", () => {
  it("hides nothing when hiddenStatuses is missing", () => {
    expect(parseSettings("{}")).toEqual({ hiddenStatuses: [] });
  });

  it("hides nothing when the document is not an object", () => {
    expect(parseSettings("[]")).toEqual({ hiddenStatuses: [] });
    expect(parseSettings("null")).toEqual({ hiddenStatuses: [] });
  });

  it("hides nothing when hiddenStatuses is not an array", () => {
    expect(parseSettings('{"hiddenStatuses":"reviewing"}')).toEqual({ hiddenStatuses: [] });
  });

  it("reads hidden statuses", () => {
    expect(parseSettings('{"hiddenStatuses":["reviewing"]}')).toEqual({
      hiddenStatuses: ["reviewing"],
    });
  });

  it("ignores unknown names, non-strings, and duplicates", () => {
    expect(
      parseSettings('{"hiddenStatuses":["reviewing","nope",1,"reviewing"," done "]}')
    ).toEqual({ hiddenStatuses: ["reviewing", "done"] });
  });

  it("throws when the JSON is invalid", () => {
    expect(() => parseSettings("{")).toThrow();
  });
});

describe("visibleColumns", () => {
  it("lists releasing between reviewing and done when nothing is hidden", () => {
    expect(visibleColumns([])).toEqual(COLUMNS);
    expect(COLUMNS).toEqual(["todo", "working", "reviewing", "releasing", "done", "pending"]);
  });

  it("omits hidden statuses and keeps board order", () => {
    expect(visibleColumns(["reviewing"])).toEqual([
      "todo",
      "working",
      "releasing",
      "done",
      "pending",
    ]);
  });

  it("ignores names that are not columns", () => {
    expect(visibleColumns(["nope"])).toEqual(COLUMNS);
  });
});

describe("parseSpecLevels", () => {
  it("reads the shipped choice list, keeping the blank entry", () => {
    const shipped = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../../issues/_specLevels.json"),
      "utf8"
    );
    expect(parseSpecLevels(shipped)).toEqual(["", "memo", "refining", "clear"]);
    expect(aiReadySpecLevel(parseSpecLevels(shipped))).toBe("clear");
  });

  it("trims entries and drops non-strings and duplicates", () => {
    expect(parseSpecLevels('[" memo ", 1, null, "memo", "  ", "clear"]')).toEqual([
      "memo",
      "",
      "clear",
    ]);
  });

  it("returns no choices when the document is not an array", () => {
    expect(parseSpecLevels("{}")).toEqual([]);
    expect(parseSpecLevels("null")).toEqual([]);
  });

  it("throws when the JSON is invalid", () => {
    expect(() => parseSpecLevels("{")).toThrow();
  });
});

describe("aiReadySpecLevel", () => {
  it("uses the last named choice, skipping the blank entry", () => {
    expect(aiReadySpecLevel(["", "memo", "refining", "clear"])).toBe("clear");
    expect(aiReadySpecLevel(["memo", "clear", ""])).toBe("clear");
  });

  it("follows a renamed or appended final choice", () => {
    expect(aiReadySpecLevel(["", "memo", "ready"])).toBe("ready");
    expect(aiReadySpecLevel(["", "memo", "refining", "clear", "polished"])).toBe("polished");
  });

  it("has no final choice when the file is absent or names none", () => {
    expect(aiReadySpecLevel(null)).toBeUndefined();
    expect(aiReadySpecLevel([])).toBeUndefined();
    expect(aiReadySpecLevel([""])).toBeUndefined();
  });
});

describe("frontmatterOf", () => {
  it("picks only the frontmatter fields from an issue", () => {
    const issue = {
      id: "abc",
      subject: "Subject",
      content: "body",
      status: "todo" as const,
      project: "project-a",
      workingDir: "/home/me/repo",
      pr: "https://github.com/org/repo/pull/1",
    };
    expect(frontmatterOf(issue)).toEqual({
      project: "project-a",
      workingDir: "/home/me/repo",
      specLevel: undefined,
      pr: "https://github.com/org/repo/pull/1",
      sessionId: undefined,
    });
  });
});
