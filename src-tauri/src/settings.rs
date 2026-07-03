use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::models::Settings;

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    Ok(dir.join("settings.json"))
}

fn default_settings() -> Settings {
    // Directories start empty on purpose — the frontend prompts the user
    // to choose them on first launch.
    Settings {
        engines_dir: String::new(),
        projects_dir: String::new(),
        download_source: "github".into(),
        close_on_launch: false,
    }
}

pub fn load_settings(app: &AppHandle) -> Result<Settings, String> {
    let path = settings_path(app)?;
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("settings.json is corrupt: {e}")),
        Err(_) => Ok(default_settings()),
    }
}

pub fn save_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    let path = settings_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("cannot create config dir: {e}"))?;
    }
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| format!("cannot write settings: {e}"))
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    load_settings(&app)
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    save_settings(&app, &settings)
}
