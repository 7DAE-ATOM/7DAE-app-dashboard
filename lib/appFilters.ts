"use client";

import { useSyncExternalStore } from "react";
import type { FilterValue } from "@/components/FilterBar";
import type { PhotoFilter } from "@/lib/types";

/**
 * Single source of truth for the filters of **every** panel: the catalogue,
 * its mobile sheet, and the map — they all render the same `FilterBar`, so a
 * filter set on one applies to the others.
 *
 * The values are mirrored into `sessionStorage`, so they survive a reload of
 * the tab but not its closing. Deliberately shorter-lived than the panel's
 * folded/unfolded state (`lib/filterSectionState.ts`, `localStorage`): a
 * narrow filter forgotten since yesterday would look like an empty catalogue,
 * where a folded chapter is harmless.
 *
 * Same external-store pattern as `lib/photoCacheSettings.ts`
 * (`useSyncExternalStore` + storage).
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
  /** Catalogue-only, and never persisted: the map doesn't paginate. */
  page: number;
  /** Bumped by `clearFilters`. The capability tree keeps its
   * expanded/collapsed state locally (it isn't a filter value), so remounting
   * it on this token is what collapses it back on a reset — no separate
   * synchronisation to maintain. */
  resetToken: number;
};

// Stable default reference for the server snapshot (static export render).
const DEFAULT_STATE: CatalogueState = { filters: DEFAULT_FILTERS, page: 1, resetToken: 0 };

const STORAGE_KEY = "app-filters";

const PHOTO_VALUES: PhotoFilter[] = ["all", "with", "without"];

let state: CatalogueState = DEFAULT_STATE;
let hydrated = false;
const listeners = new Set<() => void>();

function stringArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string")
    ? (v as string[])
    : null;
}

/**
 * Shape validation only — the store knows nothing of the loaded data, so a
 * value that no longer exists upstream (a deleted portfolio, say) is restored
 * as-is and simply matches nothing.
 */
function restore(raw: string): FilterValue | null {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const p = parsed as Record<string, unknown>;
  return {
    search: typeof p.search === "string" ? p.search : DEFAULT_FILTERS.search,
    photo: PHOTO_VALUES.includes(p.photo as PhotoFilter)
      ? (p.photo as PhotoFilter)
      : DEFAULT_FILTERS.photo,
    categories: (stringArray(p.categories) ??
      DEFAULT_FILTERS.categories) as FilterValue["categories"],
    statuses: (stringArray(p.statuses) ??
      DEFAULT_FILTERS.statuses) as FilterValue["statuses"],
    portfolios: stringArray(p.portfolios) ?? DEFAULT_FILTERS.portfolios,
    operator:
      typeof p.operator === "string" ? p.operator : DEFAULT_FILTERS.operator,
    businessCriticalities: (stringArray(p.businessCriticalities) ??
      DEFAULT_FILTERS.businessCriticalities) as FilterValue["businessCriticalities"],
    businessCapabilityIds:
      stringArray(p.businessCapabilityIds) ??
      DEFAULT_FILTERS.businessCapabilityIds,
  };
}

function hydrate(): void {
  if (hydrated || globalThis.window === undefined) return;
  hydrated = true;
  try {
    const raw = globalThis.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const filters = restore(raw);
    if (filters) state = { ...state, filters };
  } catch {
    // sessionStorage unavailable or corrupt value — keep the empty filters
  }
}

function persist(filters: FilterValue): void {
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // sessionStorage unavailable (private mode, etc.) — filters are still
    // shared between the panels for this session, just not across a reload
  }
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  hydrate();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): CatalogueState {
  hydrate();
  return state;
}

function getServerSnapshot(): CatalogueState {
  return DEFAULT_STATE;
}

/** Non-reactive read (e.g. to build the detail page's "Back" link). */
export function getCatalogueState(): CatalogueState {
  hydrate();
  return state;
}

export function setCatalogueFilters(filters: FilterValue): void {
  state = { ...state, filters };
  persist(filters);
  emit();
}

export function setCataloguePage(page: number): void {
  if (page === state.page) return;
  state = { ...state, page };
  emit();
}

/** Clear every axis and go back to page 1 — the panel's "Clear All" link. */
export function clearFilters(): void {
  state = { filters: DEFAULT_FILTERS, page: 1, resetToken: state.resetToken + 1 };
  persist(DEFAULT_FILTERS);
  emit();
}

/** How many axes currently narrow the list. Drives the sheet's badge and the
 * visibility of the panel's "Clear All" link. */
export function countActiveFilters(v: FilterValue): number {
  return (
    v.categories.length +
    v.statuses.length +
    v.portfolios.length +
    v.businessCriticalities.length +
    v.businessCapabilityIds.length +
    (v.search ? 1 : 0) +
    (v.operator ? 1 : 0) +
    (v.photo !== "all" ? 1 : 0)
  );
}

export function useCatalogueFilters(): CatalogueState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
