"use client";

import { createPersistedStore } from "@/lib/createPersistedStore";

/**
 * How the Discover canvas draws its links.
 *
 * `complex` is the LeanIX model as-is: a consumer points at an interface
 * circle anchored on the application that provides it. `simple` hides the
 * circles and folds those links into one arrow per (consumer, provider)
 * pair — the same information, minus the vocabulary.
 *
 * Only the drawing changes: the underlying graph keeps its interfaces, since
 * that is what exploration walks through.
 */
export type DiscoverViewMode = "simple" | "complex";

/** The model view stays the default: switching it would silently change what
 * every existing user sees on their next visit. */
const DEFAULT_MODE: DiscoverViewMode = "complex";

const store = createPersistedStore<DiscoverViewMode>({
  key: "discover-view-mode",
  storage: "local",
  defaultValue: DEFAULT_MODE,
  parse: (raw) => (raw === "simple" || raw === "complex" ? raw : null),
  // A scalar: no need to run it through JSON.
  serialize: (mode) => mode,
});

export function setDiscoverViewMode(mode: DiscoverViewMode): void {
  store.set(mode);
}

export function useDiscoverViewMode(): DiscoverViewMode {
  return store.useValue();
}
