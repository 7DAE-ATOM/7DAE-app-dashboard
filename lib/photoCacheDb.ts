/**
 * Persistent (IndexedDB) cache for backend photo blobs — see `lib/usePhoto.ts`.
 * The backend `/api/infos/resource` round trip can take 5-30s, so caching the
 * decoded Blob across page reloads/sessions avoids re-downloading photos the
 * user has already seen.
 *
 * Every function here fails open: if IndexedDB is unavailable (private
 * browsing, disabled storage, quota errors, etc.) it resolves to a harmless
 * default (`null` / no-op / zeroed usage) instead of throwing, so callers
 * never need special-case error handling — the app just falls back to a
 * plain network fetch, same as before this cache existed.
 */

const DB_NAME = "app-photo-cache";
const DB_VERSION = 1;
const STORE_NAME = "photos";
const LAST_ACCESSED_INDEX = "lastAccessed";

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type CacheEntry = {
  resourceId: string;
  blob: Blob;
  size: number;
  lastAccessed: number;
  cachedAt: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise ??= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "resourceId" });
          store.createIndex(LAST_ACCESSED_INDEX, "lastAccessed");
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T | null> {
  return new Promise((resolve) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

export async function getCachedBlob(resourceId: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    const entry = await requestToPromise<CacheEntry>(tx.objectStore(STORE_NAME).get(resourceId));
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > TTL_MS) {
      void deleteCachedBlob(resourceId);
      return null;
    }
    void touchCachedBlob(resourceId);
    return entry.blob;
  } catch {
    return null;
  }
}

async function touchCachedBlob(resourceId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entry = await requestToPromise<CacheEntry>(store.get(resourceId));
    if (entry) store.put({ ...entry, lastAccessed: Date.now() });
  } catch {
    // best-effort — a stale lastAccessed just makes this entry evict sooner
  }
}

async function deleteCachedBlob(resourceId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(resourceId);
  } catch {
    // ignore
  }
}

export async function putCachedBlob(
  resourceId: string,
  blob: Blob,
  maxSizeMB: number,
): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const now = Date.now();
    const entry: CacheEntry = { resourceId, blob, size: blob.size, lastAccessed: now, cachedAt: now };
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    await enforceQuota(maxSizeMB * 1024 * 1024);
  } catch {
    // failed to persist — the caller already has the blob in memory, so the
    // photo still displays fine, it just won't survive a reload
  }
}

/** Evicts least-recently-accessed entries until total size <= maxBytes. */
export async function enforceQuota(maxBytes: number): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const entries: { size: number; key: IDBValidKey }[] = [];
    let total = 0;
    await new Promise<void>((resolve) => {
      const req = store.index(LAST_ACCESSED_INDEX).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        const entry = cursor.value as CacheEntry;
        entries.push({ size: entry.size, key: cursor.primaryKey });
        total += entry.size;
        cursor.continue();
      };
      req.onerror = () => resolve();
    });
    for (const e of entries) {
      if (total <= maxBytes) break;
      store.delete(e.key);
      total -= e.size;
    }
  } catch {
    // best-effort — worst case the cache temporarily exceeds the cap
  }
}

export async function clearPhotoCache(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  try {
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
  } catch {
    // ignore
  }
}

export async function getCacheUsage(): Promise<{ count: number; totalBytes: number }> {
  const db = await openDb();
  if (!db) return { count: 0, totalBytes: 0 };
  try {
    const tx = db.transaction(STORE_NAME, "readonly");
    let count = 0;
    let totalBytes = 0;
    await new Promise<void>((resolve) => {
      const req = tx.objectStore(STORE_NAME).openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return resolve();
        count += 1;
        totalBytes += (cursor.value as CacheEntry).size;
        cursor.continue();
      };
      req.onerror = () => resolve();
    });
    return { count, totalBytes };
  } catch {
    return { count: 0, totalBytes: 0 };
  }
}
