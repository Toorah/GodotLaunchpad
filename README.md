# Godot Launchpad

A standalone, lightweight desktop launcher for [Godot Engine](https://godotengine.org/).
Built with [Tauri 2](https://tauri.app/) (Rust + native webview), around 12 MB.

## Features

- Download any Godot version: Standard or .NET, stable or pre-release
- Add your own engines (custom builds, existing downloads) from anywhere on disk
- Projects in your projects folder show up automatically
- Each project opens with the right engine. Missing one? Install it with one click
- .NET projects are detected and tagged
- See disk usage per engine version and in total

## Download

Get the installer for your platform from the [Releases](../../releases) page.

- **Windows**: `.msi` or `-setup.exe`
- **macOS**: `.dmg` (Apple Silicon and Intel)
- **Linux**: `.AppImage`, `.deb`, or `.rpm`

## Development

You need [Node.js](https://nodejs.org/) 20+ and [Rust](https://rustup.rs/) (stable).
On Windows also the MSVC C++ Build Tools, on Linux the [Tauri system packages](https://tauri.app/start/prerequisites/).

```sh
npm install
npm run tauri dev     # run with hot reload
npx tsc --noEmit      # typecheck the frontend
```

Local builds, no release needed:

```sh
npm run build:exe     # bare executable, fastest
npm run build:app     # executable + installers
npm run build:debug   # debug build with devtools
```

Output lands in `src-tauri/target/release/` (and `bundle/` for installers).

### Code layout

- `src/` frontend: Vite + vanilla TypeScript, no framework
- `src-tauri/src/` backend: engines, projects, settings
- Views talk to the backend only through `src/state.ts`

## License

[MIT](LICENSE)

Godot Launchpad is an independent project, not affiliated with Godot Engine.
New projects include the default Godot robot icon, © Godot Engine contributors, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
