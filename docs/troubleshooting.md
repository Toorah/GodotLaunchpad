---
layout: page
title: Troubleshooting
permalink: /troubleshooting/
---

## A project shows a "⚠" badge and won't open

The version badge turns into a warning when no installed engine satisfies
the project's requirement (exact version, a patch release of it, or a .NET
engine standing in for a Standard project — see
[Managing projects](managing-projects)). Install a matching version from the
**Engines** view, or click the card's **Install** button if one is offered.

## "Downloaded file failed checksum verification"

Godot's official releases publish a checksum file alongside the download.
The launcher verifies the download against it before extracting; if the
bytes don't match, extraction is skipped and you get this error instead of a
possibly-corrupt install. This usually means the download was interrupted or
corrupted in transit — retrying the download resolves it. If it keeps
happening for the same version, please
[open an issue](https://github.com/Toorah/GodotLaunchpad/issues).

## "Could not reach GitHub" / the available-versions list won't load

The **Engines** view fetches the version list from the GitHub API, which is
rate-limited for unauthenticated requests. If you've refreshed a lot in a
short time, wait a few minutes and click **Retry**. A normal internet
connectivity issue looks the same — check your connection first.

## "Godot Launchpad is not installed" when opening a project

The project needs a version/variant the launcher can't find on disk. Confirm
it wasn't removed from outside the launcher (e.g. you deleted the folder
manually) — if so, re-download it or point the launcher at it again via
**+ Add Engine**.

## The first-run setup keeps reappearing

It shows whenever either the engine install directory or the projects
directory is unset. Set both in **Settings** (or via the prompt itself) and
it won't come back. Clicking **Later** just postpones it to the next launch.

## Still stuck?

Open an issue on
[GitHub](https://github.com/Toorah/GodotLaunchpad/issues) with what you were
doing and the exact error message — that's usually enough to reproduce it.
