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
  /** How much the graph edges bow, as a percentage (see
   * `components/discover/GraphEdge.tsx`). 0 = straight lines,
   * `EDGE_CURVATURE_NEUTRAL` = the historical rendering, 100 = twice that. */
  edgeCurvature: number;
};

/** The percentage at which the curvature factor is exactly 1. The default sits
 * here so the slider can go both ways — the whole point was to allow both
 * straighter *and* curvier edges. */
export const EDGE_CURVATURE_NEUTRAL = 50;

const DEFAULT_SETTINGS: DiscoverDisplaySettings = {
  showName: true,
  showExternalId: true,
  showManager: true,
  showInfoIcons: true,
  edgeCurvature: EDGE_CURVATURE_NEUTRAL,
};

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
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
      edgeCurvature:
        typeof parsed.edgeCurvature === "number" &&
        Number.isFinite(parsed.edgeCurvature) &&
        parsed.edgeCurvature >= 0 &&
        parsed.edgeCurvature <= 100
          ? parsed.edgeCurvature
          : DEFAULT_SETTINGS.edgeCurvature,
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
