# Changelog

## v0.2.0 (2026-07-03)

Security hardening, auto-updates, and project organization.

### Security
- Fixed an HTML/script injection issue in how project names and paths were rendered
- Downloaded engine archives are now verified against Godot's official SHA-512 checksums before install
- Locked down the app shell: strict content security policy, minimal IPC surface

### Projects
- Pin projects to keep favorites at the top of the list
- Sort by recently opened, name, or engine version
- Open gives instant feedback instead of a pause with nothing happening on screen

### App
- Check for updates right from Settings — installs itself and restarts
- Usage docs, now published at [toorah.github.io/GodotLaunchpad](https://toorah.github.io/GodotLaunchpad/)

### Known limitations
- Still only tested on Windows — Linux/macOS builds exist but are unverified
- Update checks are manual for now (no automatic background check yet)

### Install
- **Windows**: `.msi` or `-setup.exe`
- **macOS**: `.dmg` (Apple Silicon and Intel)
- **Linux**: `.AppImage`, `.deb`, or `.rpm`

## v0.1.0 (2026-07-03)

First public release of **Godot Launchpad** 🚀

A standalone, lightweight launcher for Godot Engine. Around 12 MB, no Electron.

### Engines
- Download any Godot version: Standard or .NET, stable or pre-release
- Add your own engines (custom builds, existing downloads) from anywhere on disk
- See disk usage per version and in total
- "Delete" removes downloaded files, "Remove" only forgets an external engine

### Projects
- Projects in your projects folder show up automatically
- .NET projects are detected and tagged
- Each project opens with the right engine. Missing one? Install it with one click
- New projects look exactly like ones made by Godot itself

### App
- First-run setup, persistent settings, dark Godot-style UI

### Known limitations
- Only tested on Windows so far
- No checksum verification of downloads yet

### Install
- **Windows**: `.msi` or `-setup.exe`
- **macOS**: `.dmg` (Apple Silicon and Intel)
- **Linux**: `.AppImage`, `.deb`, or `.rpm`

*Godot Launchpad is an independent project, not affiliated with Godot Engine.*
