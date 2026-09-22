"use client";

import { useEffect, useRef, useState } from "react";
import Switch from "@/components/Switch";
import {
  BOX_WIDTH_MAX,
  BOX_WIDTH_MIN,
  BOX_WIDTH_STEP,
  setDiscoverDisplaySetting,
  useDiscoverDisplaySettings,
  type DiscoverDisplaySettings,
} from "@/lib/discoverDisplaySettings";

/** The settings rendered as switches — i.e. every boolean one. Keeps
 * `edgeCurvature` out of `ROWS`, which drives `<Switch>`. */
type ToggleKey = {
  [K in keyof DiscoverDisplaySettings]: DiscoverDisplaySettings[K] extends boolean
    ? K
    : never;
}[keyof DiscoverDisplaySettings];

const ROWS: { key: ToggleKey; label: string }[] = [
  { key: "showName", label: "Name" },
  { key: "showExternalId", label: "External ID" },
  { key: "showManager", label: "Application Manager" },
];

/** Adapted from `/depgraph`'s `DisplaySettingsControl` — a gear-icon popover
 * of toggles, reduced to the 3 attributes this iteration configures. */
export default function DiscoverDisplaySettings() {
  const settings = useDiscoverDisplaySettings();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Display settings"
        className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface text-muted hover:text-fg"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-card border border-border bg-surface p-3 shadow-lg">
          <div className="mb-1 text-xs uppercase tracking-[0.1em] text-muted">Show on cards</div>
          <div className="flex flex-col gap-2">
            {ROWS.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-fg">{row.label}</span>
                <Switch
                  checked={settings[row.key]}
                  onChange={(v) => setDiscoverDisplaySetting(row.key, v)}
                />
              </div>
            ))}
          </div>

          {/* No section header, unlike its neighbours: the row label says it
              all, and it keeps the panel aligned with the same control in
              7DAE-ltm-dashboard's dependency graph. */}
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="box-width" className="text-sm text-fg">
                Box width
              </label>
              <span className="w-12 text-right font-mono text-xs text-muted tabular-nums">
                {settings.boxWidth}px
              </span>
            </div>
            <input
              id="box-width"
              type="range"
              min={BOX_WIDTH_MIN}
              max={BOX_WIDTH_MAX}
              step={BOX_WIDTH_STEP}
              value={settings.boxWidth}
              onChange={(e) =>
                setDiscoverDisplaySetting("boxWidth", Number(e.target.value))
              }
              className="mt-2 w-full accent-[var(--color-accent)]"
            />
          </div>

          <div className="mb-1 mt-4 border-t border-border pt-3 text-xs uppercase tracking-[0.1em] text-muted">
            Links
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="edge-curvature" className="text-sm text-fg">
              Link curvature
            </label>
            <span className="w-10 text-right font-mono text-xs text-muted tabular-nums">
              {settings.edgeCurvature}%
            </span>
          </div>
          <input
            id="edge-curvature"
            type="range"
            min={0}
            max={100}
            step={10}
            value={settings.edgeCurvature}
            onChange={(e) =>
              setDiscoverDisplaySetting("edgeCurvature", Number(e.target.value))
            }
            className="mt-2 w-full accent-[var(--color-accent)]"
          />
        </div>
      )}
    </div>
  );
}
