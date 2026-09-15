"use client";

import { useSyncExternalStore } from "react";
import type { FilterValue } from "@/components/FilterBar";

/**
 * In-memory (RAM-only, lost on reload) source of truth for the catalogue's
 * filters + page. It survives client-side navigation (catalogue → detail →
 * catalogue) so "Back to catalog" restores the previous context, while the
 * "Catalogue" menu calls `resetCatalogueFilters()` to clear everything.
 *
 * Same external-store pattern as `lib/useTheme.ts` (useSyncExternalStore).
 */

export const DEFAULT_FILTERS: FilterValue = {
  search: "",
  photo: "all",
  categories: [],
  statuses: [],
  portfolios: [],
  operator: "",
  businessCriticalities: [],
  businessCapabilityIds: [],
};

export type CatalogueState = {
  filters: FilterValue;
  page: number;
  /** Bumped by `resetCatalogueFilters`. The capability tree keeps its
   * expanded/collapsed state locally (it isn't a filter value), so remounting
   * it on this token is what collapses it back on a reset — no separate
   * synchronisation to maintain. */
  resetToken: number;
};

// Stable default reference for the server snapshot (static export render).
const DEFAULT_STATE: CatalogueState = { filters: DEFAULT_FILTERS, page: 1, resetToken: 0 };

let state: CatalogueState = DEFAULT_STATE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): CatalogueState {
  return state;
}

function getServerSnapshot(): CatalogueState {
  return DEFAULT_STATE;
}

/** Non-reactive read (e.g. to build the detail page's "Back" link). */
export function getCatalogueState(): CatalogueState {
  return state;
}

export function setCatalogueFilters(filters: FilterValue): void {
  state = { ...state, filters };
  emit();
}

export function setCataloguePage(page: number): void {
  if (page === state.page) return;
  state = { ...state, page };
  emit();
}

/** Clear filters and reset to page 1 (used by the "Catalogue" menu item). */
export function resetCatalogueFilters(): void {
  state = { filters: DEFAULT_FILTERS, page: 1, resetToken: state.resetToken + 1 };
  emit();
}

export function useCatalogueFilters(): CatalogueState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
