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
    localStorage.removeItem("kanban-lo:selectedProject");
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

  it("restores the project filter dropdown to the persisted project once the project list loads", async () => {
    // The project list only arrives after the async reload(), i.e. after the
    // persisted selection is already applied — the <select>'s DOM value must
    // be re-applied once its matching <option> exists.
    localStorage.setItem("kanban-lo:selectedProject", "project-b");
    vi.resetModules();
    const { default: FreshApp } = await import("./App");
    const freshDav = await import("./services/webdav");
    vi.mocked(freshDav.loadAllIssues).mockResolvedValue([]);
    vi.mocked(freshDav.loadProjects).mockResolvedValue(["project-a", "project-b"]);

    const { findByLabelText } = render(() => <FreshApp />);
    const select = (await findByLabelText("Filter by project")) as HTMLSelectElement;

    await vi.waitFor(() => expect(select.value).toBe("project-b"));
  });
});
