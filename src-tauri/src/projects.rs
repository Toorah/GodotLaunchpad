use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

use crate::engines::resolve_engine_binary;
use crate::models::Project;
use crate::settings::load_settings;

fn manifest_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;
    Ok(dir.join("projects.json"))
}

fn load_manifest(app: &AppHandle) -> Result<Vec<Project>, String> {
    let path = manifest_path(app)?;
    match fs::read_to_string(&path) {
        Ok(text) => serde_json::from_str(&text).map_err(|e| format!("projects.json is corrupt: {e}")),
        Err(_) => Ok(Vec::new()),
    }
}

fn save_manifest(app: &AppHandle, projects: &[Project]) -> Result<(), String> {
    let path = manifest_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(projects).map_err(|e| e.to_string())?;
    fs::write(&path, text).map_err(|e| format!("cannot write projects.json: {e}"))
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

// ---------------- project.godot parsing ----------------

struct DetectedProject {
    name: Option<String>,
    version: Option<String>,
    dotnet: bool,
    renderer: String,
}

fn parse_project_godot(text: &str) -> DetectedProject {
    let mut detected = DetectedProject {
        name: None,
        version: None,
        dotnet: false,
        renderer: "forward-plus".into(),
    };
    for line in text.lines() {
        let line = line.trim();
        if let Some(value) = line.strip_prefix("config/name=") {
            detected.name = Some(value.trim_matches('"').to_string());
        } else if let Some(value) = line.strip_prefix("config/features=PackedStringArray(") {
            let features: Vec<String> = value
                .trim_end_matches(')')
                .split(',')
                .map(|f| f.trim().trim_matches('"').to_string())
                .collect();
            detected.version = features
                .iter()
                .find(|f| f.chars().next().is_some_and(|c| c.is_ascii_digit()))
                .cloned();
            detected.dotnet = features.iter().any(|f| f == "C#");
        } else if let Some(value) = line.strip_prefix("renderer/rendering_method=") {
            // inside the [rendering] section (the ".mobile" override key has a
            // different prefix and is intentionally not matched here)
            detected.renderer = match value.trim_matches('"') {
                "mobile" => "mobile".into(),
                "gl_compatibility" => "compatibility".into(),
                _ => "forward-plus".into(),
            };
        }
    }
    detected
}

// ---------------- commands ----------------

#[tauri::command]
pub fn list_projects(app: AppHandle) -> Result<Vec<Project>, String> {
    let mut projects = load_manifest(&app)?;
    // newest-opened first, never-opened last
    projects.sort_by_key(|p| std::cmp::Reverse(p.last_opened.unwrap_or(0)));
    Ok(projects)
}

#[tauri::command]
pub fn create_project(
    app: AppHandle,
    name: String,
    folder: String,
    version: String,
    variant: String,
    renderer: String,
) -> Result<Project, String> {
    let slug = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let dir = PathBuf::from(&folder).join(&slug);
    if dir.join("project.godot").exists() {
        return Err(format!("a Godot project already exists at {}", dir.display()));
    }
    fs::create_dir_all(&dir).map_err(|e| format!("cannot create project folder: {e}"))?;

    // feature tag is the major.minor of the chosen engine, e.g. "4.3"
    let feature = version
        .split(['-', '.'])
        .take(2)
        .collect::<Vec<_>>()
        .join(".");
    let is_godot4 = !version.starts_with('3');

    const HEADER: &str = "; Engine configuration file.\n\
        ; It's best edited using the editor UI and not directly,\n\
        ; since the parameters that go here are not all obvious.\n\
        ;\n\
        ; Format:\n\
        ;   [section] ; section goes between []\n\
        ;   param=value ; assign values to parameters\n\n";

    let mut content = String::from(HEADER);
    if is_godot4 {
        content.push_str("config_version=5\n\n[application]\n\n");
        content.push_str(&format!("config/name=\"{name}\"\n"));
        // features: version tag, then renderer tag, matching the native manager
        let renderer_tag = match renderer.as_str() {
            "mobile" => "Mobile",
            "compatibility" => "GL Compatibility",
            _ => "Forward Plus",
        };
        let mut features = vec![format!("\"{feature}\""), format!("\"{renderer_tag}\"")];
        if variant == "dotnet" {
            features.push("\"C#\"".into());
        }
        content.push_str(&format!(
            "config/features=PackedStringArray({})\n",
            features.join(", ")
        ));
        content.push_str("config/icon=\"res://icon.svg\"\n");
        if variant == "dotnet" {
            content.push_str(&format!(
                "\n[dotnet]\n\nproject/assembly_name=\"{name}\"\n"
            ));
        }
        match renderer.as_str() {
            "mobile" => content.push_str(
                "\n[rendering]\n\nrenderer/rendering_method=\"mobile\"\n",
            ),
            "compatibility" => content.push_str(
                "\n[rendering]\n\nrenderer/rendering_method=\"gl_compatibility\"\nrenderer/rendering_method.mobile=\"gl_compatibility\"\n",
            ),
            _ => {}
        }
    } else {
        content.push_str("config_version=4\n\n[application]\n\n");
        content.push_str(&format!("config/name=\"{name}\"\n"));
    }
    fs::write(dir.join("project.godot"), content)
        .map_err(|e| format!("cannot write project.godot: {e}"))?;

    if is_godot4 {
        // default robot icon, same as the native project manager
        fs::write(
            dir.join("icon.svg"),
            include_str!("../assets/default_project_icon.svg"),
        )
        .map_err(|e| format!("cannot write icon.svg: {e}"))?;
    }

    let project = Project {
        id: dir.to_string_lossy().into_owned(),
        name,
        path: dir.to_string_lossy().into_owned(),
        engine_version: version,
        variant,
        renderer,
        last_opened: None,
    };
    let mut projects = load_manifest(&app)?;
    projects.retain(|p| p.id != project.id);
    projects.push(project.clone());
    save_manifest(&app, &projects)?;
    Ok(project)
}

/// Build a Project from a directory containing project.godot.
fn project_from_dir(dir: &Path) -> Result<Project, String> {
    let file = dir.join("project.godot");
    let text = fs::read_to_string(&file)
        .map_err(|_| format!("no project.godot found in {}", dir.display()))?;
    let detected = parse_project_godot(&text);

    // a .sln/.csproj alongside marks a project that actually needs the .NET
    // build (a [dotnet] section alone does not — plain GDScript projects
    // created with a .NET editor have one too, and run fine on standard)
    let has_dotnet_files = fs::read_dir(dir)
        .map(|entries| {
            entries.flatten().any(|e| {
                e.path()
                    .extension()
                    .is_some_and(|x| x == "csproj" || x == "sln")
            })
        })
        .unwrap_or(false);

    let fallback_name = dir
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Imported Project".into());

    Ok(Project {
        id: dir.to_string_lossy().into_owned(),
        name: detected.name.unwrap_or(fallback_name),
        path: dir.to_string_lossy().into_owned(),
        // 3.x projects have no features array — flag as "3.x" so the UI
        // prompts the user to pick the exact engine.
        engine_version: detected.version.unwrap_or_else(|| "3.x".into()),
        variant: if detected.dotnet || has_dotnet_files {
            "dotnet".into()
        } else {
            "standard".into()
        },
        renderer: detected.renderer,
        last_opened: None,
    })
}

#[tauri::command]
pub fn import_project(app: AppHandle, path: String) -> Result<Project, String> {
    let project = project_from_dir(&PathBuf::from(&path))?;
    let mut projects = load_manifest(&app)?;
    if projects.iter().any(|p| p.id == project.id) {
        return Err("this project is already in the launcher".into());
    }
    projects.push(project.clone());
    save_manifest(&app, &projects)?;
    Ok(project)
}

/// Scan the projects directory for Godot projects not yet in the launcher and
/// import them; also re-detect facts about known projects (variant, name,
/// renderer change between launches — e.g. a .sln appears with the first C#
/// script). Returns how many projects were newly added.
#[tauri::command]
pub fn scan_projects(app: AppHandle) -> Result<usize, String> {
    let settings = load_settings(&app)?;
    let mut projects = load_manifest(&app)?;
    let mut added = 0;
    let mut changed = false;

    // refresh file-derived facts for known projects
    for p in projects.iter_mut() {
        let Ok(fresh) = project_from_dir(&PathBuf::from(&p.path)) else {
            continue; // folder missing/unreadable — leave the entry as-is
        };
        if fresh.name != p.name || fresh.variant != p.variant || fresh.renderer != p.renderer {
            p.name = fresh.name;
            p.variant = fresh.variant;
            p.renderer = fresh.renderer;
            changed = true;
        }
        // follow the project file's version only when the stored engine no
        // longer satisfies it (e.g. project upgraded to a newer minor) — a
        // manually chosen compatible engine (say 4.4.1 for "4.4") is kept
        if fresh.engine_version != "3.x"
            && crate::engines::version_match_score(&p.engine_version, &fresh.engine_version)
                .is_none()
        {
            p.engine_version = fresh.engine_version;
            changed = true;
        }
    }

    // discover new projects
    if !settings.projects_dir.is_empty() {
        if let Ok(entries) = fs::read_dir(&settings.projects_dir) {
            for entry in entries.flatten() {
                let dir = entry.path();
                if !dir.is_dir() || !dir.join("project.godot").exists() {
                    continue;
                }
                let id = dir.to_string_lossy().into_owned();
                if projects.iter().any(|p| p.id == id) {
                    continue;
                }
                if let Ok(project) = project_from_dir(&dir) {
                    projects.push(project);
                    added += 1;
                }
            }
        }
    }

    if added > 0 || changed {
        save_manifest(&app, &projects)?;
    }
    Ok(added)
}

#[tauri::command]
pub fn open_project(app: AppHandle, id: String) -> Result<(), String> {
    let settings = load_settings(&app)?;
    let mut projects = load_manifest(&app)?;
    let project = projects
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or("project not found")?;

    let binary = resolve_engine_binary(
        &app,
        &settings.engines_dir,
        &project.engine_version,
        &project.variant,
    )
    .ok_or(format!(
        "Godot {} ({}) is not installed",
        project.engine_version, project.variant
    ))?;

    if !Path::new(&project.path).join("project.godot").exists() {
        return Err(format!("project.godot not found in {}", project.path));
    }

    Command::new(&binary)
        .args(["--path", &project.path, "-e"])
        .current_dir(&project.path)
        .spawn()
        .map_err(|e| format!("failed to launch Godot: {e}"))?;

    project.last_opened = Some(now_millis());
    save_manifest(&app, &projects)?;

    if settings.close_on_launch {
        app.exit(0);
    }
    Ok(())
}

#[tauri::command]
pub fn change_project_engine(
    app: AppHandle,
    id: String,
    version: String,
    variant: String,
) -> Result<Project, String> {
    let mut projects = load_manifest(&app)?;
    let project = projects
        .iter_mut()
        .find(|p| p.id == id)
        .ok_or("project not found")?;
    project.engine_version = version;
    project.variant = variant;
    let updated = project.clone();
    save_manifest(&app, &projects)?;
    Ok(updated)
}

#[tauri::command]
pub fn remove_project(app: AppHandle, id: String) -> Result<(), String> {
    let mut projects = load_manifest(&app)?;
    projects.retain(|p| p.id != id);
    save_manifest(&app, &projects)
}
