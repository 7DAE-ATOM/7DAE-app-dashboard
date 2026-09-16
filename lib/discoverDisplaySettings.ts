"use client";

import { useSyncExternalStore } from "react";

export type DiscoverDisplaySettings = {
  showName: boolean;
  showExternalId: boolean;
  showManager: boolean;
  /** How much the graph edges bow, as a percentage (see
   * `components/discover/GraphEdge.tsx`). 0 = straight lines,
   * `EDGE_CURVATURE_NEUTRAL` = the historical rendering, 100 = twice that. */
  edgeCurvature: number;
};

const STORAGE_KEY = "discover-display-settings";

/** The percentage at which the curvature factor is exactly 1. The default sits
 * here so the slider can go both ways — the whole point was to allow both
 * straighter *and* curvier edges. */
export const EDGE_CURVATURE_NEUTRAL = 50;

const DEFAULT_SETTINGS: DiscoverDisplaySettings = {
  showName: true,
  showExternalId: true,
  showManager: true,
  edgeCurvature: EDGE_CURVATURE_NEUTRAL,
};

let state: DiscoverDisplaySettings = DEFAULT_SETTINGS;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<DiscoverDisplaySettings>;
    // Field by field rather than a blind spread: a corrupt numeric curvature
    // would otherwise reach the path builder and produce broken edges.
    state = {
      showName: bool(parsed.showName, DEFAULT_SETTINGS.showName),
      showExternalId: bool(parsed.showExternalId, DEFAULT_SETTINGS.showExternalId),
      showManager: bool(parsed.showManager, DEFAULT_SETTINGS.showManager),
      edgeCurvature:
        typeof parsed.edgeCurvature === "number" &&
        Number.isFinite(parsed.edgeCurvature) &&
        parsed.edgeCurvature >= 0 &&
        parsed.edgeCurvature <= 100
          ? parsed.edgeCurvature
          : DEFAULT_SETTINGS.edgeCurvature,
    };
  } catch {
    // Corrupt/unavailable storage — keep defaults.
  }
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DiscoverDisplaySettings {
  hydrate();
  return state;
}

function getServerSnapshot(): DiscoverDisplaySettings {
  return DEFAULT_SETTINGS;
}

export function setDiscoverDisplaySetting<K extends keyof DiscoverDisplaySettings>(
  key: K,
  value: DiscoverDisplaySettings[K],
): void {
  state = { ...state, [key]: value };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota/private-mode — setting still applies for this session.
  }
  emit();
}

export function useDiscoverDisplaySettings(): DiscoverDisplaySettings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
