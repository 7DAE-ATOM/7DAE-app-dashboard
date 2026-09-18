"use client";

import useSWR from "swr";
import { NEXT_PUBLIC_ATOM_API_BASE_URL } from "@/lib/atom-api";
import { PHOTO_PLACEHOLDER } from "@/lib/photo";
import { getCachedBlob, putCachedBlob } from "@/lib/photoCacheDb";
import { getPhotoCacheSettings } from "@/lib/photoCacheSettings";

/** Cached photo: the decoded Blob (reused by the PDF export) plus a session-long
 * object URL for `<img>`. The URL is created ONCE in the fetcher and never
 * revoked per-component — that is what lets catalogue, detail and export share
 * the same image without re-POSTing. */
export type CachedPhoto = { url: string; blob: Blob };

/** SWR key for a photo resource. Keep in sync with the PDF export cache read in
 * `CatalogueClient`. The uri is captured by the fetcher, not part of the key. */
export function photoKey(resourceId: string): [string, string] | null {
  return resourceId ? ["photo", resourceId] : null;
}

/**
 * Fetches a photo, consulting/populating the persistent IndexedDB cache
 * (`lib/photoCacheDb.ts`) first when `persist` is true and the user has the
 * cache enabled (`lib/photoCacheSettings.ts`). `persist` is false for 360°
 * panoramas — those are large and stay session-only (SWR memory cache).
 */
export async function fetchPhoto(
  resourceId: string,
  resourceUri: string,
  persist = true,
): Promise<CachedPhoto> {
  const settings = getPhotoCacheSettings();
  const useDurableCache = persist && settings.enabled;

  if (useDurableCache) {
    const cached = await getCachedBlob(resourceId);
    if (cached) return { url: URL.createObjectURL(cached), blob: cached };
  }

  const res = await fetch(`${NEXT_PUBLIC_ATOM_API_BASE_URL}/api/infos/resource`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: resourceId, uri: resourceUri }),
  });
  if (!res.ok) throw new Error(`photo ${res.status}`);
  const blob = await res.blob();

  if (useDurableCache) void putCachedBlob(resourceId, blob, settings.maxSizeMB);

  return { url: URL.createObjectURL(blob), blob };
}

export type PhotoState = { url: string; isLoading: boolean };

/**
 * Returns a session-cached object URL for a backend photo resource, or
 * PHOTO_PLACEHOLDER while loading / on error, plus `isLoading` so callers can
 * show a spinner during the (often slow, 5-30s) backend round trip. Backed by
 * SWR so the same resource is fetched once and shared everywhere.
 *
 * `persist` controls whether this photo is eligible for the durable
 * IndexedDB cache — pass `false` for 360° panoramas.
 */
export function usePhoto(resourceId: string, resourceUri: string, persist = true): PhotoState {
  const { data, isLoading } = useSWR(
    resourceId && resourceUri ? photoKey(resourceId) : null,
    () => fetchPhoto(resourceId, resourceUri, persist),
  );
  return { url: data?.url ?? PHOTO_PLACEHOLDER, isLoading };
}
