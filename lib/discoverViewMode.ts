"use client";

import { useSyncExternalStore } from "react";

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

const STORAGE_KEY = "discover-view-mode";

/** The model view stays the default: switching it would silently change what
 * every existing user sees on their next visit. */
const DEFAULT_MODE: DiscoverViewMode = "complex";

let state: DiscoverViewMode = DEFAULT_MODE;
let hydrated = false;
const listeners = new Set<() => void>();

function hydrate(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "simple" || raw === "complex") state = raw;
  } catch {
    // Corrupt/unavailable storage — keep the default.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): DiscoverViewMode {
  hydrate();
  return state;
}

function getServerSnapshot(): DiscoverViewMode {
  return DEFAULT_MODE;
}

export function setDiscoverViewMode(mode: DiscoverViewMode): void {
  state = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Quota/private mode — the switch still applies for this session.
  }
  emit();
}

export function useDiscoverViewMode(): DiscoverViewMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
