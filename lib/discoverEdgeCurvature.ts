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
 * Discover seed. A **named save** is the one exception: it is an explicit act,
 * and a diagram reopened without the bows its author dialled in would be
 * reopened wrong. Hence `getAllEdgeCurvatures` / `setEdgeCurvatures`, used by
 * `lib/discoverDiagramSaves.ts` — the store itself still persists nothing.
 *
 * Listeners are kept **per edge id** rather than in one global set: a drag
 * fires on every pointer move, and only the edge being dragged should re-render.
 *
 * Distances are absolute pixels, not a fraction of the edge's length, so moving
 * a node further away keeps the bow the user dialled in instead of inflating it.
 */

const offsets = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

/** Fired on *any* change, unlike `listeners` which is keyed per edge id.
 * `DiscoverGraph` uses it to notice that the diagram drifted from its saved
 * state: a curvature drag goes through neither `nodes` nor `edgeMeta`, so it
 * is invisible to every other change signal. */
const changeListeners = new Set<() => void>();

function emit(edgeId: string): void {
  for (const listener of listeners.get(edgeId) ?? []) listener();
  for (const listener of changeListeners) listener();
}

export function subscribeEdgeCurvatureChange(listener: () => void): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
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
 * Every override, for a save. The keys mix the two edge-id formats on purpose
 * — `consumerId::interfaceId` in the full view, `source->target` in the
 * simplified one — because the same relation carries an independent bow in
 * each. Copying the table wholesale keeps both without having to tell them
 * apart.
 */
export function getAllEdgeCurvatures(): Record<string, number> {
  return Object.fromEntries(offsets);
}

/**
 * Replaces the whole table, for a diagram load.
 *
 * Emits on the **union** of the old and new keys: an edge that had a bow
 * before the load and none after is only repainted if something notifies its
 * listener, and nothing else would. An edge whose component isn't mounted yet
 * needs no emission — it reads the value through `getSnapshot` on first
 * render, which is why restoring curvature *before* committing nodes and
 * edges is the safe order.
 */
export function setEdgeCurvatures(next: Record<string, number>): void {
  const touched = new Set([...offsets.keys(), ...Object.keys(next)]);
  offsets.clear();
  for (const [edgeId, offset] of Object.entries(next)) {
    if (Number.isFinite(offset)) offsets.set(edgeId, offset);
  }
  for (const edgeId of touched) emit(edgeId);
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
