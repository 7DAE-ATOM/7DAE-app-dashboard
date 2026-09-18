"use client";

import { useSyncExternalStore } from "react";

/**
 * The one implementation of "a user preference, kept in browser storage, read
 * by React through `useSyncExternalStore`".
 *
 * Every preference store in `lib/` used to carry its own copy of this
 * plumbing — module state, hydration flag, listener set, `emit`, `subscribe`,
 * `getSnapshot`, `getServerSnapshot`, the `try/catch` around persistence. Six
 * copies meant six places to hold the same invariants right, and the
 * cross-tab `storage` listener was missing from all of them.
 *
 * What this factory owns:
 *  - **Lazy hydration** — storage is read on the first subscribe or read, never
 *    at import time, so importing the module stays free of side effects
 *    (including on the server).
 *  - **A constant server snapshot** — always the same `defaultValue` reference,
 *    so the server render and the first client paint agree.
 *  - **Snapshot identity** — a new reference is minted only on a real write.
 *    `useSyncExternalStore` compares snapshots by identity, so a fresh object
 *    per read loops forever; holding that invariant here is the point.
 *  - **Forgiving persistence** — unavailable storage (private mode), a corrupt
 *    value or an exceeded quota never throw: the value still applies in memory
 *    and subscribers are still notified.
 *  - **Cross-tab sync** — one `storage` listener per store, installed on the
 *    first subscriber and released with the last.
 *
 * What it deliberately leaves to each caller: the `parse` function. That is
 * where a preference's real validation lives (clamping a size, checking a
 * field at a time, filtering against a list of known keys), and it must stay
 * explicit rather than collapse into a blind `JSON.parse`.
 *
 * A preference belongs here unless it must be correct *before* hydration or be
 * readable by CSS — those two (`lib/useTheme.ts`, `lib/catalogueDensity.ts`)
 * keep the DOM as their source of truth. See CLAUDE.md.
 */
export type PersistedStore<T> = {
  /** Reactive read, for components. Named `useValue` (not `use`) so the React
   * lint rules recognise it as a hook. */
  useValue: () => T;
  /** Non-reactive read, for code called outside of React rendering. */
  get: () => T;
  set: (next: T) => void;
  /** Raw subscription, for a store that has to be composed with state of its
   * own before reaching React — see `lib/appFilters.ts`. */
  subscribe: (listener: () => void) => () => void;
};

export type PersistedStoreOptions<T> = {
  /** Storage key. Never change it for an existing store: it would silently
   * reset the preference of everyone who had set it. */
  key: string;
  /** `"local"` outlives the tab, `"session"` dies with it. */
  storage: "local" | "session";
  /** Also the server/hydration snapshot, so keep the reference stable. */
  defaultValue: T;
  /** Validates a stored string into a value. `null` (or a throw) falls back to
   * `defaultValue`. This is the store's own business rules — see above. */
  parse: (raw: string) => T | null;
  /** Needed whenever the value isn't plain JSON (a `Set`, say). */
  serialize?: (value: T) => string;
  /** Defaults to `true` for `"local"`. `sessionStorage` is per-tab by nature,
   * so syncing it would be meaningless. */
  syncAcrossTabs?: boolean;
};

export function createPersistedStore<T>({
  key,
  storage,
  defaultValue,
  parse,
  serialize = JSON.stringify,
  syncAcrossTabs = storage === "local",
}: PersistedStoreOptions<T>): PersistedStore<T> {
  let state: T = defaultValue;
  let hydrated = false;
  const listeners = new Set<() => void>();
  let stopSync: (() => void) | null = null;

  /** Reading the property itself can throw when storage is blocked by policy,
   * hence the `try` around the access and not just around the call. */
  function area(): Storage | null {
    if (globalThis.window === undefined) return null;
    try {
      return storage === "session"
        ? globalThis.sessionStorage
        : globalThis.localStorage;
    } catch {
      return null;
    }
  }

  function safeParse(raw: string): T | null {
    try {
      return parse(raw);
    } catch {
      return null;
    }
  }

  function hydrate(): void {
    if (hydrated || globalThis.window === undefined) return;
    hydrated = true;
    try {
      const raw = area()?.getItem(key);
      if (raw == null) return;
      const parsed = safeParse(raw);
      if (parsed !== null) state = parsed;
    } catch {
      // Storage unavailable or corrupt value — keep the default.
    }
  }

  function emit(): void {
    for (const listener of listeners) listener();
  }

  /** A write from another tab. `e.key === null` means the whole storage area
   * was cleared. Whatever arrives goes through the same `parse` as the value
   * read at startup: a tab trusts a sibling no more than it trusts storage. */
  function onStorage(e: StorageEvent): void {
    if (e.key !== null && e.key !== key) return;
    if (e.storageArea && e.storageArea !== area()) return;
    const next = e.key === null || e.newValue == null
      ? defaultValue
      : safeParse(e.newValue) ?? defaultValue;
    if (next === state) return;
    hydrated = true;
    state = next;
    emit();
  }

  function subscribe(listener: () => void): () => void {
    hydrate();
    listeners.add(listener);
    if (syncAcrossTabs && stopSync === null && globalThis.window !== undefined) {
      globalThis.addEventListener("storage", onStorage);
      stopSync = () => globalThis.removeEventListener("storage", onStorage);
    }
    return () => {
      listeners.delete(listener);
      // Last consumer gone: release the listener rather than leak one per
      // mount/unmount cycle of a page.
      if (listeners.size === 0 && stopSync) {
        stopSync();
        stopSync = null;
      }
    };
  }

  function getSnapshot(): T {
    hydrate();
    return state;
  }

  function getServerSnapshot(): T {
    return defaultValue;
  }

  function useValue(): T {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  return {
    useValue,
    subscribe,
    get: () => {
      hydrate();
      return state;
    },
    set: (next: T) => {
      hydrate();
      state = next;
      try {
        area()?.setItem(key, serialize(next));
      } catch {
        // Storage unavailable or quota exceeded — the setting still applies
        // for this page. Refusing to apply it would be worse than not
        // remembering it.
      }
      emit();
    },
  };
}
