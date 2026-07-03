// Projects view: searchable list of known projects with engine badges.

import { revealItemInDir } from "@tauri-apps/plugin-opener";

import { Project, compareVersionsDesc, fmtRelative, variantLabel } from "../types";
import { esc, onDataClick, q } from "../dom";
import {
  bestEngineForProject,
  importProject,
  openProject,
  removeProject,
  startDownload,
  state,
  toast,
  toggleProjectPinned,
} from "../state";
import {
  pickFolder,
  showChangeEngineModal,
  showConfirmModal,
  showNewProjectModal,
} from "../components/modals";

let searchQuery = "";
// project ids currently mid-launch — gives the Open button instant feedback
// instead of sitting inert for the second or two open_project takes to spawn
const openingIds = new Set<string>();

type SortKey = "recent" | "name" | "engine";
let sortKey: SortKey = "recent";

const sortLabels: Record<SortKey, string> = {
  recent: "Recently opened",
  name: "Name",
  engine: "Engine version",
};

const sortComparators: Record<SortKey, (a: Project, b: Project) => number> = {
  recent: (a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0),
  name: (a, b) => a.name.localeCompare(b.name),
  engine: (a, b) =>
    compareVersionsDesc(a.engineVersion, b.engineVersion) || a.variant.localeCompare(b.variant),
};

function sortProjects(list: Project[]): Project[] {
  return [...list].sort(sortComparators[sortKey]);
}

function engineBadge(p: Project, installed: boolean): string {
  const version = esc(p.engineVersion);
  const versionBadge = installed
    ? `<span class="badge badge-version">${version}</span>`
    : `<span class="badge badge-missing" title="Engine not installed">${version} ⚠</span>`;
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
  const id = esc(p.id);

  let mainAction: string;
  if (installedEngine) {
    mainAction = openingIds.has(p.id)
      ? `
      <button class="btn btn-primary btn-sm" disabled>
        <span class="btn-spinner"></span> Opening…
      </button>`
      : `
      <button class="btn btn-primary btn-sm" data-open="${id}"
        title="Open with Godot ${esc(installedEngine.version)} (${variantLabel(installedEngine.variant)})">
        Open
      </button>`;
  } else if (downloadingEngine) {
    mainAction = `
      <div class="progress-wrap" style="min-width: 130px;" title="Downloading Godot ${esc(downloadingEngine.version)}">
        <div class="progress-track"><div class="progress-fill" style="width:${downloadingEngine.progress}%"></div></div>
        <span class="progress-label">${Math.floor(downloadingEngine.progress)}%</span>
      </div>`;
  } else if (availableEngine) {
    mainAction = `
      <button class="btn btn-primary btn-sm" data-install="${id}"
        title="Download Godot ${esc(availableEngine.version)} (${variantLabel(availableEngine.variant)})">
        Install ${esc(availableEngine.version)}
      </button>`;
  } else {
    // no candidate at all (e.g. "3.x" import placeholder) — prompt a version pick
    mainAction = `
      <button class="btn btn-sm" data-pick="${id}" title="Choose which engine to use">
        Choose engine…
      </button>`;
  }

  const opened = p.lastOpened ? `opened ${fmtRelative(p.lastOpened)}` : "never opened";

  return `
    <div class="card" data-project="${id}">
      <div class="card-icon">▦</div>
      <div class="card-body">
        <div class="card-title">${esc(p.name)} ${engineBadge(p, !!installedEngine)}</div>
        <div class="card-sub">${esc(p.path)}</div>
      </div>
      <span class="card-meta">${opened}</span>
      <div class="card-actions">
        ${mainAction}
        <button class="btn btn-ghost btn-sm" data-pin="${id}" title="${p.pinned ? "Unpin" : "Pin to top"}"
          style="${p.pinned ? "color: var(--warning);" : ""}">
          ${p.pinned ? "★" : "☆"}
        </button>
        <button class="btn btn-ghost btn-sm" data-folder="${id}" title="Show in file explorer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
        </button>
        <button class="btn btn-ghost btn-sm" data-change="${id}" title="Change engine version">⚙</button>
        <button class="btn btn-ghost btn-sm" data-remove="${id}" title="Remove from list">✕</button>
      </div>
    </div>`;
}

