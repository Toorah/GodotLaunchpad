use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::models::{channel_of, engine_id, EngineInfo};
use crate::settings::load_settings;
use crate::storage::{load_json, save_json};

const USER_AGENT: &str = "GodotLaunchpad/0.1";
const EXTERNAL_MANIFEST: &str = "external_engines.json";

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .connect_timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_default()
}

/// Bytes → MB rounded to one decimal.
fn mb(bytes: u64) -> f64 {
    (bytes as f64 / (1024.0 * 1024.0) * 10.0).round() / 10.0
}

// ---------------- installed engines ----------------

/// Find the engine executable inside an install dir.
pub fn find_engine_binary(dir: &Path) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;
    // only assigned on non-Windows platforms
    #[cfg_attr(target_os = "windows", allow(unused_mut))]
    let mut fallback = None;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // macOS app bundle
            if path.extension().is_some_and(|e| e == "app") {
                let inner = path.join("Contents/MacOS/Godot");
                if inner.exists() {
                    return Some(inner);
                }
            }
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_lowercase();
        #[cfg(target_os = "windows")]
        {
            if name.ends_with(".exe") && !name.ends_with("_console.exe") {
                return Some(path);
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            if name.starts_with("godot") && !name.ends_with(".zip") {
                fallback = Some(path);
            }
        }
    }
    fallback
}

/// Scan `<enginesDir>` for `<version>-<variant>` install folders.
fn managed_installs(engines_dir: &str) -> Vec<(String, String, PathBuf)> {
    let mut found = Vec::new();
    if engines_dir.is_empty() {
        return found;
    }
    let Ok(entries) = fs::read_dir(engines_dir) else {
        return found;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let folder = entry.file_name().to_string_lossy().into_owned();
        if let Some((version, variant)) = folder
            .rsplit_once('-')
            .filter(|(_, var)| matches!(*var, "standard" | "dotnet"))
        {
            found.push((version.to_string(), variant.to_string(), path));
        }
    }
    found
}

fn file_size_mb(path: &str) -> f64 {
    fs::metadata(path).map(|m| mb(m.len())).unwrap_or(0.0)
}

fn dir_size_mb(dir: &Path) -> f64 {
    fn walk(dir: &Path) -> u64 {
        fs::read_dir(dir)
            .map(|entries| {
                entries
                    .flatten()
                    .map(|e| {
                        let p = e.path();
                        if p.is_dir() {
                            walk(&p)
                        } else {
                            e.metadata().map(|m| m.len()).unwrap_or(0)
                        }
                    })
                    .sum()
            })
            .unwrap_or(0)
    }
    mb(walk(dir))
}

#[tauri::command]
pub fn list_installed_engines(app: AppHandle) -> Result<Vec<EngineInfo>, String> {
    let settings = load_settings(&app)?;
    let mut engines = Vec::new();

    // managed installs: <enginesDir>/<version>-<variant>/
    for (version, variant, dir) in managed_installs(&settings.engines_dir) {
        if find_engine_binary(&dir).is_none() {
            continue; // incomplete install
        }
        engines.push(EngineInfo::installed(
            engine_id(&version, &variant),
            version,
            variant,
            "managed",
            dir_size_mb(&dir),
            dir.to_string_lossy().into_owned(),
        ));
    }

    // manually-added engines, wherever they live
    for ext in load_external_engines(&app)? {
        if !PathBuf::from(&ext.path).exists() {
            continue; // binary vanished — hide until it's back
        }
        engines.push(EngineInfo::installed(
            ext.id,
            ext.version,
            ext.variant,
            "external",
            // just the executable — the launcher doesn't own its folder
            file_size_mb(&ext.path),
            ext.path,
        ));
    }
    Ok(engines)
}

// ---------------- external (manually added) engines ----------------

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExternalEngine {
    pub id: String,
    pub path: String, // path to the executable itself
    pub version: String,
    pub variant: String,
}

pub fn load_external_engines(app: &AppHandle) -> Result<Vec<ExternalEngine>, String> {
    load_json(app, EXTERNAL_MANIFEST, Vec::new)
}

fn save_external_engines(app: &AppHandle, engines: &[ExternalEngine]) -> Result<(), String> {
    save_json(app, EXTERNAL_MANIFEST, engines)
}

