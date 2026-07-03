// Central app state, backed by the Rust commands in src-tauri.
// Views subscribe to changes and re-render; all mutations go through here.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import {
  Engine,
  EngineStatus,
  Project,
  Renderer,
  Settings,
  Variant,
  compareVersionsDesc,
  engineId,
  variantLabel,
} from "./types";

export type View = "projects" | "engines" | "settings";
export type RemoteStatus = "loading" | "ok" | "error";

interface AppState {
  view: View;
  engines: Engine[];
  projects: Project[];
  settings: Settings;
  remoteStatus: RemoteStatus;
  includePrereleases: boolean;
}

export const state: AppState = {
  view: "projects",
  engines: [],
  projects: [],
  settings: {
    enginesDir: "",
    projectsDir: "",
    downloadSource: "github",
    closeOnLaunch: false,
  },
  remoteStatus: "loading",
  includePrereleases: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  listeners.forEach((fn) => fn());
}

export function setView(view: View): void {
  state.view = view;
  notify();
}

// ---------- startup ----------

export async function init(): Promise<void> {
  await listen<{ id: string; progress: number }>("engine-download-progress", (event) => {
    const engine = state.engines.find((e) => e.id === event.payload.id);
    if (engine && engine.status === "downloading") {
      engine.progress = event.payload.progress;
      notify();
    }
  });

  try {
    state.settings = await invoke<Settings>("get_settings");
  } catch (e) {
    toast(String(e), "danger");
  }
  await refreshLocal();
  void refreshRemote(); // network fetch in the background
}

/** Reload installed engines + projects from disk. */
export async function refreshLocal(): Promise<void> {
  try {
    // pick up projects that already live in the projects directory
    const found = await invoke<number>("scan_projects");
    if (found > 0) {
      toast(`Found ${found} project${found === 1 ? "" : "s"} in your projects folder`, "success");
    }
  } catch {
    // scan is best-effort
  }
  try {
    const [installed, projects] = await Promise.all([
      invoke<Engine[]>("list_installed_engines"),
      invoke<Project[]>("list_projects"),
    ]);
    state.projects = projects;
    mergeEngines(installed, null);
  } catch (e) {
    toast(String(e), "danger");
  }
  notify();
}

/** Fetch the list of downloadable versions from GitHub. */
export async function refreshRemote(): Promise<void> {
  state.remoteStatus = "loading";
  notify();
  try {
    const remote = await invoke<Engine[]>("fetch_available_engines", {
      includePrereleases: state.includePrereleases,
    });
    mergeEngines(null, remote);
    state.remoteStatus = "ok";
  } catch (e) {
    state.remoteStatus = "error";
    toast(`Could not fetch engine list: ${e}`, "danger");
  }
  notify();
}

export async function setIncludePrereleases(value: boolean): Promise<void> {
  state.includePrereleases = value;
  await refreshRemote();
}

/**
 * Merge installed and/or remote engine lists into state.engines.
 * Installed status wins; remote entries contribute size/date/download-url.
 */
function mergeEngines(installed: Engine[] | null, remote: Engine[] | null): void {
  const byId = new Map<string, Engine>();
  for (const e of state.engines) byId.set(e.id, e);

  if (remote) {
    // drop previously-known "available" entries; the fresh fetch replaces them
    for (const [id, e] of byId) {
      if (e.status === "available") byId.delete(id);
    }
    for (const r of remote) {
      const existing = byId.get(r.id);
      if (existing) {
        // installed (or downloading) — enrich with remote metadata
        existing.releaseDate = existing.releaseDate || r.releaseDate;
        existing.downloadUrl = r.downloadUrl;
      } else {
        byId.set(r.id, { ...r, progress: 0 });
      }
    }
  }

  if (installed) {
    const installedIds = new Set(installed.map((e) => e.id));
    for (const [id, e] of byId) {
      // an engine that was installed but vanished from disk reverts to available
      if (e.status === "installed" && !installedIds.has(id)) {
        if (e.downloadUrl) {
          e.status = "available";
          e.path = null;
        } else {
          byId.delete(id);
        }
      }
    }
    for (const i of installed) {
      const existing = byId.get(i.id);
      if (existing) {
        existing.status = "installed";
        existing.path = i.path;
        existing.sizeMb = i.sizeMb || existing.sizeMb;
        existing.progress = 100;
      } else {
        byId.set(i.id, { ...i, progress: 100 });
      }
    }
  }

  state.engines = [...byId.values()].sort(
    (a, b) => compareVersionsDesc(a.version, b.version) || a.variant.localeCompare(b.variant),
  );
}

