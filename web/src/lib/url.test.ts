import { describe, it, expect } from "vitest";
import { openableHttpUrl } from "./url";

describe("openableHttpUrl", () => {
  it("returns an http(s) URL", () => {
    expect(openableHttpUrl("https://github.com/org/repo/pull/12")).toBe(
      "https://github.com/org/repo/pull/12"
    );
    expect(openableHttpUrl("  http://example.com/pr  ")).toBe("http://example.com/pr");
  });

  it("rejects blank values and non-http schemes", () => {
    expect(openableHttpUrl(undefined)).toBeUndefined();
    expect(openableHttpUrl("")).toBeUndefined();
    expect(openableHttpUrl("   ")).toBeUndefined();
    expect(openableHttpUrl("not a url")).toBeUndefined();
    expect(openableHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(openableHttpUrl("github.com/org/repo/pull/1")).toBeUndefined();
  });
});
