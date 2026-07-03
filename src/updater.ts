// Auto-updater: checks the GitHub release endpoint configured in
// src-tauri/tauri.conf.json (plugins.updater), and — with the user's
// confirmation — downloads, installs, and relaunches.

import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

import { showConfirmModal } from "./components/modals";
import { toast } from "./state";

let checking = false;

/** Look for a newer release; prompts before installing. Safe to call repeatedly. */
export async function checkForUpdates(showUpToDateToast = true): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    const update = await check();
    if (!update) {
      if (showUpToDateToast) toast("You're on the latest version", "success");
      return;
    }
    showConfirmModal(
      "Update Available",
      `Godot Launchpad ${update.version} is available (you have ${update.currentVersion}). ` +
        `Download and install now? The app will restart.`,
      "Update & Restart",
      () => void installUpdate(update),
      "btn-primary",
    );
  } catch (e) {
    toast(`Could not check for updates: ${e}`, "danger");
  } finally {
    checking = false;
  }
}

async function installUpdate(update: Awaited<ReturnType<typeof check>>): Promise<void> {
  if (!update) return;
  try {
    toast("Downloading update…");
    await update.downloadAndInstall();
    await relaunch();
  } catch (e) {
    toast(`Update failed: ${e}`, "danger");
  }
}