// ---------- engine helpers ----------

export function findEngine(version: string, variant: Variant): Engine | undefined {
  return state.engines.find((e) => e.id === engineId(version, variant));
}

// Version/variant matching (mirrors src-tauri/src/engines.rs):
// projects store major.minor ("4.4"); engines may carry a patch ("4.4.1").
function versionMatchScore(engineVersion: string, projectVersion: string): number | null {
  if (engineVersion === projectVersion) return 0;
  if (engineVersion.startsWith(`${projectVersion}.`)) return 1; // patch release
  if (engineVersion.startsWith(`${projectVersion}-`)) return 2; // prerelease
  return null;
}

// A .NET engine can open a standard project; the reverse is not true.
function variantMatchScore(engineVariant: Variant, projectVariant: Variant): number | null {
  if (engineVariant === projectVariant) return 0;
  if (engineVariant === "dotnet" && projectVariant === "standard") return 1;
  return null;
}

/** Best engine satisfying a project's requirement, among the given statuses. */
export function bestEngineForProject(
  project: Project,
  statuses: EngineStatus[],
): Engine | undefined {
  let best: Engine | undefined;
  let bestScore = Infinity;
  for (const e of state.engines) {
    if (!statuses.includes(e.status)) continue;
    const vs = versionMatchScore(e.version, project.engineVersion);
    const vas = variantMatchScore(e.variant, project.variant);
    if (vs === null || vas === null) continue;
    const score = vs * 2 + vas;
    if (
      score < bestScore ||
      (score === bestScore && best && compareVersionsDesc(e.version, best.version) < 0)
    ) {
      best = e;
      bestScore = score;
    }
  }
  return best;
}

export function installedEngines(): Engine[] {
  return state.engines.filter((e) => e.status === "installed");
}

export async function startDownload(engine: Engine): Promise<void> {
  if (engine.status !== "available") return;
  if (!engine.downloadUrl) {
    toast(`No download available for Godot ${engine.version} on this platform`, "danger");
    return;
  }
  engine.status = "downloading";
  engine.progress = 0;
  notify();
  try {
    const installed = await invoke<Engine>("download_engine", {
      version: engine.version,
      variant: engine.variant,
      url: engine.downloadUrl,
    });
    engine.status = "installed";
    engine.path = installed.path;
    engine.sizeMb = installed.sizeMb;
    engine.progress = 100;
    toast(`Godot ${engine.version} (${variantLabel(engine.variant)}) installed`, "success");
  } catch (e) {
    engine.status = "available";
    engine.progress = 0;
    toast(`Download failed: ${e}`, "danger");
  }
  notify();
}

export async function removeEngine(engine: Engine): Promise<void> {
  try {
    if (engine.source === "external") {
      // manually-added engine: only forget it, never touch its files
      await invoke("remove_external_engine", { id: engine.id });
      state.engines = state.engines.filter((e) => e.id !== engine.id);
      toast(`Godot ${engine.version} removed from the list (files untouched)`);
    } else {
      await invoke("remove_engine", { version: engine.version, variant: engine.variant });
      if (engine.downloadUrl) {
        engine.status = "available";
        engine.path = null;
        engine.progress = 0;
      } else {
        state.engines = state.engines.filter((e) => e.id !== engine.id);
      }
      toast(`Godot ${engine.version} (${variantLabel(engine.variant)}) removed`);
    }
  } catch (e) {
    toast(String(e), "danger");
  }
  notify();
}

