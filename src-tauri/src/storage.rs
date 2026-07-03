//! Shared JSON persistence in the app-data dir (settings.json, projects.json,
//! external_engines.json all follow the same pattern).

use std::fs;
use std::path::PathBuf;

use serde::{de::DeserializeOwned, Serialize};
use tauri::{AppHandle, Manager};

fn data_path(app: &AppHandle, file: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    Ok(dir.join(file))
}

/// Load a JSON file from the app-data dir; `default` when it doesn't exist yet.
pub fn load_json<T: DeserializeOwned>(
    app: &AppHandle,
    file: &str,
    default: impl FnOnce() -> T,
) -> Result<T, String> {
    let path = data_path(app, file)?;
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("{file} is corrupt: {e}")),
        Err(_) => Ok(default()),
    }
}

pub fn save_json<T: Serialize + ?Sized>(app: &AppHandle, file: &str, value: &T) -> Result<(), String> {
    let path = data_path(app, file)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| format!("cannot write {file}: {e}"))
}
