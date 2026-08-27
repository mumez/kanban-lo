import { type Component, onMount, Show } from "solid-js";
import { kanbanStore } from "./store/kanban";
import Board from "./components/Board";
import IssueModal from "./components/IssueModal";

const App: Component = () => {
  onMount(() => {
    kanbanStore.init();
  });

  return (
    <div class="min-h-screen bg-base-200 flex flex-col">
      {/* Navbar */}
      <nav class="navbar bg-base-100 shadow-sm px-4 sticky top-0 z-10">
        <div class="navbar-start">
          <span class="text-xl font-bold tracking-tight">
            📋 kanban-lo
          </span>
        </div>

        <div class="navbar-end gap-2">
          {/* Loading indicator */}
          <Show when={kanbanStore.loading}>
            <span class="loading loading-spinner loading-sm text-primary" />
          </Show>

          {/* Reload button */}
          <button
            class="btn btn-ghost btn-sm btn-circle"
            title="Reload"
            disabled={kanbanStore.loading}
            onClick={() => kanbanStore.reload()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
            </svg>
          </button>

          {/* New Issue button */}
          <button
            class="btn btn-primary btn-sm gap-1"
            onClick={() => kanbanStore.openCreateModal("todo")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            New Issue
          </button>
        </div>
      </nav>

      {/* Global error banner */}
      <Show when={kanbanStore.error}>
        <div class="alert alert-error rounded-none text-sm px-4 py-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
          <span>{kanbanStore.error}</span>
        </div>
      </Show>

      {/* Kanban board */}
      <main class="flex-1 overflow-auto">
        <Board />
      </main>

      {/* Issue create / edit modal */}
      <IssueModal />
    </div>
  );
};

export default App;
