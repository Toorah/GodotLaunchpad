---
layout: page
title: Managing projects
permalink: /managing-projects/
---

The **Projects** view lists every project the launcher knows about, each
tagged with the engine version and variant it needs.

## Where projects come from

- Anything with a `project.godot` file inside your configured **projects
  directory** is picked up automatically.
- **Import** lets you add a project from anywhere else on disk.
- **+ New Project** creates a fresh project folder (with a `project.godot`
  and default icon already in place) and adds it to the list.

## Opening a project

Click **Open** to launch the project in its matching engine. The launcher
picks the best installed match for the project's required version:

1. An exact version + variant match, if installed.
2. A patch release of the same minor version (a project pinned to "4.4" opens
   fine with an installed "4.4.1").
3. A .NET engine standing in for a Standard requirement (not the reverse).

If nothing installed satisfies the requirement, the card shows an **Install**
button for the closest available download instead of **Open**.

## Changing a project's engine

Click the gear icon on a project card to switch it to a different installed
(or downloadable) version — useful when upgrading a project to a newer minor
version, or pinning it to an older one. Switching major versions (3.x → 4.x)
may require Godot itself to convert the project the next time you open it.

## Removing a project

**Remove** takes the project out of the launcher's list only — the project
folder and its files on disk are never touched. If the project is still
inside your projects directory, it'll be picked back up automatically the
next time the launcher scans (it's not deleted, just untracked).

## Imported 3.x projects

Godot 3.x projects don't declare their exact version the way 4.x projects
do, so an imported 3.x project shows up tagged "3.x" until you pick the exact
engine version it needs via the gear icon.
