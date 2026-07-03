// Engines view: installed engines + downloadable versions from GitHub.

import { Engine, Variant, compareVersionsDesc, fmtSize, variantLabel } from "../types";
import { esc, onDataClick, q } from "../dom";
import { refreshRemote, removeEngine, setIncludePrereleases, startDownload, state } from "../state";
import { addEngineFlow, showConfirmModal } from "../components/modals";

let variantFilter: Variant | "all" = "all";

function engineCard(e: Engine): string {
  const badges = `
    ${e.variant === "dotnet" ? `<span class="badge badge-dotnet">.NET</span>` : ""}
    ${e.channel !== "stable" ? `<span class="badge badge-channel">${e.channel}</span>` : ""}
    ${e.status === "installed" ? `<span class="badge badge-installed">Installed</span>` : ""}
    ${e.source === "external" ? `<span class="badge badge-external" title="Added manually — lives outside the managed engines folder">External</span>` : ""}`;

  let actions: string;
  if (e.status === "downloading") {
    actions = `
      <div class="progress-wrap">
        <div class="progress-track"><div class="progress-fill" style="width:${e.progress}%"></div></div>
        <span class="progress-label">${Math.floor(e.progress)}%</span>
      </div>`;
  } else if (e.status === "installed" && e.source === "external") {
    actions = `<button class="btn btn-sm" data-remove="${esc(e.id)}" title="Removes the entry only — files on disk are not touched">Remove</button>`;
  } else if (e.status === "installed") {
    actions = `<button class="btn btn-danger btn-sm" data-remove="${esc(e.id)}" title="Deletes the engine files from disk">Delete</button>`;
  } else {
    actions = `<button class="btn btn-primary btn-sm" data-download="${esc(e.id)}">Download</button>`;
  }

  const meta: string[] = [variantLabel(e.variant)];
  if (e.sizeMb) meta.push(fmtSize(e.sizeMb));
  if (e.releaseDate) meta.push(`released ${esc(e.releaseDate)}`);
  const sub =
    e.status === "installed" && e.path
      ? `${esc(e.path)}${e.sizeMb ? ` · ${fmtSize(e.sizeMb)}${e.source === "external" ? " (executable only)" : ""}` : ""}`
      : meta.join(" · ");

  return `
    <div class="card">
      <div class="card-icon">⚙</div>
      <div class="card-body">
        <div class="card-title">Godot ${esc(e.version)} ${badges}</div>
        <div class="card-sub">${sub}</div>
      </div>
      <div class="card-actions">${actions}</div>
    </div>`;
}

function visible(e: Engine): boolean {
  if (variantFilter !== "all" && e.variant !== variantFilter) return false;
  if (!state.includePrereleases && e.channel !== "stable") return false;
  return true;
}

/** Grouping key: major.minor ("4.4.1" and "4.4-dev3" both → "4.4"). */
function minorOf(version: string): string {
  return version.split("-")[0].split(".").slice(0, 2).join(".");
}

const statusRank: Record<Engine["status"], number> = {
  installed: 0,
  downloading: 1,
  available: 2,
};

const variantRank = (v: Variant) => (v === "standard" ? 0 : 1);

/** Render a list of engines as minor-version sub-groups, newest first. */
function versionGroups(engines: Engine[], showGroupSize: boolean): string {
  const groups = new Map<string, Engine[]>();
  for (const e of engines) {
    const key = minorOf(e.version);
    const list = groups.get(key);
    if (list) list.push(e);
    else groups.set(key, [e]);
  }
  const orderedKeys = [...groups.keys()].sort(compareVersionsDesc);
  return orderedKeys
    .map((key) => {
      const list = groups.get(key)!;
      list.sort(
        (a, b) =>
          statusRank[a.status] - statusRank[b.status] ||
          compareVersionsDesc(a.version, b.version) ||
          variantRank(a.variant) - variantRank(b.variant),
      );
      const groupMb = showGroupSize
        ? list.reduce((sum, e) => sum + (e.sizeMb || 0), 0)
        : 0;
      const size = groupMb > 0 ? ` · ${fmtSize(groupMb)}` : "";
      return `
        <div class="group-title">Godot ${esc(key)}${size}</div>
        <div class="card-list">${list.map(engineCard).join("")}</div>`;
    })
    .join("");
}

