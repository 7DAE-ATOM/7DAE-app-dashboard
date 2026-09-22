import { downloadBlob } from "@/lib/downloadBlob";

/**
 * Named Discover diagrams, kept in `localStorage`: an index of names under one
 * key, one entry per diagram under a prefixed key.
 *
 * **Not** built on `lib/createPersistedStore.ts`, despite CLAUDE.md making that
 * the default for anything persisted. The factory owns one key holding one
 * value, hydrated once and exposed through `useSyncExternalStore` — this is a
 * set of documents under dynamic keys, written and read on demand, with no
 * reactive snapshot at all. `lib/discoverSeed.ts` is the in-repo precedent for
 * that shape, and the tolerant storage accessors below are its.
 *
 * **What a save holds is what the user built, never the repository.** Ids and
 * layout only: no application name, no interface protocol, no data object
 * label. Everything else is resolved when the diagram is reopened — the
 * applications from the loaded catalogue, the interfaces from one batched
 * `fetchApplicationsInterfaces`. So a diagram reopened six months later shows
 * the estate as it is now, not a photograph of it, and the file stays small
 * enough that `localStorage` isn't the binding constraint.
 */

/** Absolute canvas coordinates; `width` only for a box the user pinned by
 * hand with its resize handle. Every other box follows the reader's own Box
 * width setting (`lib/discoverDisplaySettings.ts`), which is a preference,
 * not a property of the diagram. */
export type DiagramSaveApplication = {
  id: string;
  x: number;
  y: number;
  width?: number;
};

/** `x`/`y` are **relative to the provider rectangle** — interface circles are
 * xyflow children of their provider. `slot` is the ring position, needed so a
 * later expansion doesn't hand out a slot that is already taken. */
export type DiagramSaveInterface = {
  id: string;
  providerId: string;
  slot: number;
  x: number;
  y: number;
};

export type DiagramSaveEdge = {
  consumerId: string;
  interfaceId: string;
};

export type DiscoverDiagramSave = {
  version: 1;
  savedAt: string;
  /** The applications the user explicitly selected — the graph's anchors. */
  rootIds: string[];
  applications: DiagramSaveApplication[];
  interfaces: DiagramSaveInterface[];
  edges: DiagramSaveEdge[];
  /** Per-edge curvature overrides, keyed by edge id. Two id formats coexist
   * (one per view mode); see `lib/discoverEdgeCurvature.ts`. */
  curvature: Record<string, number>;
};

const INDEX_KEY = "discover-diagram-saves";
const entryKey = (name: string) => `discover-diagram-save:${name}`;

function safeGetItem(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    globalThis.localStorage.setItem(key, value);
    return true;
  } catch {
    // Storage blocked (private mode) or full — the caller reports it and
    // leaves the canvas untouched.
    return false;
  }
}

function safeRemoveItem(key: string): void {
  try {
    globalThis.localStorage.removeItem(key);
  } catch {
    // ignore — nothing to clean up if storage is unavailable
  }
}

function readIndex(): string[] {
  const raw = safeGetItem(INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(names: string[]): boolean {
  return safeSetItem(INDEX_KEY, JSON.stringify(names));
}

export function listDiagramSaves(): string[] {
  return readIndex();
}

/** `null` when the entry is missing (a name left in the index without its
 * entry is a case, not an anomaly) or unreadable. */
export function loadDiagramSave(name: string): DiscoverDiagramSave | null {
  const raw = safeGetItem(entryKey(name));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DiscoverDiagramSave;
    return parsed.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

/** Overwrites silently if `name` already exists — per spec, as on `/depgraph`. */
export function writeDiagramSave(name: string, data: DiscoverDiagramSave): boolean {
  if (!safeSetItem(entryKey(name), JSON.stringify(data))) return false;
  const names = readIndex();
  if (names.includes(name)) return true;
  return writeIndex([...names, name]);
}

export function deleteDiagramSave(name: string): void {
  safeRemoveItem(entryKey(name));
  writeIndex(readIndex().filter((n) => n !== name));
}

function sanitizeFilename(name: string): string {
  return name.replaceAll(/[\\/:*?"<>|]/g, "_").trim() || "diagram";
}

/** Hands the save to the browser as a `.json` file — the only way a diagram
 * leaves this browser, saves being local to it otherwise. */
export function downloadDiagramSave(name: string, data: DiscoverDiagramSave): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${sanitizeFilename(name)}.json`);
}

type UnknownRecord = Record<string, unknown>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isApplicationArray(value: unknown): value is DiagramSaveApplication[] {
  return (
    Array.isArray(value) &&
    value.every((a) => {
      if (!a || typeof a !== "object") return false;
      const rec = a as UnknownRecord;
      if (typeof rec.id !== "string" || !isFiniteNumber(rec.x) || !isFiniteNumber(rec.y)) {
        return false;
      }
      return rec.width === undefined || isFiniteNumber(rec.width);
    })
  );
}

function isInterfaceArray(value: unknown): value is DiagramSaveInterface[] {
  return (
    Array.isArray(value) &&
    value.every((i) => {
      if (!i || typeof i !== "object") return false;
      const rec = i as UnknownRecord;
      return (
        typeof rec.id === "string" &&
        typeof rec.providerId === "string" &&
        isFiniteNumber(rec.slot) &&
        isFiniteNumber(rec.x) &&
        isFiniteNumber(rec.y)
      );
    })
  );
}

function isEdgeArray(value: unknown): value is DiagramSaveEdge[] {
  return (
    Array.isArray(value) &&
    value.every((e) => {
      if (!e || typeof e !== "object") return false;
      const rec = e as UnknownRecord;
      return typeof rec.consumerId === "string" && typeof rec.interfaceId === "string";
    })
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/** Absent or malformed curvature is dropped rather than rejected: it is a
 * reading comfort, not the diagram, and losing the bows beats refusing the
 * file. */
function toCurvature(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [edgeId, offset] of Object.entries(value as UnknownRecord)) {
    if (isFiniteNumber(offset)) out[edgeId] = offset;
  }
  return out;
}

/**
 * Validates untrusted JSON from an imported file.
 *
 * Unlike `loadDiagramSave`, which trusts this app's own past writes and only
 * branches on `.version`, this checks the structure for real: an unrelated
 * JSON file, or a diagram exported by `/depgraph` in the sibling app, must be
 * refused with a message that says which, instead of silently becoming a
 * broken save.
 */
export function parseImportedDiagramSave(raw: string): DiscoverDiagramSave {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("This file does not contain a Discover diagram.");
  }
  const rec = parsed as UnknownRecord;

  if (typeof rec.savedAt !== "string") {
    throw new TypeError("This file does not contain a Discover diagram.");
  }
  if (rec.version !== 1) {
    // Where a `/depgraph` save lands: version 3, and none of the fields below.
    throw new Error("This file was exported by an unsupported version of this app.");
  }
  if (!isStringArray(rec.rootIds)) {
    throw new TypeError("This diagram's data is malformed (selected applications).");
  }
  if (!isApplicationArray(rec.applications)) {
    throw new TypeError("This diagram's data is malformed (applications).");
  }
  if (!isInterfaceArray(rec.interfaces)) {
    throw new TypeError("This diagram's data is malformed (interfaces).");
  }
  if (!isEdgeArray(rec.edges)) {
    throw new TypeError("This diagram's data is malformed (links).");
  }

  return {
    version: 1,
    savedAt: rec.savedAt,
    rootIds: rec.rootIds,
    applications: rec.applications,
    interfaces: rec.interfaces,
    edges: rec.edges,
    curvature: toCurvature(rec.curvature),
  };
}
