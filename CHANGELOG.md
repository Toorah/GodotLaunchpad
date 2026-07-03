# Changelog

## v0.1.0 — 2026-07-03

First public release of **Godot Launchpad** 🚀 — a standalone, lightweight launcher for Godot Engine. Built with Tauri 2 (Rust + native webview), the whole app weighs in around 12 MB.

### Engine management
- Browse and download every Godot release straight from the official GitHub builds — **Standard and .NET** variants, stable releases and (optionally) dev/beta/RC snapshots
- Live download progress, automatic extraction into your chosen engines folder
- **Add external engines**: register custom-built or already-downloaded Godot executables from anywhere on disk — the launcher detects their version and variant by asking the binary itself, and never moves or deletes their files
- Engines grouped by **Downloaded / External / Available to download**, sub-grouped by version, with per-version and total disk usage
- Clear semantics: **Delete** removes downloaded engine files from disk; **Remove** only forgets an external entry

### Project library
- **Auto-discovery**: projects in your projects folder appear automatically, and are re-scanned on every launch
- Engine requirements read from `project.godot`; **.NET projects detected** via `.sln`/`.csproj` and tagged
- **Smart engine matching**: a `4.4` project happily opens with a `4.4.1` engine; .NET engines can open standard projects; a missing engine is one click away from being installed — right from the project card
- Change any project's engine version (with confirmation), open its folder in the file explorer, or import projects from outside the projects folder
- **New projects match Godot's own Project Manager output** — correct `config/features` tags, renderer setting, default robot icon, and `[dotnet]` section for C# projects

### App
- First-run setup for engine and projects directories
- Settings persisted on disk, with an unsaved-changes guard
- Dark, Godot-flavored UI; no framework, no Electron

### Known limitations
- Tested on **Windows**; Linux and macOS builds are produced by CI but not yet hand-verified
- Downloads come from GitHub Releases only, without checksum verification yet

### Install
- **Windows**: run the `.msi` or `-setup.exe` installer
- **macOS**: open the `.dmg` and drag Godot Launchpad to Applications (Apple Silicon and Intel builds)
- **Linux**: use the `.AppImage` (portable), `.deb`, or `.rpm`

---

*Godot Launchpad is an independent project, not affiliated with Godot Engine.*
