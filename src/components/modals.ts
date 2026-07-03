// Modal dialogs: generic shell + New Project / Change Engine / Confirm.

import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { Engine, Project, Renderer, Settings, Variant, variantLabel } from "../types";
import { esc, q } from "../dom";
import {
  addExternalEngine,
  changeProjectEngine,
  createProject,
  installedEngines,
  refreshLocal,
  saveSettings,
  state,
} from "../state";

function openModal(title: string, bodyHtml: string, footerHtml: string): HTMLElement {
  const root = document.getElementById("modal-root")!;
  root.innerHTML = `
    <div class="modal-overlay">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${esc(title)}</h2>
          <button class="modal-close" data-close>✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-footer">${footerHtml}</div>
      </div>
    </div>`;

  const overlay = q(root, ".modal-overlay");
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeModal();
  });
  // the ✕ button plus any footer button marked data-close-btn
  overlay
    .querySelectorAll("[data-close], [data-close-btn]")
    .forEach((btn) => btn.addEventListener("click", closeModal));
  return overlay;
}

export function closeModal(): void {
  document.getElementById("modal-root")!.innerHTML = "";
}

/** Native directory picker; returns null when cancelled. */
export async function pickFolder(title: string, defaultPath?: string): Promise<string | null> {
  const result = await openDialog({
    directory: true,
    title,
    defaultPath: defaultPath || undefined,
  });
  return typeof result === "string" ? result : null;
}

/** `<option>` for picking an engine, encoded as "version|variant". */
function engineOption(e: Engine, selectedValue?: string): string {
  const value = `${e.version}|${e.variant}`;
  return `<option value="${esc(value)}" ${value === selectedValue ? "selected" : ""}>
      Godot ${esc(e.version)} — ${variantLabel(e.variant)}${e.channel !== "stable" ? ` (${e.channel})` : ""}
    </option>`;
}

// ---------- New Project ----------

export function showNewProjectModal(): void {
  const engines = installedEngines();
  if (!engines.length) {
    // no engine to create with — send the user to the Engines view instead
    showConfirmModal(
      "No Engines Installed",
      "You need at least one installed Godot version to create a project. Download one from the Engines view first.",
      "OK",
      () => {},
      "btn-primary",
    );
    return;
  }

  const overlay = openModal(
    "New Project",
    `
    <div class="form-field">
      <label>Project name</label>
      <input type="text" id="np-name" placeholder="My Awesome Game" autofocus />
    </div>
    <div class="form-field">
      <label>Create in</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="np-folder" value="${esc(state.settings.projectsDir)}" style="flex:1;" />
        <button class="btn btn-sm" id="np-browse">Browse…</button>
      </div>
      <div class="field-hint">A subfolder with the project name will be created here.</div>
    </div>
    <div class="form-row">
      <div class="form-field">
        <label>Engine version</label>
        <select id="np-engine">${engines.map((e) => engineOption(e)).join("")}</select>
      </div>
      <div class="form-field">
        <label>Renderer</label>
        <select id="np-renderer">
          <option value="forward-plus">Forward+</option>
          <option value="mobile">Mobile</option>
          <option value="compatibility">Compatibility</option>
        </select>
      </div>
    </div>`,
    `
    <button class="btn" data-close-btn>Cancel</button>
    <button class="btn btn-primary" id="np-create">Create &amp; Edit</button>`,
  );

  q(overlay, "#np-browse").addEventListener("click", async () => {
    const folderInput = q<HTMLInputElement>(overlay, "#np-folder");
    const picked = await pickFolder("Choose project location", folderInput.value);
    if (picked) folderInput.value = picked;
  });
  q(overlay, "#np-create").addEventListener("click", async () => {
    const name = q<HTMLInputElement>(overlay, "#np-name").value.trim();
    const folder = q<HTMLInputElement>(overlay, "#np-folder").value.trim();
    const [version, variant] = q<HTMLSelectElement>(overlay, "#np-engine").value.split("|");
    const renderer = q<HTMLSelectElement>(overlay, "#np-renderer").value as Renderer;
    if (!name) {
      q<HTMLInputElement>(overlay, "#np-name").focus();
      return;
    }
    const btn = q<HTMLButtonElement>(overlay, "#np-create");
    btn.disabled = true;
    const ok = await createProject(name, folder, version, variant as Variant, renderer);
    btn.disabled = false;
    if (ok) closeModal();
  });
  q<HTMLInputElement>(overlay, "#np-name").focus();
}

// ---------- Add External Engine ----------

/** Pick a Godot executable; auto-detect its version, falling back to manual entry. */
export async function addEngineFlow(): Promise<void> {
  const result = await openDialog({
    title: "Choose a Godot executable",
    directory: false,
  });
  if (typeof result !== "string") return;
  const outcome = await addExternalEngine(result);
  if (outcome === "needManual") {
    showManualEngineModal(result);
  }
}

function showManualEngineModal(path: string): void {
  const overlay = openModal(
    "Add Engine",
    `
    <p style="margin: 0 0 14px; color: var(--text-dim); font-size: 13.5px;">
      The version could not be detected automatically. Enter it for:<br/>
      <code style="font-size:12px;">${esc(path)}</code>
    </p>
    <div class="form-row">
      <div class="form-field">
        <label>Version</label>
        <input type="text" id="me-version" placeholder="e.g. 4.3 or 4.4-dev3" />
      </div>
      <div class="form-field">
        <label>Variant</label>
        <select id="me-variant">
          <option value="standard">Standard</option>
          <option value="dotnet">.NET</option>
        </select>
      </div>
    </div>`,
    `
    <button class="btn" data-close-btn>Cancel</button>
    <button class="btn btn-primary" id="me-add">Add Engine</button>`,
  );

  q(overlay, "#me-add").addEventListener("click", async () => {
    const version = q<HTMLInputElement>(overlay, "#me-version").value.trim();
    const variant = q<HTMLSelectElement>(overlay, "#me-variant").value as Variant;
    if (!version) {
      q<HTMLInputElement>(overlay, "#me-version").focus();
      return;
    }
    const outcome = await addExternalEngine(path, version, variant);
    if (outcome === "ok") closeModal();
  });
  q<HTMLInputElement>(overlay, "#me-version").focus();
}

