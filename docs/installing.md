---
layout: page
title: Installing & first run
permalink: /installing/
---

## Download

Get the installer for your platform from the
[Releases](https://github.com/Toorah/GodotLaunchpad/releases) page:

| Platform | File |
|---|---|
| Windows | `.msi` or `-setup.exe` |
| macOS | `.dmg` (Apple Silicon and Intel builds) |
| Linux | `.AppImage`, `.deb`, or `.rpm` |

Godot Launchpad is a small native app (~12 MB) — no bundled browser runtime,
low memory footprint.

## First run

The first time you open the app, it asks for two folders:

- **Engine install directory** — where downloaded Godot versions are
  unpacked. Each version gets its own subfolder, so multiple versions live
  side by side without conflicting.
- **Projects directory** — where the launcher looks for your Godot projects.
  Anything with a `project.godot` file in this folder is picked up
  automatically the next time the app starts (or when you switch views).

You can change both later from **Settings**. If you skip this step, the
prompt reappears next launch until both are set — the app works without them
in the meantime, you just won't be able to download engines or auto-discover
projects yet.

## Building from source

If you'd rather build it yourself, see the
[Development section of the README](https://github.com/Toorah/GodotLaunchpad#development)
for the full toolchain setup (Node.js, Rust, and platform-specific
prerequisites).
