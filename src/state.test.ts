import { describe, expect, it } from "vitest";
import { bestEngineForProject, state, versionMatchScore, variantMatchScore } from "./state";
import { Engine, Project } from "./types";

// Mirrors src-tauri/src/engines.rs's version_match_score / variant_match_score tests —
// these two copies must never drift, since one drives the UI and the other the launch.
describe("versionMatchScore", () => {
  it("scores exact, patch, and prerelease matches; rejects the rest", () => {
    expect(versionMatchScore("4.4", "4.4")).toBe(0);
    expect(versionMatchScore("4.4.1", "4.4")).toBe(1);
    expect(versionMatchScore("4.4-dev3", "4.4")).toBe(2);
    expect(versionMatchScore("4.5", "4.4")).toBeNull();
  });

  it("does not treat a shared prefix as a match", () => {
    expect(versionMatchScore("4.40", "4.4")).toBeNull();
  });
});

describe("variantMatchScore", () => {
  it("lets a dotnet engine stand in for a standard project, not the reverse", () => {
    expect(variantMatchScore("standard", "standard")).toBe(0);
    expect(variantMatchScore("dotnet", "dotnet")).toBe(0);
    expect(variantMatchScore("dotnet", "standard")).toBe(1);
    expect(variantMatchScore("standard", "dotnet")).toBeNull();
  });
});

function engine(overrides: Partial<Engine>): Engine {
  return {
    id: "4.4-standard",
    version: "4.4",
    variant: "standard",
    channel: "stable",
    status: "installed",
    source: "managed",
    sizeMb: 100,
    releaseDate: "",
    path: "/engines/4.4-standard/godot.exe",
    downloadUrl: null,
    progress: 100,
    ...overrides,
  };
}

function project(overrides: Partial<Project>): Project {
  return {
    id: "/projects/game",
    name: "Game",
    path: "/projects/game",
    engineVersion: "4.4",
    variant: "standard",
    renderer: "forward-plus",
    lastOpened: null,
    pinned: false,
    ...overrides,
  };
}

describe("bestEngineForProject", () => {
  it("prefers an exact version+variant match over a patch or dotnet stand-in", () => {
    state.engines = [
      engine({ id: "4.4.1-standard", version: "4.4.1" }),
      engine({ id: "4.4-standard", version: "4.4" }),
      engine({ id: "4.4-dotnet", version: "4.4", variant: "dotnet" }),
    ];
    const best = bestEngineForProject(project({}), ["installed"]);
    expect(best?.id).toBe("4.4-standard");
  });

  it("falls back to the newest patch release when there's no exact version", () => {
    state.engines = [
      engine({ id: "4.4.1-standard", version: "4.4.1" }),
      engine({ id: "4.4.2-standard", version: "4.4.2" }),
    ];
    const best = bestEngineForProject(project({}), ["installed"]);
    expect(best?.id).toBe("4.4.2-standard");
  });

  it("ignores engines outside the requested status set", () => {
    state.engines = [engine({ id: "4.4-standard", version: "4.4", status: "available" })];
    expect(bestEngineForProject(project({}), ["installed"])).toBeUndefined();
  });

  it("returns nothing when no installed engine satisfies the project", () => {
    state.engines = [engine({ id: "3.5-standard", version: "3.5" })];
    expect(bestEngineForProject(project({}), ["installed"])).toBeUndefined();
  });
});
