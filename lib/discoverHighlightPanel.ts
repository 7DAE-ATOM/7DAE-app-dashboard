"use client";

import { createPersistedStore } from "@/lib/createPersistedStore";

/**
 * Whether the Discover highlight panel is unfolded.
 *
 * A display preference, so it goes through the factory and lives in
 * `localStorage` — see the rule in CLAUDE.md. Only the panel's *frame* is
 * remembered: what is ticked inside it is deliberately volatile, like the
 * click highlight it shares its rendering with.
 *
 * Closed by default: the panel overlays the canvas, and a first visit should
 * not arrive with a quarter of the graph hidden behind it.
 */
const DEFAULT_OPEN = false;

const store = createPersistedStore<boolean>({
  key: "discover-highlight-panel-open",
  storage: "local",
  defaultValue: DEFAULT_OPEN,
  // A scalar: no need to run it through JSON.
  parse: (raw) => (raw === "true" ? true : raw === "false" ? false : null),
  serialize: String,
});

export function setHighlightPanelOpen(open: boolean): void {
  store.set(open);
}

export function useHighlightPanelOpen(): boolean {
  return store.useValue();
}
