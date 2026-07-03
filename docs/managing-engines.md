---
layout: page
title: Managing engines
permalink: /managing-engines/
---

The **Engines** view lists three groups: engines you've downloaded, engines
you've registered from elsewhere on disk ("External"), and versions available
to download from GitHub.

## Standard vs. .NET

Every Godot version comes in two variants:

- **Standard** — the regular editor, GDScript only.
- **.NET** — includes the Mono/C# runtime, for projects that use C#.

These are tracked separately throughout the app. A project that uses C#
needs the .NET variant of its engine version; a .NET engine can also open a
plain GDScript project (the reverse isn't true — a Standard engine can't open
a C# project).

## Downloading an engine

Pick a version under **Available to download** and click **Download**. The
zip is fetched from GitHub, verified against Godot's published checksum when
one is available, extracted into your engine install directory, and shows up
under **Downloaded** once it's ready. Progress shows live on the button.

Toggle **Pre-releases** to also show dev/beta/rc snapshots — these come from
a separate, faster-moving release channel and are generally less stable than
tagged stable releases.

## Removing an engine

- **Downloaded** engines: **Delete** removes the files from disk.
- **External** engines: **Remove** only forgets the entry — the executable on
  disk is never touched, since the launcher doesn't own it.

## Registering an external engine

Already have a Godot build you want to use — a custom compile, a portable
download, an old version you keep around — without re-downloading it through
the launcher? Click **+ Add Engine** and pick the executable.

The launcher tries to auto-detect the version and variant by briefly running
the executable with `--version`. If that fails (some custom builds don't
report a parseable version string), you'll be asked to enter the version and
variant yourself.

External engines stay wherever they are; the launcher only remembers the
path.
