"use client";

import { useEffect, useRef, useState } from "react";
import {
  usePhotoCacheSettings,
  setPhotoCacheSetting,
  PHOTO_CACHE_SIZE_MIN_MB,
  PHOTO_CACHE_SIZE_MAX_MB,
} from "@/lib/photoCacheSettings";
import { clearPhotoCache, enforceQuota, getCacheUsage } from "@/lib/photoCacheDb";
import Switch from "./Switch";

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PhotoCacheSettingsControl() {
  const settings = usePhotoCacheSettings();
  const [open, setOpen] = useState(false);
  const [usage, setUsage] = useState<{ count: number; totalBytes: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  function refreshUsage() {
    void getCacheUsage().then(setUsage);
  }

  useEffect(() => {
    if (!open) return;
    refreshUsage();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Photo cache settings"
        title="Photo cache settings"
        className="inline-flex items-center justify-center w-9 h-9 rounded text-muted hover:text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
      >
        <CacheIcon />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[240px] rounded-card border border-border bg-surface p-3 shadow-2xl"
        >
          <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-muted">
            Photo cache
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded px-1 py-1.5 text-sm text-fg hover:bg-surface-2">
            Offline cache
            <Switch
              checked={settings.enabled}
              onChange={(v) => setPhotoCacheSetting("enabled", v)}
            />
          </label>

          <div className={settings.enabled ? "" : "opacity-50"}>
            <div className="flex items-center justify-between gap-3 px-1 py-1.5 text-sm text-fg">
              <label htmlFor="photo-cache-size-slider">Size limit</label>
              <span className="font-mono text-xs text-muted">{settings.maxSizeMB} MB</span>
            </div>
            <input
              id="photo-cache-size-slider"
              type="range"
              min={PHOTO_CACHE_SIZE_MIN_MB}
              max={PHOTO_CACHE_SIZE_MAX_MB}
              step={50}
              value={settings.maxSizeMB}
              disabled={!settings.enabled}
              onChange={(e) => {
                const maxSizeMB = Number(e.target.value);
                setPhotoCacheSetting("maxSizeMB", maxSizeMB);
                void enforceQuota(maxSizeMB * 1024 * 1024).then(refreshUsage);
              }}
              className="w-full px-1"
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 border-t border-border px-1 pt-2 text-xs text-muted">
            <span>{usage ? `${formatMB(usage.totalBytes)} used (${usage.count} photos)` : "…"}</span>
            <button
              type="button"
              onClick={() => {
                void clearPhotoCache().then(refreshUsage);
              }}
              className="rounded px-2 py-1 font-semibold text-fg hover:bg-surface-2"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CacheIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}
