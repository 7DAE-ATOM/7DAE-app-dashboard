"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import ExportIcon from "@/components/icons/ExportIcon";

type Props = {
  /** No graph, nothing to export — the whole control goes quiet. */
  disabled: boolean;
  onExportMermaid: () => void;
};

/**
 * "Export" menu for the Discover toolbar, sitting left of the display-settings
 * gear and built on the same popover mechanics (Escape, outside click, same
 * button size) so the two controls read as a pair.
 *
 * PNG and SVG are listed but inert: they capture the canvas, which is a
 * different mechanism altogether and a separate iteration. Showing them now
 * means the menu won't have to be redrawn then.
 */
export default function DiscoverExportMenu({
  disabled,
  onExportMermaid,
}: Readonly<Props>) {
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

  const itemClass =
    "flex w-full items-center justify-between gap-6 rounded px-2 py-1.5 text-left text-sm";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label="Export diagram"
        aria-haspopup="menu"
        aria-expanded={open}
        // Same frame as `DiscoverDisplaySettings`' gear, on purpose.
        className="flex h-9 w-9 items-center justify-center rounded border border-border bg-surface text-muted hover:text-fg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-muted"
      >
        <ExportIcon size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-56 rounded-card border border-border bg-surface p-2 shadow-lg"
        >
          <div className="mb-1 px-2 text-xs uppercase tracking-[0.1em] text-muted">
            Export as
          </div>
          {(["PNG", "SVG"] as const).map((format) => (
            <button
              key={format}
              type="button"
              role="menuitem"
              disabled
              className={clsx(itemClass, "cursor-not-allowed text-muted")}
            >
              <span>{format}</span>
              <span className="text-[10px] uppercase tracking-wider">Soon</span>
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onExportMermaid();
            }}
            className={clsx(itemClass, "text-fg hover:bg-surface-2")}
          >
            <span>Mermaid</span>
            <span className="font-mono text-[10px] text-muted">.mmd</span>
          </button>
        </div>
      )}
    </div>
  );
}