// ---------- First-run setup ----------

/** Shown when engine/projects directories are unset (first launch or wiped settings). */
export function showFirstRunModal(): void {
  const overlay = openModal(
    "Welcome to Godot Launchpad",
    `
    <p style="margin: 0 0 16px; color: var(--text-dim); font-size: 13.5px;">
      Choose where downloaded engines should be installed and where new projects
      should be created. You can change both later in Settings.
    </p>
    <div class="form-field">
      <label>Engine install directory</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="fr-engines" placeholder="Not set" readonly style="flex:1;" />
        <button class="btn btn-sm" id="fr-browse-engines">Browse…</button>
      </div>
    </div>
    <div class="form-field">
      <label>Projects directory</label>
      <div style="display:flex; gap:8px;">
        <input type="text" id="fr-projects" placeholder="Not set" readonly style="flex:1;" />
        <button class="btn btn-sm" id="fr-browse-projects">Browse…</button>
      </div>
    </div>`,
    `
    <button class="btn" data-close-btn title="You will be asked again next launch">Later</button>
    <button class="btn btn-primary" id="fr-save" disabled>Save</button>`,
  );

  const enginesInput = q<HTMLInputElement>(overlay, "#fr-engines");
  const projectsInput = q<HTMLInputElement>(overlay, "#fr-projects");
  const saveBtn = q<HTMLButtonElement>(overlay, "#fr-save");
  enginesInput.value = state.settings.enginesDir;
  projectsInput.value = state.settings.projectsDir;

  const refreshSave = () => {
    saveBtn.disabled = !enginesInput.value || !projectsInput.value;
  };
  refreshSave();

  q(overlay, "#fr-browse-engines").addEventListener("click", async () => {
    const picked = await pickFolder("Choose engine install directory");
    if (picked) enginesInput.value = picked;
    refreshSave();
  });
  q(overlay, "#fr-browse-projects").addEventListener("click", async () => {
    const picked = await pickFolder("Choose projects directory");
    if (picked) projectsInput.value = picked;
    refreshSave();
  });

  saveBtn.addEventListener("click", async () => {
    const updated: Settings = {
      ...state.settings,
      enginesDir: enginesInput.value,
      projectsDir: projectsInput.value,
    };
    await saveSettings(updated);
    await refreshLocal();
    closeModal();
  });
}

// ---------- Change Engine Version ----------

export function showChangeEngineModal(project: Project): void {
  const current = `${project.engineVersion}|${project.variant}`;
  const installed = installedEngines();
  const notInstalled = state.engines.filter((e) => e.status !== "installed" && e.downloadUrl);

  const overlay = openModal(
    "Change Engine Version",
    `
    <p style="margin: 0 0 14px; color: var(--text-dim); font-size: 13.5px;">
      "${esc(project.name)}" currently opens with
      <strong>Godot ${esc(project.engineVersion)} — ${variantLabel(project.variant)}</strong>.
    </p>
    <div class="form-field">
      <label>New engine version</label>
      <select id="ce-engine">
        <optgroup label="Installed">${installed.map((e) => engineOption(e, current)).join("")}</optgroup>
        ${
          notInstalled.length
            ? `<optgroup label="Not installed — will be downloaded">${notInstalled.map((e) => engineOption(e, current)).join("")}</optgroup>`
            : ""
        }
      </select>
      <div class="field-hint">Switching major versions (e.g. 3.x → 4.x) may require Godot to convert the project.</div>
    </div>`,
    `
    <button class="btn" data-close-btn>Cancel</button>
    <button class="btn btn-primary" id="ce-change">Change</button>`,
  );

  q(overlay, "#ce-change").addEventListener("click", () => {
    const value = q<HTMLSelectElement>(overlay, "#ce-engine").value;
    if (value === current) {
      closeModal();
      return;
    }
    const [version, variant] = value.split("|") as [string, Variant];
    const target = state.engines.find((e) => e.id === `${version}-${variant}`);
    const needsDownload = target?.status !== "installed";
    closeModal();
    showConfirmModal(
      "Change Engine Version",
      `Open "${project.name}" with Godot ${version} (${variantLabel(variant)}) from now on?` +
        (needsDownload ? " This version is not installed yet and will be downloaded." : ""),
      needsDownload ? "Change & Download" : "Change",
      () => void changeProjectEngine(project, version, variant),
      "btn-primary",
    );
  });
}

// ---------- Confirm ----------

export function showConfirmModal(
  title: string,
  message: string, // plain text — escaped here
  confirmLabel: string,
  onConfirm: () => void,
  confirmClass: "btn-danger" | "btn-primary" = "btn-danger",
): void {
  const overlay = openModal(
    title,
    `<p style="margin:0; color: var(--text-dim);">${esc(message)}</p>`,
    `
    <button class="btn" data-close-btn>Cancel</button>
    <button class="btn ${confirmClass}" id="cf-confirm">${esc(confirmLabel)}</button>`,
  );
  q(overlay, "#cf-confirm").addEventListener("click", () => {
    closeModal();
    onConfirm();
  });
}
