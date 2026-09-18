"use client";

import { useSyncExternalStore } from "react";

/**
 * What the Discover canvas currently holds, published by the graph and read by
 * the highlight panel (`components/discover/DiscoverHighlightPanel.tsx`).
 *
 * A module store rather than a prop on purpose. `DiscoverGraph` is not
 * memoized and is rendered directly by `DiscoverClient`, so routing this
 * through the parent's state would re-render the graph every time the canvas
 * changed — and a payload rebuilt per render would loop. Here the graph
 * publishes, the panel subscribes, and neither renders the other.
 *
 * Same shape as `lib/discoverEdgeCurvature.ts`: module state, a listener set,
 * `useSyncExternalStore`, and **session-only** — this is the content of one
 * canvas, not a preference, so nothing is persisted.
 *
 * The snapshot identity matters: `useSyncExternalStore` compares by reference,
 * so `publishCanvasContents` must only be called when the content actually
 * changed. The graph guards that with a signature of its own.
 */
export type CanvasInterface = {
  id: string;
  /** Technical ids of the data objects flowing through this interface. Ids
   * only: the panel matches against the hierarchy, it never displays these. */
  dataObjectIds: string[];
};

export type CanvasContents = {
  /** Technical ids of the application nodes currently drawn. Interfaces are
   * listed apart because only they carry data objects at the flow level. */
  applicationIds: string[];
  interfaces: CanvasInterface[];
};

/** Also the server snapshot, so the reference has to stay stable. */
const EMPTY: CanvasContents = { applicationIds: [], interfaces: [] };

let contents: CanvasContents = EMPTY;
const listeners = new Set<() => void>();

export function publishCanvasContents(next: CanvasContents): void {
  contents = next;
  for (const listener of listeners) listener();
}

/** Called when the graph unmounts: a stale canvas must not outlive it, and
 * StrictMode's double mount would otherwise leave the first pass's content
 * behind. */
export function resetCanvasContents(): void {
  if (contents === EMPTY) return;
  publishCanvasContents(EMPTY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CanvasContents {
  return contents;
}

function getServerSnapshot(): CanvasContents {
  return EMPTY;
}

export function useCanvasContents(): CanvasContents {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
