mod engines;
mod models;
mod projects;
mod settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            settings::get_settings,
            settings::set_settings,
            engines::list_installed_engines,
            engines::fetch_available_engines,
            engines::download_engine,
            engines::remove_engine,
            engines::add_external_engine,
            engines::remove_external_engine,
            projects::list_projects,
            projects::create_project,
            projects::import_project,
            projects::scan_projects,
            projects::open_project,
            projects::change_project_engine,
            projects::remove_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
