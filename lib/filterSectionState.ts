"use client";

import { useSyncExternalStore } from "react";

/**
 * Which chapters of the FILTERING block are unfolded, persisted per browser.
 * Same external-store pattern as `lib/photoCacheSettings.ts`
 * (`useSyncExternalStore` + `localStorage`).
 *
 * We store the *open* sections rather than the folded ones: everything the
 * stored value doesn't mention is folded, which is both the first-visit
 * default and the right behaviour for an axis added later on.
 */
export type SectionKey =
  | "photo"
  | "category"
  | "status"
  | "portfolio"
  | "operator"
  | "criticality"
  | "capabilities";

const SECTION_KEYS: SectionKey[] = [
  "photo",
  "category",
  "status",
  "portfolio",
  "operator",
  "criticality",
  "capabilities",
];

const STORAGE_KEY = "filter-sections-open";

/** First visit: everything folded. Also the server/hydration snapshot, so the
 * panel never renders open and then folds under the user's eyes. */
const DEFAULT_OPEN: ReadonlySet<SectionKey> = new Set();

let state: ReadonlySet<SectionKey> = DEFAULT_OPEN;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || globalThis.window === undefined) return;
  hydrated = true;
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    state = new Set(
      parsed.filter((k): k is SectionKey =>
        SECTION_KEYS.includes(k as SectionKey),
      ),
    );
  } catch {
    // localStorage unavailable or corrupt value — keep everything folded
  }
}

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(callback: () => void): () => void {
  hydrate();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ReadonlySet<SectionKey> {
  hydrate();
  return state;
}

function getServerSnapshot(): ReadonlySet<SectionKey> {
  return DEFAULT_OPEN;
}

export function useOpenFilterSections(): ReadonlySet<SectionKey> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function toggleFilterSection(key: SectionKey): void {
  hydrate();
  const next = new Set(state);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  state = next;
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  } catch {
    // localStorage unavailable (private mode, etc.) — session-only fold still works
  }
  emit();
}
