import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@solidjs/testing-library";
import App from "./App";
import * as dav from "./services/webdav";

vi.mock("./services/webdav");

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dav.loadAllIssues).mockResolvedValue([]);
    vi.mocked(dav.loadProjects).mockResolvedValue([]);
  });

  afterEach(() => {
    setVisibilityState("visible");
  });

  it("reloads issues when the tab becomes visible again", async () => {
    render(() => <App />);
    expect(dav.loadAllIssues).toHaveBeenCalledTimes(1);

    setVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    expect(dav.loadAllIssues).toHaveBeenCalledTimes(2);
  });

  it("does not reload when the tab becomes hidden", async () => {
    render(() => <App />);
    expect(dav.loadAllIssues).toHaveBeenCalledTimes(1);

    setVisibilityState("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    await Promise.resolve();

    expect(dav.loadAllIssues).toHaveBeenCalledTimes(1);
  });
});
