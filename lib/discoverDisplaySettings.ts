"use client";

import { createPersistedStore } from "@/lib/createPersistedStore";

export type DiscoverDisplaySettings = {
  showName: boolean;
  showExternalId: boolean;
  showManager: boolean;
  /** Whether the nodes carry their info icon — the one that opens the
   * identity card. Toggled from the toolbar (`DiscoverInfoIconsToggle`), and
   * deliberately absent from the gear panel so there is a single control. */
  showInfoIcons: boolean;
  /** Whether the data-object dots travel along the flows instead of sitting
   * still at their midpoint (`components/discover/GraphEdge.tsx`). Toggled
   * from the toolbar (`DiscoverFlowAnimationToggle`), next to the info icons
   * — same kind of preference, same place. */
  animateFlows: boolean;
  /** How much the graph edges bow, as a percentage (see
   * `components/discover/GraphEdge.tsx`). 0 = straight lines,
   * `EDGE_CURVATURE_NEUTRAL` = the historical rendering, 100 = twice that. */
  edgeCurvature: number;
  /** Width, in graph pixels, of every Application rectangle the user has
   * *not* resized by hand. A box dragged by its side handle is pinned
   * (`ApplicationNodeData.widthPinned`) and ignores this — same relation as a
   * per-edge curvature override to `edgeCurvature` above. */
  boxWidth: number;
};

/** The percentage at which the curvature factor is exactly 1. The default sits
 * here so the slider can go both ways — the whole point was to allow both
 * straighter *and* curvier edges. */
export const EDGE_CURVATURE_NEUTRAL = 50;

/** Bounds of the Box width slider. The floor mirrors `MIN_APP_NODE_WIDTH` and
 * the default mirrors `APP_NODE_WIDTH`, both in `lib/discover-graph-layout.ts`
 * — repeated as literals rather than imported, because that module pulls in
 * elkjs at the top level and this store is read by every node, edge and
 * toolbar button of the Discover view. */
export const BOX_WIDTH_MIN = 120;
export const BOX_WIDTH_MAX = 400;
export const BOX_WIDTH_STEP = 10;
export const BOX_WIDTH_DEFAULT = 200;

const DEFAULT_SETTINGS: DiscoverDisplaySettings = {
  showName: true,
  showExternalId: true,
  showManager: true,
  showInfoIcons: true,
  // Off by default: arriving on a diagram that moves on its own, without
  // having asked for it, would be a surprise.
  animateFlows: false,
  edgeCurvature: EDGE_CURVATURE_NEUTRAL,
  boxWidth: BOX_WIDTH_DEFAULT,
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function numberInRange(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fallback;
}

const store = createPersistedStore<DiscoverDisplaySettings>({
  key: "discover-display-settings",
  storage: "local",
  defaultValue: DEFAULT_SETTINGS,
  // Field by field rather than a blind spread: a corrupt numeric curvature
  // would otherwise reach the path builder and produce broken edges.
  parse: (raw) => {
    const parsed = JSON.parse(raw) as Partial<DiscoverDisplaySettings>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      showName: bool(parsed.showName, DEFAULT_SETTINGS.showName),
      showExternalId: bool(parsed.showExternalId, DEFAULT_SETTINGS.showExternalId),
      showManager: bool(parsed.showManager, DEFAULT_SETTINGS.showManager),
      showInfoIcons: bool(parsed.showInfoIcons, DEFAULT_SETTINGS.showInfoIcons),
      animateFlows: bool(parsed.animateFlows, DEFAULT_SETTINGS.animateFlows),
      edgeCurvature: numberInRange(
        parsed.edgeCurvature,
        0,
        100,
        DEFAULT_SETTINGS.edgeCurvature,
      ),
      boxWidth: numberInRange(
        parsed.boxWidth,
        BOX_WIDTH_MIN,
        BOX_WIDTH_MAX,
        DEFAULT_SETTINGS.boxWidth,
      ),
    };
  },
});

export function setDiscoverDisplaySetting<K extends keyof DiscoverDisplaySettings>(
  key: K,
  value: DiscoverDisplaySettings[K],
): void {
  store.set({ ...store.get(), [key]: value });
}

export function useDiscoverDisplaySettings(): DiscoverDisplaySettings {
  return store.useValue();
}
