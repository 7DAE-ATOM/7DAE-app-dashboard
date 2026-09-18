"use client";

import { useSyncExternalStore } from "react";
import type { FilterValue } from "@/components/FilterBar";
import type { PhotoFilter } from "@/lib/types";
import { createPersistedStore } from "@/lib/createPersistedStore";

/**
 * Single source of truth for the filters of **every** panel: the catalogue,
 * its mobile sheet, and the map — they all render the same `FilterBar`, so a
 * filter set on one applies to the others.
 *
 * The values are mirrored into `sessionStorage`, so they survive a reload of
 * the tab but not its closing. Deliberately shorter-lived than the panel's
 * folded/unfolded state (`lib/filterSectionState.ts`, `localStorage`): a
 * narrow filter forgotten since yesterday would look like an empty catalogue,
 * where a folded chapter is harmless. And deliberately *not* synced across
 * tabs — two tabs scoped to two different perimeters is a legitimate use.
 *
 * This module is the one place that mixes persisted state (the filters, held
 * by `createPersistedStore`) with volatile state (`page`, `resetToken`, which
 * must never outlive the view). `useCatalogueFilters()` composes the two into
 * a single snapshot, which is what its consumers have always received.
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
  dataObjectIds: [],
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

const PHOTO_VALUES: PhotoFilter[] = ["all", "with", "without"];

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
    dataObjectIds: stringArray(p.dataObjectIds) ?? DEFAULT_FILTERS.dataObjectIds,
  };
}

const filtersStore = createPersistedStore<FilterValue>({
  key: "app-filters",
  storage: "session",
  defaultValue: DEFAULT_FILTERS,
  parse: restore,
});

// The volatile half. Its listeners are the very same callbacks the filters
// store holds, so a change that touches both (`clearFilters`) must notify
// only once — hence the volatile values being set *before* the filters.
let page = DEFAULT_STATE.page;
let resetToken = DEFAULT_STATE.resetToken;
const volatileListeners = new Set<() => void>();

function emitVolatile(): void {
  for (const l of volatileListeners) l();
}

/**
 * The composed snapshot. `useSyncExternalStore` compares snapshots by
 * identity, so this must return the *same* object until one of the three
 * parts actually changes — a fresh object per read would loop forever.
 */
let composed: CatalogueState = DEFAULT_STATE;

function compose(): CatalogueState {
  const filters = filtersStore.get();
  if (
    composed.filters !== filters ||
    composed.page !== page ||
    composed.resetToken !== resetToken
  ) {
    composed = { filters, page, resetToken };
  }
  return composed;
}

function subscribe(cb: () => void): () => void {
  const unsubscribeFilters = filtersStore.subscribe(cb);
  volatileListeners.add(cb);
  return () => {
    unsubscribeFilters();
    volatileListeners.delete(cb);
  };
}

function getServerSnapshot(): CatalogueState {
  return DEFAULT_STATE;
}

/** Non-reactive read (e.g. to build the detail page's "Back" link). */
export function getCatalogueState(): CatalogueState {
  return compose();
}

export function setCatalogueFilters(filters: FilterValue): void {
  filtersStore.set(filters);
}

export function setCataloguePage(next: number): void {
  if (next === page) return;
  page = next;
  emitVolatile();
}

/** Clear every axis and go back to page 1 — the panel's "Clear All" link. */
export function clearFilters(): void {
  page = DEFAULT_STATE.page;
  resetToken += 1;
  // Last, and alone: its listeners are the same callbacks, so this single
  // notification already carries the page and token reset above.
  filtersStore.set(DEFAULT_FILTERS);
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
    v.dataObjectIds.length +
    (v.search ? 1 : 0) +
    (v.operator ? 1 : 0) +
    (v.photo !== "all" ? 1 : 0)
  );
}

export function useCatalogueFilters(): CatalogueState {
  return useSyncExternalStore(subscribe, compose, getServerSnapshot);
}
