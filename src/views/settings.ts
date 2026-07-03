// Settings view: directories, download source, behaviour. Persisted via the backend.

import { Settings } from "../types";
import { saveSettings, state } from "../state";
import { pickFolder } from "../components/modals";

let dirty = false;

export function settingsHasUnsavedChanges(): boolean {
  return dirty;
}

export function resetSettingsDirty(): void {
  dirty = false;
}

export function renderSettings(root: HTMLElement): void {
  const s = state.settings;
  dirty = false;

  root.innerHTML = `
    <div class="view-header">
      <h1 class="view-title">Settings</h1>
    </div>

    <div class="settings-group">
      <div class="section-title" style="margin-top:0;">Locations</div>
      <div class="settings-row">
        <div class="settings-label">
          <div class="label-title">Engine install directory</div>
          <div class="label-desc">Downloaded engines are unpacked here.</div>
        </div>
        <div class="settings-control">
          <input type="text" id="set-engines-dir" value="${s.enginesDir}" />
          <button class="btn btn-sm" data-browse="engines">Browse…</button>
        </div>
      </div>
      <div class="settings-row">
        <div class="settings-label">
          <div class="label-title">Projects directory</div>
          <div class="label-desc">Default location for new projects.</div>
        </div>
        <div class="settings-control">
          <input type="text" id="set-projects-dir" value="${s.projectsDir}" />
          <button class="btn btn-sm" data-browse="projects">Browse…</button>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="section-title" style="margin-top:0;">Downloads</div>
      <div class="settings-row">
        <div class="settings-label">
          <div class="label-title">Download source</div>
          <div class="label-desc">Where engine builds are fetched from.</div>
        </div>
        <div class="settings-control">
          <select id="set-source">
            <option value="github" selected>GitHub Releases</option>
          </select>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="section-title" style="margin-top:0;">Behaviour</div>
      <div class="settings-row">
        <div class="settings-label">
          <div class="label-title">Close launcher on project open</div>
          <div class="label-desc">Exit the launcher after handing off to the editor.</div>
        </div>
        <div class="settings-control">
          <input type="checkbox" id="set-close-on-launch" ${s.closeOnLaunch ? "checked" : ""} />
        </div>
      </div>
    </div>

    <div style="display:flex; align-items:center; gap:12px;">
      <button class="btn btn-primary" id="set-save">Save Settings</button>
      <span id="unsaved-label" class="badge badge-channel" style="display:none;">Unsaved changes</span>
    </div>`;

  const currentValues = (): Settings => ({
    enginesDir: (root.querySelector("#set-engines-dir") as HTMLInputElement).value.trim(),
    projectsDir: (root.querySelector("#set-projects-dir") as HTMLInputElement).value.trim(),
    downloadSource: (root.querySelector("#set-source") as HTMLSelectElement).value,
    closeOnLaunch: (root.querySelector("#set-close-on-launch") as HTMLInputElement).checked,
  });

  const updateDirty = () => {
    const v = currentValues();
    const saved = state.settings;
    dirty =
      v.enginesDir !== saved.enginesDir ||
      v.projectsDir !== saved.projectsDir ||
      v.downloadSource !== saved.downloadSource ||
      v.closeOnLaunch !== saved.closeOnLaunch;
    (root.querySelector("#unsaved-label") as HTMLElement).style.display = dirty
      ? "inline-flex"
      : "none";
  };

  root
    .querySelectorAll<HTMLElement>("#set-engines-dir, #set-projects-dir, #set-source, #set-close-on-launch")
    .forEach((el) => {
      el.addEventListener("input", updateDirty);
      el.addEventListener("change", updateDirty);
    });

  root.querySelectorAll<HTMLButtonElement>("[data-browse]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const input = root.querySelector(
        btn.dataset.browse === "engines" ? "#set-engines-dir" : "#set-projects-dir",
      ) as HTMLInputElement;
      const picked = await pickFolder(
        btn.dataset.browse === "engines" ? "Choose engine install directory" : "Choose projects directory",
        input.value,
      );
      if (picked) input.value = picked;
      updateDirty();
    }),
  );

  root.querySelector("#set-save")!.addEventListener("click", async () => {
    await saveSettings(currentValues());
    updateDirty();
  });
}
