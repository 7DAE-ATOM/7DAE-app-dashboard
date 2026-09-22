"use client";

import { useSyncExternalStore } from "react";
import { createPersistedStore } from "@/lib/createPersistedStore";

/**
 * One legend of the Discover canvas: the switch that turns it on, and the
 * palette it publishes.
 *
 * Written for the data objects, made a factory when the Business Capabilities
 * axis needed the exact same thing — two copies of this would diverge at the
 * first fix, and what it holds is precisely the part that is easy to get
 * subtly wrong:
 *
 *  - the **persisted switch**, through `createPersistedStore`;
 *  - a **session-only** palette store — a palette is the reading of one canvas,
 *    not a preference, so nothing about it is persisted;
 *  - **snapshot identity**: `useSyncExternalStore` compares by reference, so a
 *    palette must be published only when it actually changed, and the empty
 *    one must always be the same object, server snapshot included;
 *  - **one hook to draw with**: `useColors()` returns `null` the moment the box
 *    is unticked, so "unticking puts everything out" is written once instead of
 *    on every side of the canvas.
 *
 * The palette travels **from** the panel side **to** the graph, the opposite
 * direction of `lib/discoverCanvasContents.ts`. A module store rather than a
 * prop for the same reason as there: `DiscoverGraph` is not memoized and is
 * rendered directly by `DiscoverClient`, so threading this through the parent
 * would re-render the whole graph every time the palette arrived. Here the
 * loader publishes, the nodes and the edges subscribe, and neither renders the
 * other.
 */
export type LegendStore = {
  /** Reactive read of the switch. */
  useEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  /** Publishes a palette. Call only on a real change — see snapshot identity
   * above. */
  publishColors: (colors: ReadonlyMap<string, string>) => void;
  /** Drops the palette, so it never outlives the page that computed it. */
  resetColors: () => void;
  /** The palette to draw with, or `null` when nothing should be drawn — box
   * unticked, hierarchy not loaded yet, or a crawl that failed. */
  useColors: () => ReadonlyMap<string, string> | null;
};

/** Also the server snapshot, so the reference has to stay stable. */
const EMPTY: ReadonlyMap<string, string> = new Map();

/**
 * `key` is a `localStorage` key: never change it for an existing legend, it
 * would silently reset the preference of everyone who had ticked it.
 *
 * Off by default, always: the screen must not change for anyone who didn't ask
 * for it.
 */
export function createLegendStore(key: string): LegendStore {
  const enabledStore = createPersistedStore<boolean>({
    key,
    storage: "local",
    defaultValue: false,
    // A scalar: no need to run it through JSON.
    parse: (raw) => (raw === "true" ? true : raw === "false" ? false : null),
    serialize: String,
  });

  let colors: ReadonlyMap<string, string> = EMPTY;
  const listeners = new Set<() => void>();

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

  return {
    useEnabled: enabledStore.useValue,
    setEnabled: (enabled: boolean) => enabledStore.set(enabled),
    publishColors: (next) => {
      colors = next;
      for (const listener of listeners) listener();
    },
    resetColors: () => {
      if (colors === EMPTY) return;
      colors = EMPTY;
      for (const listener of listeners) listener();
    },
    useColors: () => {
      // Two subscriptions, one per store: both are hooks called
      // unconditionally, in the same order on every render.
      const enabled = enabledStore.useValue();
      const published = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
      return enabled && published.size > 0 ? published : null;
    },
  };
}
