"use client";

import { useSyncExternalStore } from "react";
import { createPersistedStore } from "@/lib/createPersistedStore";

/**
 * Discover's data-object legend: the switch that turns it on, and the palette
 * it publishes.
 *
 * Two pieces of state, one subject, so one file — and above all one hook for
 * whoever draws (`GraphEdge`): `useDataObjectColors()` returns `null` the
 * moment the box is unticked, so the rule "unticking puts every dot out"
 * exists in a single place instead of on both sides of the canvas.
 *
 * The palette travels **from** the panel side **to** the graph, which is the
 * opposite direction of `lib/discoverCanvasContents.ts`. A module store rather
 * than a prop for the same reason as there: `DiscoverGraph` is not memoized
 * and is rendered directly by `DiscoverClient`, so threading this through the
 * parent would re-render the whole graph every time the palette arrived. Here
 * the loader publishes, the edges subscribe, and neither renders the other.
 */

/** Unticked by default: the screen must not change for anyone who didn't ask
 * for it. */
const DEFAULT_ENABLED = false;

const enabledStore = createPersistedStore<boolean>({
  key: "discover-data-object-legend",
  storage: "local",
  defaultValue: DEFAULT_ENABLED,
  // A scalar: no need to run it through JSON.
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : null),
  serialize: String,
});

export function setDataObjectLegendEnabled(enabled: boolean): void {
  enabledStore.set(enabled);
}

export function useDataObjectLegendEnabled(): boolean {
  return enabledStore.useValue();
}

/** Also the server snapshot, so the reference has to stay stable. */
const EMPTY: ReadonlyMap<string, string> = new Map();

let colors: ReadonlyMap<string, string> = EMPTY;
const listeners = new Set<() => void>();

/**
 * Publishes the palette computed from the hierarchy and the active theme —
 * see `components/discover/DataObjectColorsSync.tsx`, its only caller.
 *
 * `useSyncExternalStore` compares snapshots by identity, so this must be
 * called only when the palette actually changed: a fresh Map per render would
 * loop forever.
 */
export function publishDataObjectColors(next: ReadonlyMap<string, string>): void {
  colors = next;
  for (const listener of listeners) listener();
}

/** Called when the loader unmounts, so a palette never outlives the page that
 * computed it — and StrictMode's double mount doesn't leave the first pass's
 * Map behind. */
export function resetDataObjectColors(): void {
  if (colors === EMPTY) return;
  publishDataObjectColors(EMPTY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReadonlyMap<string, string> {
  return colors;
}

function getServerSnapshot(): ReadonlyMap<string, string> {
  return EMPTY;
}

/**
 * The palette to draw with, or `null` when nothing should be drawn — box
 * unticked, hierarchy not loaded yet, or a crawl that failed.
 *
 * One hook rather than two so a consumer can't end up drawing a stale palette
 * over an unticked box.
 */
export function useDataObjectColors(): ReadonlyMap<string, string> | null {
  const enabled = enabledStore.useValue();
  const published = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return enabled && published.size > 0 ? published : null;
}
