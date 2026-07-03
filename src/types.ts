// Shared data model — mirrors the Rust structs in src-tauri/src/models.rs
// (serde renames all fields to camelCase).

export type Variant = "standard" | "dotnet";
export type EngineStatus = "available" | "downloading" | "installed";
export type Channel = "stable" | "rc" | "dev";
export type Renderer = "forward-plus" | "mobile" | "compatibility";

export interface Engine {
  id: string; // "<version>-<variant>"
  version: string;
  variant: Variant;
  channel: Channel;
  status: EngineStatus;
  /** "managed" = lives in the engines dir; "external" = added manually, stays put */
  source: "managed" | "external";
  sizeMb: number;
  releaseDate: string;
  path?: string | null;
  downloadUrl?: string | null;
  /** client-side only: 0-100 while downloading */
  progress: number;
}

export interface Project {
  id: string; // canonical project directory path
  name: string;
  path: string;
  engineVersion: string;
  variant: Variant;
  renderer: Renderer;
  lastOpened: number | null; // epoch millis
  pinned: boolean;
}

export interface Settings {
  enginesDir: string;
  projectsDir: string;
  downloadSource: string;
  closeOnLaunch: boolean;
}

export function engineId(version: string, variant: Variant): string {
  return `${version}-${variant}`;
}

export function variantLabel(v: Variant): string {
  return v === "dotnet" ? ".NET" : "Standard";
}

/** Sort key: newest version first, stable before same-version prereleases. */
export function compareVersionsDesc(a: string, b: string): number {
  const parse = (v: string) => {
    const [nums, pre] = v.split(/-(.+)/);
    const parts = nums.split(".").map((n) => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return { parts, pre: pre ?? "" };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    if (pa.parts[i] !== pb.parts[i]) return pb.parts[i] - pa.parts[i];
  }
  // stable ("" prerelease) ranks above rc/dev/beta of the same version
  if (pa.pre === pb.pre) return 0;
  if (!pa.pre) return -1;
  if (!pb.pre) return 1;
  return pb.pre.localeCompare(pa.pre);
}

export function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Math.round(mb)} MB`;
}

export function fmtRelative(ms: number): string {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return new Date(ms).toLocaleDateString();
}
