"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-edge curvature overrides for the Discover graph: the signed distance, in
 * graph pixels, between an edge's control point and its chord. Set by dragging
 * the handle that appears when hovering an edge (see
 * `components/discover/GraphEdge.tsx`); an edge without an override follows the
 * global curvature setting instead (`lib/discoverDisplaySettings.ts`).
 *
 * Session-only by design — no `localStorage`, no serialisation into the shared
 * Discover seed. Making these adjustments durable would turn curvature into a
 * property of the *diagram* (to be carried by the seed and the exports) rather
 * than a reading comfort, which is a decision to take after use.
 *
 * Listeners are kept **per edge id** rather than in one global set: a drag
 * fires on every pointer move, and only the edge being dragged should re-render.
 *
 * Distances are absolute pixels, not a fraction of the edge's length, so moving
 * a node further away keeps the bow the user dialled in instead of inflating it.
 */

const offsets = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

function emit(edgeId: string): void {
  for (const listener of listeners.get(edgeId) ?? []) listener();
}

export function useEdgeCurvature(edgeId: string): number | null {
  const subscribe = useCallback(
    (callback: () => void) => {
      let set = listeners.get(edgeId);
      if (!set) {
        set = new Set();
        listeners.set(edgeId, set);
      }
      set.add(callback);
      return () => {
        set.delete(callback);
        if (set.size === 0) listeners.delete(edgeId);
      };
    },
    [edgeId],
  );
  const getSnapshot = useCallback(() => offsets.get(edgeId) ?? null, [edgeId]);
  // Same value on the server and before hydration: nothing is overridden yet.
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/** `null` drops the override, handing the edge back to the global setting. */
export function setEdgeCurvature(edgeId: string, offset: number | null): void {
  if (offset === null) offsets.delete(edgeId);
  else offsets.set(edgeId, offset);
  emit(edgeId);
}

export function getEdgeCurvature(edgeId: string): number | null {
  return offsets.get(edgeId) ?? null;
}

/**
 * Drops every override whose edge id fails `keep`. Called when an application
 * leaves the graph, so that removing it and adding it back does not resurrect
 * the adjustments its edges used to carry.
 */
export function pruneEdgeCurvature(keep: (edgeId: string) => boolean): void {
  for (const edgeId of [...offsets.keys()]) {
    if (!keep(edgeId)) {
      offsets.delete(edgeId);
      emit(edgeId);
    }
  }
}