/// Parse `godot --version` output, e.g. "4.3.stable.official.77dcf97d8",
/// "4.4.dev3.mono.official.f7c567e2f" → (version, variant).
fn parse_version_output(output: &str) -> Option<(String, String)> {
    let line = output.lines().find(|l| {
        l.chars().next().is_some_and(|c| c.is_ascii_digit())
    })?;
    let tokens: Vec<&str> = line.trim().split('.').collect();
    let nums: Vec<&str> = tokens
        .iter()
        .take_while(|t| t.chars().all(|c| c.is_ascii_digit()) && !t.is_empty())
        .copied()
        .collect();
    if nums.is_empty() {
        return None;
    }
    let mut version = nums.join(".");
    // channel token follows the numbers: stable / rc1 / beta2 / dev3 …
    if let Some(channel) = tokens.get(nums.len()) {
        if *channel != "stable" {
            version = format!("{version}-{channel}");
        }
    }
    let variant = if tokens.contains(&"mono") { "dotnet" } else { "standard" };
    Some((version, variant.into()))
}

#[tauri::command]
pub async fn add_external_engine(
    app: AppHandle,
    path: String,
    version: Option<String>,
    variant: Option<String>,
) -> Result<EngineInfo, String> {
    let binary = PathBuf::from(&path);
    if !binary.is_file() {
        return Err("selected path is not a file".into());
    }

    let (version, variant) = match (version, variant) {
        (Some(v), Some(var)) => (v, var),
        _ => {
            // auto-detect by asking the binary itself; this boots enough of
            // the engine to take a second or two, so keep it off the UI thread
            let bin = binary.clone();
            let output = tauri::async_runtime::spawn_blocking(move || {
                Command::new(&bin).arg("--version").output()
            })
            .await
            .map_err(|e| format!("DETECT_FAILED: probe task failed: {e}"))?
            .map_err(|e| format!("DETECT_FAILED: could not run the executable: {e}"))?;
            let text = String::from_utf8_lossy(&output.stdout);
            parse_version_output(&text)
                .ok_or("DETECT_FAILED: could not detect the Godot version")?
        }
    };

    let mut engines = load_external_engines(&app)?;
    if engines.iter().any(|e| e.path == path) {
        return Err("this engine is already in the list".into());
    }

    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    let id = format!("ext-{:x}", hasher.finish());

    engines.push(ExternalEngine {
        id: id.clone(),
        path: path.clone(),
        version: version.clone(),
        variant: variant.clone(),
    });
    save_external_engines(&app, &engines)?;

    Ok(EngineInfo::installed(
        id,
        version,
        variant,
        "external",
        file_size_mb(&path),
        path,
    ))
}

#[tauri::command]
pub fn remove_external_engine(app: AppHandle, id: String) -> Result<(), String> {
    let mut engines = load_external_engines(&app)?;
    engines.retain(|e| e.id != id);
    save_external_engines(&app, &engines)
}

/// How well an engine version satisfies a project's required version.
/// Projects store major.minor (e.g. "4.4"); engines may carry a patch ("4.4.1").
/// 0 = exact, 1 = patch release of the same minor, 2 = prerelease of it.
pub fn version_match_score(engine_version: &str, project_version: &str) -> Option<u8> {
    if engine_version == project_version {
        Some(0)
    } else if engine_version.starts_with(&format!("{project_version}.")) {
        Some(1)
    } else if engine_version.starts_with(&format!("{project_version}-")) {
        Some(2)
    } else {
        None
    }
}

/// A .NET engine can open a standard project; the reverse is not true.
/// 0 = exact variant, 1 = dotnet standing in for standard.
pub fn variant_match_score(engine_variant: &str, project_variant: &str) -> Option<u8> {
    if engine_variant == project_variant {
        Some(0)
    } else if engine_variant == "dotnet" && project_variant == "standard" {
        Some(1)
    } else {
        None
    }
}

/// Newest-first version ordering ("4.4.1" > "4.4"; stable > prerelease).
fn version_newer(a: &str, b: &str) -> bool {
    let parse = |v: &str| -> (Vec<u32>, String) {
        let (nums, pre) = v.split_once('-').map_or((v, ""), |(n, p)| (n, p));
        let mut parts: Vec<u32> = nums.split('.').map(|n| n.parse().unwrap_or(0)).collect();
        while parts.len() < 3 {
            parts.push(0);
        }
        (parts, pre.to_string())
    };
    let (pa, prea) = parse(a);
    let (pb, preb) = parse(b);
    if pa != pb {
        return pa > pb;
    }
    // same numbers: stable (no prerelease suffix) wins
    if prea.is_empty() != preb.is_empty() {
        return prea.is_empty();
    }
    prea > preb
}

