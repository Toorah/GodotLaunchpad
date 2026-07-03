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
