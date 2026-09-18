"use client";

import { createPersistedStore } from "@/lib/createPersistedStore";

/**
 * Global, user-configurable settings for the persistent (IndexedDB) photo
 * cache — see `lib/photoCacheDb.ts`.
 */
export type PhotoCacheSettings = {
  enabled: boolean;
  maxSizeMB: number;
};

export const PHOTO_CACHE_SIZE_MIN_MB = 50;
export const PHOTO_CACHE_SIZE_MAX_MB = 1000;

const DEFAULT_SETTINGS: PhotoCacheSettings = {
  enabled: true,
  maxSizeMB: 200,
};

const store = createPersistedStore<PhotoCacheSettings>({
  key: "photo-cache-settings",
  storage: "local",
  defaultValue: DEFAULT_SETTINGS,
  // Field by field, and the size clamped rather than trusted: a stored value
  // out of range would let the cache grow past what the user allowed.
  parse: (raw) => {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const p = parsed as Partial<PhotoCacheSettings>;
    return {
      enabled: typeof p.enabled === "boolean" ? p.enabled : DEFAULT_SETTINGS.enabled,
      maxSizeMB:
        typeof p.maxSizeMB === "number" && Number.isFinite(p.maxSizeMB)
          ? Math.min(
              PHOTO_CACHE_SIZE_MAX_MB,
              Math.max(PHOTO_CACHE_SIZE_MIN_MB, p.maxSizeMB),
            )
          : DEFAULT_SETTINGS.maxSizeMB,
    };
  },
});

export function usePhotoCacheSettings(): PhotoCacheSettings {
  return store.useValue();
}

/** Non-hook read for use outside React (the `usePhoto` fetcher). */
export function getPhotoCacheSettings(): PhotoCacheSettings {
  return store.get();
}

export function setPhotoCacheSetting<K extends keyof PhotoCacheSettings>(
  key: K,
  value: PhotoCacheSettings[K],
): void {
  store.set({ ...store.get(), [key]: value });
}
