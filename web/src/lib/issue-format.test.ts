import { describe, it, expect } from "vitest";
import { COLUMNS, parseSettings, visibleColumns } from "./issue-format";

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
