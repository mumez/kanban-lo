import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import Board from "./Board";
import { kanbanStore } from "../store/kanban";
import * as dav from "../services/webdav";

vi.mock("../services/webdav");

async function loadBoard(
  hiddenStatuses: Array<"todo" | "working" | "reviewing" | "releasing" | "done" | "pending"> = []
) {
  vi.mocked(dav.loadAllIssues).mockResolvedValue([
    { id: "1", subject: "Needs review", content: "", status: "reviewing" },
    { id: "2", subject: "Still todo", content: "", status: "todo" },
  ]);
  vi.mocked(dav.loadProjects).mockResolvedValue([]);
  vi.mocked(dav.loadSettings).mockResolvedValue({ hiddenStatuses });
  await kanbanStore.reload();
  return render(() => <Board />);
}

describe("Board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows releasing between reviewing and done when settings hide nothing", async () => {
    const { container } = await loadBoard();

    expect(screen.getByRole("heading", { name: "Reviewing" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Releasing" })).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Todo",
      "Working",
      "Reviewing",
      "Releasing",
      "Done",
      "Pending",
    ]);
    expect(container.querySelector(".grid")).toHaveClass("xl:grid-cols-6");
  });

  it("hides a column listed in hiddenStatuses, including its cards", async () => {
    const { container } = await loadBoard(["reviewing"]);

    expect(screen.queryByRole("heading", { name: "Reviewing" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Releasing" })).toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
    expect(screen.getByText("Still todo")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5);
    expect(container.querySelector(".grid")).toHaveClass("xl:grid-cols-5");
  });

  it("uses four wide-screen tracks when only four columns stay visible", async () => {
    const { container } = await loadBoard(["reviewing", "releasing"]);

    expect(screen.queryByRole("heading", { name: "Releasing" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(4);
    expect(container.querySelector(".grid")).toHaveClass("xl:grid-cols-4");
  });

  it("drops a column when settings are reloaded without remounting the board", async () => {
    await loadBoard([]);
    expect(screen.getByRole("heading", { name: "Reviewing" })).toBeInTheDocument();

    vi.mocked(dav.loadSettings).mockResolvedValue({ hiddenStatuses: ["reviewing"] });
    await kanbanStore.reload();

    expect(screen.queryByRole("heading", { name: "Reviewing" })).not.toBeInTheDocument();
    expect(screen.queryByText("Needs review")).not.toBeInTheDocument();
    expect(screen.getByText("Still todo")).toBeInTheDocument();
  });
});
