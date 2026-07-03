import { describe, expect, it } from "vitest";
import { compareVersionsDesc, engineId, fmtSize, variantLabel } from "./types";

describe("compareVersionsDesc", () => {
  it("orders newer numeric versions first", () => {
    expect(compareVersionsDesc("4.4", "4.3")).toBeLessThan(0);
    expect(compareVersionsDesc("4.3", "4.4")).toBeGreaterThan(0);
    expect(compareVersionsDesc("4.4.1", "4.4")).toBeLessThan(0);
  });

  it("ranks stable above a prerelease of the same version", () => {
    expect(compareVersionsDesc("4.4", "4.4-dev3")).toBeLessThan(0);
    expect(compareVersionsDesc("4.4-dev3", "4.4")).toBeGreaterThan(0);
  });

  it("treats identical versions as equal", () => {
    expect(compareVersionsDesc("4.4", "4.4")).toBe(0);
  });

  it("pads missing patch components with zero", () => {
    // "4.4" == "4.4.0" numerically
    expect(compareVersionsDesc("4.4", "4.4.0")).toBe(0);
  });
});

describe("engineId / variantLabel", () => {
  it("builds the version-variant id", () => {
    expect(engineId("4.3", "standard")).toBe("4.3-standard");
    expect(engineId("4.4-dev3", "dotnet")).toBe("4.4-dev3-dotnet");
  });

  it("labels variants for display", () => {
    expect(variantLabel("standard")).toBe("Standard");
    expect(variantLabel("dotnet")).toBe(".NET");
  });
});

describe("fmtSize", () => {
  it("shows MB under 1024", () => {
    expect(fmtSize(512)).toBe("512 MB");
  });

  it("switches to GB at 1024 and above", () => {
    expect(fmtSize(1024)).toBe("1.00 GB");
    expect(fmtSize(2560)).toBe("2.50 GB");
  });
});
