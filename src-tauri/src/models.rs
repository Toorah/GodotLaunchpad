use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub engines_dir: String,
    pub projects_dir: String,
    pub download_source: String, // "github" (only source for now)
    pub close_on_launch: bool,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct EngineInfo {
    pub id: String,      // "<version>-<variant>", e.g. "4.3-standard"
    pub version: String, // "4.3", "4.4-dev3"
    pub variant: String, // "standard" | "dotnet"
    pub channel: String, // "stable" | "rc" | "dev"
    pub status: String,  // "installed" | "available"
    pub source: String,  // "managed" (lives in enginesDir) | "external" (added manually)
    pub size_mb: f64,
    pub release_date: String,
    pub path: Option<String>,
    pub download_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String, // canonical project directory path
    pub name: String,
    pub path: String,
    pub engine_version: String,
    pub variant: String,
    pub renderer: String,
    pub last_opened: Option<i64>, // epoch millis
    #[serde(default)] // existing projects.json entries predate this field
    pub pinned: bool,
}

impl EngineInfo {
    /// An engine that exists on disk (managed install dir or external executable).
    pub fn installed(
        id: String,
        version: String,
        variant: String,
        source: &str,
        size_mb: f64,
        path: String,
    ) -> Self {
        Self {
            channel: channel_of(&version).into(),
            status: "installed".into(),
            source: source.into(),
            size_mb,
            release_date: String::new(),
            path: Some(path),
            download_url: None,
            id,
            version,
            variant,
        }
    }
}

pub fn engine_id(version: &str, variant: &str) -> String {
    format!("{version}-{variant}")
}

pub fn channel_of(version: &str) -> &'static str {
    if version.contains("-rc") {
        "rc"
    } else if version.contains('-') {
        // -dev, -beta, -alpha snapshots
        "dev"
    } else {
        "stable"
    }
}
