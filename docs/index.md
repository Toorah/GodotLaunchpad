---
layout: page
title: Godot Launchpad
permalink: /
---

Godot Launchpad is a lightweight, cross-platform desktop launcher for [Godot
Engine](https://godotengine.org). It keeps every Godot version you use side by
side and opens each project with the exact engine build it needs — no more
hunting for the right executable or juggling folders of unpacked zips
yourself.

It's a standalone native app (built with [Tauri](https://tauri.app), not
Electron) — small download, low memory use, no bundled browser runtime.

## What it does

- Downloads and manages Godot engine versions — Standard and .NET (C#)
  builds, stable and pre-release channels — side by side on disk.
- Lists your known projects and opens each one with its matching engine
  version automatically.
- Creates new projects (name, location, engine version, renderer) or imports
  existing ones it finds on disk.
- Lets you register a Godot executable you already have (a custom build, or
  one installed outside the launcher) without re-downloading it.

## Guides

- **[Installing & first run]({{ "/installing/" | relative_url }})** — get the
  app running and point it at your engine/projects folders.
- **[Managing engines]({{ "/managing-engines/" | relative_url }})** —
  download, remove, and register external Godot builds.
- **[Managing projects]({{ "/managing-projects/" | relative_url }})** —
  create, import, open, and reassign the engine a project uses.
- **[Troubleshooting]({{ "/troubleshooting/" | relative_url }})** — common
  issues and what they mean.

## Source

Godot Launchpad is open source. Browse the code, report an issue, or grab the
latest release on
[GitHub](https://github.com/Toorah/GodotLaunchpad).