export function renderProjects(root: HTMLElement): void {
  const query = searchQuery.toLowerCase();
  const filtered = state.projects.filter(
    (p) => !query || p.name.toLowerCase().includes(query) || p.path.toLowerCase().includes(query),
  );
  const pinned = sortProjects(filtered.filter((p) => p.pinned));
  const rest = sortProjects(filtered.filter((p) => !p.pinned));

  const sortOptions = (Object.keys(sortLabels) as SortKey[])
    .map((key) => `<option value="${key}" ${key === sortKey ? "selected" : ""}>${sortLabels[key]}</option>`)
    .join("");

  const list = (title: string, items: Project[]) =>
    items.length
      ? `${pinned.length ? `<div class="group-title">${title}</div>` : ""}
         <div class="card-list">${items.map(projectCard).join("")}</div>`
      : "";

  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Projects</h1>
      <span class="spacer"></span>
      <select id="project-sort" title="Sort by">${sortOptions}</select>
      <input type="text" class="search-box" id="project-search" placeholder="Search projects…" value="${esc(searchQuery)}" />
      <button class="btn" id="btn-import">Import</button>
      <button class="btn btn-primary" id="btn-new">+ New Project</button>
    </div>
    ${
      filtered.length
        ? `${list("📌 Pinned", pinned)}${list("All Projects", rest)}`
        : `<div class="empty-state">
             <div class="empty-icon">▦</div>
             <p><strong>${searchQuery ? "No projects match your search" : "No projects yet"}</strong></p>
             <p>${searchQuery ? "Try a different search term." : "Create a new project or import an existing one."}</p>
           </div>`
    }`;

  const search = q<HTMLInputElement>(root, "#project-search");
  search.addEventListener("input", () => {
    searchQuery = search.value;
    renderProjects(root);
    const s = q<HTMLInputElement>(root, "#project-search");
    s.focus();
    s.setSelectionRange(s.value.length, s.value.length);
  });

  q<HTMLSelectElement>(root, "#project-sort").addEventListener("change", (e) => {
    sortKey = (e.target as HTMLSelectElement).value as SortKey;
    renderProjects(root);
  });

  q(root, "#btn-new").addEventListener("click", showNewProjectModal);
  q(root, "#btn-import").addEventListener("click", async () => {
    const path = await pickFolder("Choose a Godot project folder", state.settings.projectsDir);
    if (path) await importProject(path);
  });

  const project = (id: string) => state.projects.find((p) => p.id === id);
  const pickEngine = (id: string) => {
    const p = project(id);
    if (p) showChangeEngineModal(p);
  };

  onDataClick(root, "open", (id) => {
    const p = project(id);
    if (!p || openingIds.has(id)) return;
    // instant feedback — don't wait on the invoke() round trip to show anything
    openingIds.add(id);
    renderProjects(root);
    void openProject(p).finally(() => {
      openingIds.delete(id);
      renderProjects(root);
    });
  });

  onDataClick(root, "pin", (id) => {
    const p = project(id);
    if (p) void toggleProjectPinned(p).then(() => renderProjects(root));
  });

  onDataClick(root, "install", (id) => {
    const p = project(id);
    const engine = p && bestEngineForProject(p, ["available"]);
    if (engine) void startDownload(engine);
  });

  onDataClick(root, "folder", async (id) => {
    const p = project(id);
    if (!p) return;
    try {
      // reveal project.godot → opens the project folder in the file explorer
      await revealItemInDir(`${p.path}/project.godot`);
    } catch (e) {
      toast(String(e), "danger");
    }
  });

  onDataClick(root, "pick", pickEngine);
  onDataClick(root, "change", pickEngine);

  onDataClick(root, "remove", (id) => {
    const p = project(id);
    if (!p) return;
    showConfirmModal(
      "Remove Project",
      `Remove "${p.name}" from the launcher? The project files on disk are not touched.`,
      "Remove",
      () => void removeProject(p),
    );
  });
}
