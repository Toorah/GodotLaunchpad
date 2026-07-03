// Projects view: searchable list of known projects with engine badges.

import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { Project, fmtRelative, variantLabel } from "../types";
import {
  bestEngineForProject,
  importProject,
  openProject,
  removeProject,
  startDownload,
  state,
  toast,
} from "../state";
import {
  pickFolder,
  showChangeEngineModal,
  showConfirmModal,
  showNewProjectModal,
} from "../components/modals";

let searchQuery = "";

function engineBadge(p: Project, installed: boolean): string {
  const versionBadge = installed
    ? `<span class="badge badge-version">${p.engineVersion}</span>`
    : `<span class="badge badge-missing" title="Engine not installed">${p.engineVersion} ⚠</span>`;
  const variantBadge =
    p.variant === "dotnet" ? `<span class="badge badge-dotnet">.NET</span>` : "";
  return versionBadge + variantBadge;
}

function projectCard(p: Project): string {
  // best installed match first (exact > patch release > .NET standing in)
  const installedEngine = bestEngineForProject(p, ["installed"]);
  const downloadingEngine = installedEngine ? undefined : bestEngineForProject(p, ["downloading"]);
  const availableEngine =
    installedEngine || downloadingEngine ? undefined : bestEngineForProject(p, ["available"]);

  let mainAction: string;
  if (installedEngine) {
    mainAction = `
      <button class="btn btn-primary btn-sm" data-open="${p.id}"
        title="Open with Godot ${installedEngine.version} (${variantLabel(installedEngine.variant)})">
        Open
      </button>`;
  } else if (downloadingEngine) {
    mainAction = `
      <div class="progress-wrap" style="min-width: 130px;" title="Downloading Godot ${downloadingEngine.version}">
        <div class="progress-track"><div class="progress-fill" style="width:${downloadingEngine.progress}%"></div></div>
        <span class="progress-label">${Math.floor(downloadingEngine.progress)}%</span>
      </div>`;
  } else if (availableEngine) {
    mainAction = `
      <button class="btn btn-primary btn-sm" data-install="${p.id}"
        title="Download Godot ${availableEngine.version} (${variantLabel(availableEngine.variant)})">
        Install ${availableEngine.version}
      </button>`;
  } else {
    // no candidate at all (e.g. "3.x" import placeholder) — prompt a version pick
    mainAction = `
      <button class="btn btn-sm" data-pick="${p.id}" title="Choose which engine to use">
        Choose engine…
      </button>`;
  }

  const opened = p.lastOpened ? `opened ${fmtRelative(p.lastOpened)}` : "never opened";

  return `
    <div class="card" data-project="${p.id}">
      <div class="card-icon">▦</div>
      <div class="card-body">
        <div class="card-title">${p.name} ${engineBadge(p, !!installedEngine)}</div>
        <div class="card-sub">${p.path}</div>
      </div>
      <span class="card-meta">${opened}</span>
      <div class="card-actions">
        ${mainAction}
        <button class="btn btn-ghost btn-sm" data-folder="${p.id}" title="Show in file explorer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-sm" data-change="${p.id}" title="Change engine version">⚙</button>
        <button class="btn btn-ghost btn-sm" data-remove="${p.id}" title="Remove from list">✕</button>
      </div>
    </div>`;
}

export function renderProjects(root: HTMLElement): void {
  const q = searchQuery.toLowerCase();
  const projects = state.projects.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
  );

  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Projects</h1>
      <span class="spacer"></span>
      <input type="text" class="search-box" id="project-search" placeholder="Search projects…" value="${searchQuery}" />
      <button class="btn" id="btn-import">Import</button>
      <button class="btn btn-primary" id="btn-new">+ New Project</button>
    </div>
    ${
      projects.length
        ? `<div class="card-list">${projects.map(projectCard).join("")}</div>`
        : `<div class="empty-state">
             <div class="empty-icon">▦</div>
             <p><strong>${searchQuery ? "No projects match your search" : "No projects yet"}</strong></p>
             <p>${searchQuery ? "Try a different search term." : "Create a new project or import an existing one."}</p>
           </div>`
    }`;

  const search = root.querySelector("#project-search") as HTMLInputElement;
  search.addEventListener("input", () => {
    searchQuery = search.value;
    renderProjects(root);
    const s = root.querySelector("#project-search") as HTMLInputElement;
    s.focus();
    s.setSelectionRange(s.value.length, s.value.length);
  });

  root.querySelector("#btn-new")!.addEventListener("click", showNewProjectModal);
  root.querySelector("#btn-import")!.addEventListener("click", async () => {
    const path = await pickFolder("Choose a Godot project folder", state.settings.projectsDir);
    if (path) await importProject(path);
  });

  root.querySelectorAll<HTMLButtonElement>("[data-open]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const p = state.projects.find((x) => x.id === btn.dataset.open);
      if (p) void openProject(p);
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-install]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const p = state.projects.find((x) => x.id === btn.dataset.install);
      if (!p) return;
      const engine = bestEngineForProject(p, ["available"]);
      if (engine) void startDownload(engine);
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-folder]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const p = state.projects.find((x) => x.id === btn.dataset.folder);
      if (!p) return;
      try {
        // reveal project.godot → opens the project folder in the file explorer
        await revealItemInDir(`${p.path}/project.godot`);
      } catch (e) {
        toast(String(e), "danger");
      }
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-pick], [data-change]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const id = btn.dataset.pick ?? btn.dataset.change;
      const p = state.projects.find((x) => x.id === id);
      if (p) showChangeEngineModal(p);
    }),
  );

  root.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const p = state.projects.find((x) => x.id === btn.dataset.remove);
      if (!p) return;
      showConfirmModal(
        "Remove Project",
        `Remove "${p.name}" from the launcher? The project files on disk are not touched.`,
        "Remove",
        () => void removeProject(p),
      );
    }),
  );
}
