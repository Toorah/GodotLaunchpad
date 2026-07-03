use tauri::AppHandle;

use crate::models::Settings;
use crate::storage::{load_json, save_json};

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
    load_json(app, "settings.json", default_settings)
}

pub fn save_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    save_json(app, "settings.json", settings)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    load_settings(&app)
}

#[tauri::command]
pub fn set_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    save_settings(&app, &settings)
}