export function renderEngines(root: HTMLElement): void {
  const filtered = state.engines.filter(visible);
  const installed = filtered.filter((e) => e.source !== "external" && e.status === "installed");
  const external = filtered.filter((e) => e.source === "external");
  // engines mid-download stay in this section until they finish
  const available = filtered.filter((e) => e.source !== "external" && e.status !== "installed");

  const installedAll = state.engines.filter((e) => e.status === "installed");
  const totalMb = installedAll.reduce((sum, e) => sum + (e.sizeMb || 0), 0);
  const summary = installedAll.length
    ? `${installedAll.length} installed${totalMb > 0 ? ` · ${fmtSize(totalMb)} on disk` : ""}`
    : "";

  const installedMb = installed.reduce((sum, e) => sum + (e.sizeMb || 0), 0);
  const externalMb = external.reduce((sum, e) => sum + (e.sizeMb || 0), 0);

  let availableSection: string;
  if (available.length) {
    availableSection = versionGroups(available, false);
  } else if (state.remoteStatus === "loading") {
    availableSection = `<div class="empty-state" style="padding: 24px;"><p>Fetching version list from GitHub…</p></div>`;
  } else if (state.remoteStatus === "error") {
    availableSection = `
      <div class="empty-state" style="padding: 24px;">
        <p><strong>Could not reach GitHub.</strong></p>
        <p>Check your connection, then <button class="btn btn-sm" data-retry>Retry</button></p>
      </div>`;
  } else {
    availableSection = `<div class="empty-state" style="padding: 24px;"><p>Nothing to download for this filter.</p></div>`;
  }

  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Engines</h1>
      ${summary ? `<span class="card-meta">${summary}</span>` : ""}
      <span class="spacer"></span>
      <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text-dim); cursor:pointer;">
        <input type="checkbox" id="chk-prerelease" ${state.includePrereleases ? "checked" : ""} />
        Pre-releases
      </label>
      <div class="tabs">
        <button class="tab ${variantFilter === "all" ? "active" : ""}" data-variant="all">All</button>
        <button class="tab ${variantFilter === "standard" ? "active" : ""}" data-variant="standard">Standard</button>
        <button class="tab ${variantFilter === "dotnet" ? "active" : ""}" data-variant="dotnet">.NET</button>
      </div>
      <button class="btn btn-sm" id="btn-refresh" title="Refresh version list" ${state.remoteStatus === "loading" ? "disabled" : ""}>↻</button>
      <button class="btn" id="btn-add-engine" title="Register an existing or custom-built Godot executable">+ Add Engine</button>
    </div>

    <div class="section-title">Downloaded${installedMb > 0 ? ` · ${fmtSize(installedMb)} on disk` : ""}</div>
    ${
      installed.length
        ? versionGroups(installed, true)
        : `<div class="empty-state" style="padding: 24px;"><p>No engines downloaded yet — grab one below or add an existing executable.</p></div>`
    }

    ${
      external.length
        ? `<div class="section-title">External${externalMb > 0 ? ` · ${fmtSize(externalMb)} on disk` : ""}</div>
           ${versionGroups(external, true)}`
        : ""
    }

    <div class="section-title">Available to download</div>
    ${availableSection}`;

  onDataClick(root, "variant", (value) => {
    variantFilter = value as Variant | "all";
    renderEngines(root);
  });

  q<HTMLInputElement>(root, "#chk-prerelease").addEventListener("change", (e) => {
    void setIncludePrereleases((e.target as HTMLInputElement).checked);
  });

  q(root, "#btn-refresh").addEventListener("click", () => void refreshRemote());
  q(root, "#btn-add-engine").addEventListener("click", () => void addEngineFlow());
  root.querySelector("[data-retry]")?.addEventListener("click", () => void refreshRemote());

  onDataClick(root, "download", (id) => {
    const engine = state.engines.find((x) => x.id === id);
    if (engine) void startDownload(engine);
  });

  onDataClick(root, "remove", (id) => {
    const engine = state.engines.find((x) => x.id === id);
    if (!engine) return;
    const external = engine.source === "external";
    showConfirmModal(
      external ? "Remove Engine" : "Delete Engine",
      external
        ? `Remove Godot ${engine.version} (${variantLabel(engine.variant)}) from the launcher? The files on disk are not touched.`
        : `Delete Godot ${engine.version} (${variantLabel(engine.variant)})? This deletes the engine files from disk.`,
      external ? "Remove" : "Delete",
      () => void removeEngine(engine),
    );
  });
}