/// Find the best installed binary for a project's version+variant requirement.
/// Considers managed installs and external engines; prefers exact version and
/// exact variant, then patch releases, then prereleases.
pub fn resolve_engine_binary(
    app: &AppHandle,
    engines_dir: &str,
    version: &str,
    variant: &str,
) -> Option<PathBuf> {
    // (score, version, binary) — lower score wins, then newer version
    let mut best: Option<(u8, String, PathBuf)> = None;
    let mut consider = |v: &str, var: &str, binary: PathBuf| {
        let (Some(vs), Some(vas)) = (version_match_score(v, version), variant_match_score(var, variant))
        else {
            return;
        };
        let score = vs * 2 + vas;
        let better = match &best {
            None => true,
            Some((bs, bv, _)) => score < *bs || (score == *bs && version_newer(v, bv)),
        };
        if better {
            best = Some((score, v.to_string(), binary));
        }
    };

    for (v, var, dir) in managed_installs(engines_dir) {
        if let Some(binary) = find_engine_binary(&dir) {
            consider(&v, &var, binary);
        }
    }
    for ext in load_external_engines(app).unwrap_or_default() {
        let binary = PathBuf::from(&ext.path);
        if binary.is_file() {
            consider(&ext.version, &ext.variant, binary);
        }
    }
    best.map(|(_, _, binary)| binary)
}

// ---------------- available engines (GitHub) ----------------

#[derive(Deserialize)]
struct GhAsset {
    name: String,
    size: u64,
    browser_download_url: String,
}

#[derive(Deserialize)]
struct GhRelease {
    tag_name: String,
    published_at: Option<String>,
    assets: Vec<GhAsset>,
}

