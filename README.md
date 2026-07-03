# Godot Launchpad

A standalone, lightweight, cross-platform desktop launcher for [Godot Engine](https://godotengine.org/).
Built with [Tauri 2](https://tauri.app/) (Rust + native OS webview) — **not Electron**, so it stays small and fast.

## Features

- **Manage engine versions** — browse every Godot release (Standard and .NET, stable and pre-release), download with live progress, and see disk usage per version
- **Bring your own engines** — register custom-built or already-downloaded Godot executables from anywhere on disk; the launcher auto-detects their version by asking the binary itself
- **Project library** — auto-discovers projects in your projects folder, detects the required engine version and .NET-ness from `project.godot` / `.sln` / `.csproj`, and re-scans on every launch
- **Smart engine matching** — a `4.4` project opens with your `4.4.1` engine; a .NET engine can open standard projects; missing engines are one click away from being installed
- **Create projects** — new projects match what Godot's own Project Manager writes (renderer feature tags, default icon, `[dotnet]` section for C# projects)
- **Launch and go** — opens each project in the right editor via `godot --path <project> -e`, with an optional close-on-launch setting

## Download

Grab the latest installer for your platform from the [Releases](../../releases) page.

## Development

Prerequisites:

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (stable) — on Windows this also needs the MSVC C++ Build Tools
- Linux additionally needs the [Tauri system dependencies](https://tauri.app/start/prerequisites/) (`libwebkit2gtk-4.1-dev` etc.)

```sh
npm install
npm run tauri dev     # run the app with hot reload
npm run tauri build   # produce a release bundle/installer
npx tsc --noEmit      # typecheck the frontend
```

### Project layout

- `src/` — frontend (Vite + vanilla TypeScript, no framework); views are plain render functions over a tiny pub/sub store (`src/state.ts`)
- `src-tauri/src/` — Rust backend: `engines.rs` (scan/fetch/download), `projects.rs` (manifest, `project.godot` parsing/creation, launching), `settings.rs`
- All backend access goes through `src/state.ts`; views never call `invoke()` directly

## Releasing

Pushing a tag like `v0.2.0` triggers the release workflow, which builds installers for Windows, macOS (Intel + Apple Silicon), and Linux and attaches them to a draft GitHub release.

```sh
git tag v0.2.0
git push origin v0.2.0
```

## License

[MIT](LICENSE)

Godot Launchpad is an independent project and is not affiliated with or endorsed by the Godot Engine project.
New projects are created with the default Godot robot icon, © Godot Engine contributors, licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
