// App entry: sidebar navigation + view rendering.

import { getVersion } from "@tauri-apps/api/app";

import { init, setView, state, subscribe, View } from "./state";
import { renderProjects } from "./views/projects";
import { renderEngines } from "./views/engines";
import {
  renderSettings,
  resetSettingsDirty,
  settingsHasUnsavedChanges,
} from "./views/settings";
import { showConfirmModal, showFirstRunModal } from "./components/modals";

const viewRenderers: Record<View, (root: HTMLElement) => void> = {
  projects: renderProjects,
  engines: renderEngines,
  settings: renderSettings,
};

let lastRenderedView: View | null = null;

function render(): void {
  const root = document.getElementById("view-root")!;

  // Settings is a form — don't clobber in-progress edits when background
  // state changes (e.g. a download finishing) trigger a notify().
  if (state.view === "settings" && lastRenderedView === "settings") return;

  viewRenderers[state.view](root);
  lastRenderedView = state.view;

  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === state.view);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  // Suppress the webview's native context menu (keep it for text inputs,
  // where copy/paste is genuinely useful).
  window.addEventListener("contextmenu", (e) => {
    const t = e.target as HTMLElement;
    if (!(t instanceof HTMLInputElement) && !(t instanceof HTMLTextAreaElement)) {
      e.preventDefault();
    }
  });

  document.querySelectorAll<HTMLButtonElement>(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.view as View;
      // leaving Settings with unsaved edits? confirm first
      if (state.view === "settings" && target !== "settings" && settingsHasUnsavedChanges()) {
        showConfirmModal(
          "Unsaved Changes",
          "You have unsaved settings. Leave anyway and discard the changes?",
          "Discard & Leave",
          () => {
            resetSettingsDirty();
            setView(target);
          },
        );
        return;
      }
      setView(target);
    });
  });

  void getVersion().then((v) => {
    const el = document.querySelector(".app-version");
    if (el) el.textContent = `v${v}`;
  });

  subscribe(render);
  render();
  void init().then(() => {
    // first launch (or wiped settings): prompt for the two directories
    if (!state.settings.enginesDir || !state.settings.projectsDir) {
      showFirstRunModal();
    }
  });
});