export type AddEngineResult = "ok" | "needManual" | "error";

/** Register an engine binary that lives outside the managed engines dir. */
export async function addExternalEngine(
  path: string,
  version?: string,
  variant?: Variant,
): Promise<AddEngineResult> {
  try {
    const engine = await invoke<Engine>("add_external_engine", {
      path,
      version: version ?? null,
      variant: variant ?? null,
    });
    mergeEngines([...installedEngines(), { ...engine, progress: 100 }], null);
    toast(`Godot ${engine.version} (${variantLabel(engine.variant)}) added`, "success");
    notify();
    return "ok";
  } catch (e) {
    if (String(e).includes("DETECT_FAILED")) {
      return "needManual";
    }
    toast(String(e), "danger");
    return "error";
  }
}

// ---------- project helpers ----------

export async function openProject(project: Project): Promise<void> {
  try {
    await invoke("open_project", { id: project.id });
    project.lastOpened = Date.now();
    state.projects = [project, ...state.projects.filter((p) => p.id !== project.id)];
    toast(`Launching "${project.name}" with Godot ${project.engineVersion}…`, "success");
  } catch (e) {
    toast(String(e), "danger");
  }
  notify();
}

export async function createProject(
  name: string,
  folder: string,
  version: string,
  variant: Variant,
  renderer: Renderer,
): Promise<boolean> {
  try {
    const project = await invoke<Project>("create_project", {
      name,
      folder,
      version,
      variant,
      renderer,
    });
    state.projects = [project, ...state.projects.filter((p) => p.id !== project.id)];
    toast(`Project "${name}" created`, "success");
    notify();
    return true;
  } catch (e) {
    toast(String(e), "danger");
    return false;
  }
}

export async function importProject(path: string): Promise<boolean> {
  try {
    const project = await invoke<Project>("import_project", { path });
    state.projects = [project, ...state.projects];
    toast(`Imported "${project.name}" (Godot ${project.engineVersion})`, "success");
    notify();
    return true;
  } catch (e) {
    toast(String(e), "danger");
    return false;
  }
}

export async function changeProjectEngine(
  project: Project,
  version: string,
  variant: Variant,
): Promise<void> {
  try {
    const updated = await invoke<Project>("change_project_engine", {
      id: project.id,
      version,
      variant,
    });
    project.engineVersion = updated.engineVersion;
    project.variant = updated.variant;
    const engine = findEngine(version, variant);
    if (engine && engine.status === "available") {
      toast(
        `"${project.name}" set to Godot ${version} (${variantLabel(variant)}) — downloading…`,
        "success",
      );
      void startDownload(engine);
    } else {
      toast(`"${project.name}" now uses Godot ${version} (${variantLabel(variant)})`, "success");
    }
  } catch (e) {
    toast(String(e), "danger");
  }
  notify();
}

export async function removeProject(project: Project): Promise<void> {
  try {
    await invoke("remove_project", { id: project.id });
    state.projects = state.projects.filter((p) => p.id !== project.id);
    toast(`Removed "${project.name}" from the list`);
  } catch (e) {
    toast(String(e), "danger");
  }
  notify();
}

// ---------- settings ----------

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await invoke("set_settings", { settings });
    const dirsChanged =
      settings.enginesDir !== state.settings.enginesDir ||
      settings.projectsDir !== state.settings.projectsDir;
    state.settings = settings;
    toast("Settings saved", "success");
    if (dirsChanged) await refreshLocal();
  } catch (e) {
    toast(String(e), "danger");
  }
  notify();
}

// ---------- toasts ----------

export function toast(message: string, kind: "info" | "success" | "danger" = "info"): void {
  const root = document.getElementById("toast-root")!;
  const el = document.createElement("div");
  el.className = `toast ${kind === "info" ? "" : kind}`.trim();
  el.textContent = message;
  root.appendChild(el);
  window.setTimeout(() => {
    el.classList.add("leaving");
    window.setTimeout(() => el.remove(), 220);
  }, 3200);
}