/// Asset file names for the current platform, per variant.
fn asset_names(tag: &str) -> [(&'static str, String); 2] {
    #[cfg(target_os = "windows")]
    {
        [
            ("standard", format!("Godot_v{tag}_win64.exe.zip")),
            ("dotnet", format!("Godot_v{tag}_mono_win64.zip")),
        ]
    }
    #[cfg(target_os = "linux")]
    {
        [
            ("standard", format!("Godot_v{tag}_linux.x86_64.zip")),
            ("dotnet", format!("Godot_v{tag}_mono_linux_x86_64.zip")),
        ]
    }
    #[cfg(target_os = "macos")]
    {
        [
            ("standard", format!("Godot_v{tag}_macos.universal.zip")),
            ("dotnet", format!("Godot_v{tag}_mono_macos.universal.zip")),
        ]
    }
}

fn releases_to_engines(releases: Vec<GhRelease>) -> Vec<EngineInfo> {
    let mut engines = Vec::new();
    for release in releases {
        // tag: "4.3-stable", "4.4-dev3" — displayed version drops the -stable suffix
        let tag = release.tag_name.clone();
        let version = tag.trim_end_matches("-stable").to_string();
        let date = release
            .published_at
            .as_deref()
            .map(|d| d[..10.min(d.len())].to_string())
            .unwrap_or_default();
        for (variant, wanted) in asset_names(&tag) {
            if let Some(asset) = release.assets.iter().find(|a| a.name == wanted) {
                engines.push(EngineInfo {
                    id: engine_id(&version, variant),
                    version: version.clone(),
                    variant: variant.into(),
                    channel: channel_of(&version).into(),
                    status: "available".into(),
                    source: "managed".into(),
                    size_mb: mb(asset.size),
                    release_date: date.clone(),
                    path: None,
                    download_url: Some(asset.browser_download_url.clone()),
                });
            }
        }
    }
    engines
}

async fn fetch_releases(client: &reqwest::Client, url: &str) -> Result<Vec<GhRelease>, String> {
    let resp = client
        .get(url)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("network error: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("GitHub API returned {}", resp.status()));
    }
    resp.json().await.map_err(|e| format!("bad API response: {e}"))
}

#[tauri::command]
pub async fn fetch_available_engines(include_prereleases: bool) -> Result<Vec<EngineInfo>, String> {
    let client = http_client();
    // Stable releases from the main repo (sparse — 100 covers many years).
    let mut releases = fetch_releases(
        &client,
        "https://api.github.com/repos/godotengine/godot/releases?per_page=100",
    )
    .await?;
    if include_prereleases {
        // Dev/beta/rc snapshots live in godot-builds.
        if let Ok(pre) = fetch_releases(
            &client,
            "https://api.github.com/repos/godotengine/godot-builds/releases?per_page=60",
        )
        .await
        {
            let known: Vec<String> = releases.iter().map(|r| r.tag_name.clone()).collect();
            releases.extend(
                pre.into_iter()
                    .filter(|r| !r.tag_name.ends_with("-stable") && !known.contains(&r.tag_name)),
            );
        }
    }
    Ok(releases_to_engines(releases))
}

// ---------------- download / remove ----------------

/// version/variant become an on-disk folder name — reject anything that could
/// escape the engines dir (path separators, "..", empty parts).
fn validate_engine_ref(version: &str, variant: &str) -> Result<(), String> {
    let version_ok = !version.is_empty()
        && version
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
        && !version.contains("..");
    if !version_ok || !matches!(variant, "standard" | "dotnet") {
        return Err("invalid engine version or variant".into());
    }
    Ok(())
}

/// Engine archives only ever come from GitHub — refuse anything else.
fn validate_download_url(url: &str) -> Result<(), String> {
    let host = url
        .strip_prefix("https://")
        .and_then(|rest| rest.split('/').next())
        .unwrap_or("");
    if matches!(host, "github.com" | "objects.githubusercontent.com") {
        Ok(())
    } else {
        Err("refusing to download from outside GitHub".into())
    }
}

fn extract_zip(zip_path: &Path, dest: &Path) -> Result<(), String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("cannot open archive: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("bad zip: {e}"))?;
    archive
        .extract(dest)
        .map_err(|e| format!("extraction failed: {e}"))
}

/// If the zip contained a single top-level folder, move its contents up.
fn flatten_single_dir(dest: &Path) -> Result<(), String> {
    let entries: Vec<_> = fs::read_dir(dest)
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();
    if entries.len() == 1 && entries[0].path().is_dir() {
        let inner = entries[0].path();
        for child in fs::read_dir(&inner).map_err(|e| e.to_string())?.flatten() {
            let target = dest.join(child.file_name());
            fs::rename(child.path(), target).map_err(|e| format!("cannot move file: {e}"))?;
        }
        fs::remove_dir(&inner).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn download_engine(
    app: AppHandle,
    version: String,
    variant: String,
    url: String,
) -> Result<EngineInfo, String> {
    validate_engine_ref(&version, &variant)?;
    validate_download_url(&url)?;
    let settings = load_settings(&app)?;
    if settings.engines_dir.is_empty() {
        return Err("Engine install directory is not set — choose one in Settings first".into());
    }
    let id = engine_id(&version, &variant);
    let root = PathBuf::from(&settings.engines_dir);
    fs::create_dir_all(&root).map_err(|e| format!("cannot create engines dir: {e}"))?;

    let zip_path = root.join(format!("{id}.zip.part"));
    let target = root.join(&id);

    // ---- download with progress events ----
    let resp = http_client()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("download failed: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("download failed: HTTP {}", resp.status()));
    }
    let total = resp.content_length().unwrap_or(0);
    let mut file = fs::File::create(&zip_path).map_err(|e| format!("cannot create file: {e}"))?;
    let mut stream = resp.bytes_stream();
    let mut downloaded: u64 = 0;
    let mut last_pct: i64 = -1;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("download interrupted: {e}"))?;
        file.write_all(&chunk).map_err(|e| format!("write failed: {e}"))?;
        downloaded += chunk.len() as u64;
        if total > 0 {
            let pct = (downloaded * 100 / total) as i64;
            if pct != last_pct {
                last_pct = pct;
                let _ = app.emit(
                    "engine-download-progress",
                    serde_json::json!({ "id": id, "progress": pct }),
                );
            }
        }
    }
    drop(file);

    // ---- extract ----
    if target.exists() {
        fs::remove_dir_all(&target).map_err(|e| format!("cannot clear target dir: {e}"))?;
    }
    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
    let zip_clone = zip_path.clone();
    let target_clone = target.clone();
    tauri::async_runtime::spawn_blocking(move || {
        extract_zip(&zip_clone, &target_clone)?;
        flatten_single_dir(&target_clone)
    })
    .await
    .map_err(|e| format!("extraction task failed: {e}"))??;
    fs::remove_file(&zip_path).ok();

    if find_engine_binary(&target).is_none() {
        return Err("archive did not contain a Godot executable".into());
    }

    Ok(EngineInfo::installed(
        id,
        version,
        variant,
        "managed",
        dir_size_mb(&target),
        target.to_string_lossy().into_owned(),
    ))
}

#[tauri::command]
pub fn remove_engine(app: AppHandle, version: String, variant: String) -> Result<(), String> {
    validate_engine_ref(&version, &variant)?;
    let settings = load_settings(&app)?;
    if settings.engines_dir.is_empty() {
        return Ok(()); // nothing managed can exist without an engines dir
    }
    let dir = PathBuf::from(&settings.engines_dir).join(engine_id(&version, &variant));
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| format!("cannot remove engine: {e}"))?;
    }
    Ok(())
}
