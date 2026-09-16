"use client";

import { useSyncExternalStore } from "react";

/**
 * Display density of the catalogue grid: how many cards per row, and how many
 * rows per page (1 to 10, or `"all"`). The page size is the product of the
 * two, so a page always ends on a full row (except the very last one of the
 * result set); `"all"` renders the whole filtered set on a single page.
 *
 * Stored on `<html data-cat-cols data-cat-rows>` — and mirrored into the
 * `--cat-cols` custom property, which is what the grid template actually
 * reads — by the inline anti-FOUC script in `app/layout.tsx`, so the very
 * first paint already uses the right number of columns. Same DOM-as-source-of-
 * truth pattern as `lib/useTheme.ts`, and for the same reason: a module-state
 * store (`lib/photoCacheSettings.ts`, `lib/discoverDisplaySettings.ts`) would
 * render the defaults once and repaint after hydration.
 *
 * Deliberately *not* a filter: it lives in `localStorage` (it outlives the
 * tab, like the theme), it is absent from the URL, and `clearFilters` does not
 * touch it.
 */

export const COLUMN_OPTIONS = [3, 5, 8] as const;

/** `"all"` drops pagination entirely and renders the whole filtered set. */
export const ALL_ROWS = "all";
export type Rows = number | typeof ALL_ROWS;

export const ROW_OPTIONS: readonly Rows[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, ALL_ROWS,
];

export type CatalogueDensity = {
  columns: number;
  rows: Rows;
};

/** Stable reference for the server snapshot — see `getServerSnapshot`. */
export const DEFAULT_DENSITY: CatalogueDensity = { columns: 5, rows: 5 };

export const DENSITY_STORAGE_KEY = "catalogue-density";

/** The column count above which cards render in their compact variant. */
export const COMPACT_COLUMNS = 8;

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-cat-cols", "data-cat-rows"],
  });
  return () => observer.disconnect();
}

function readColumns(): number {
  const value = Number(document.documentElement.getAttribute("data-cat-cols"));
  return (COLUMN_OPTIONS as readonly number[]).includes(value)
    ? value
    : DEFAULT_DENSITY.columns;
}

function readRows(): Rows {
  const raw = document.documentElement.getAttribute("data-cat-rows");
  return normalizeRows(raw === ALL_ROWS ? ALL_ROWS : Number(raw));
}

function normalizeRows(value: unknown): Rows {
  if (value === ALL_ROWS) return ALL_ROWS;
  return ROW_OPTIONS.includes(value as Rows) ? (value as Rows) : DEFAULT_DENSITY.rows;
}

// `useSyncExternalStore` compares snapshots by identity, so a fresh object on
// every call would loop forever. Only mint a new one when a value changed.
let snapshot: CatalogueDensity = DEFAULT_DENSITY;

function getSnapshot(): CatalogueDensity {
  if (typeof document === "undefined") return DEFAULT_DENSITY;
  const columns = readColumns();
  const rows = readRows();
  if (columns !== snapshot.columns || rows !== snapshot.rows) {
    snapshot = { columns, rows };
  }
  return snapshot;
}

function getServerSnapshot(): CatalogueDensity {
  return DEFAULT_DENSITY;
}

/** `pageSize` is `null` when rows is `"all"`: the caller decides what "one
 * page of everything" means for the list it holds. */
export function useCatalogueDensity(): CatalogueDensity & {
  pageSize: number | null;
} {
  const density = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    ...density,
    pageSize: density.rows === ALL_ROWS ? null : density.columns * density.rows,
  };
}

export function setDensity(partial: Partial<CatalogueDensity>): void {
  if (typeof document === "undefined") return;
  const current = getSnapshot();
  const next: CatalogueDensity = {
    columns: (COLUMN_OPTIONS as readonly number[]).includes(partial.columns as number)
      ? (partial.columns as number)
      : current.columns,
    rows: partial.rows === undefined ? current.rows : normalizeRows(partial.rows),
  };
  const root = document.documentElement;
  root.setAttribute("data-cat-cols", String(next.columns));
  root.setAttribute("data-cat-rows", String(next.rows));
  root.style.setProperty("--cat-cols", String(next.columns));
  try {
    localStorage.setItem(DENSITY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, etc.) — session-only setting still works
  }
}
