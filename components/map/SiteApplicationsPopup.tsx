"use client";

import { useEffect, useRef } from "react";
import type { Application } from "@/lib/types";

export type PopupSection = {
  /** Omitted when the popup has a single, self-evident list. */
  readonly label?: string;
  readonly hint?: string;
  readonly applications: readonly Application[];
};

type Props = {
  title: string;
  subtitle: string;
  sections: readonly PopupSection[];
  /** Pixel coordinates inside the map container, from the triggering click. */
  x: number;
  y: number;
  onClose: () => void;
};

/**
 * The list behind a bubble — and behind the "not on the map" notice.
 *
 * Deliberately dumb: it holds no copy of the applications. `MapView` rebuilds
 * `sections` from the aggregation on every render, so changing a filter while
 * this is open updates the list instead of leaving a stale one on screen.
 *
 * Dismissal follows `components/discover/NodeContextMenu.tsx`: Escape, plus an
 * outside click caught in the CAPTURE phase. Bubble phase is not enough when
 * something between here and the document stops propagation.
 */
export default function SiteApplicationsPopup({
  title,
  subtitle,
  sections,
  x,
  y,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown, true);
    };
  }, [onClose]);

  const total = sections.reduce((n, s) => n + s.applications.length, 0);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      // Clamped so a bubble near the right or bottom edge does not push the
      // panel off-canvas. `max-w` keeps it clear of the 340px filter panel.
      style={{ left: `min(${x}px, calc(100% - 22rem))`, top: `min(${y}px, calc(100% - 20rem))` }}
      className="absolute z-20 flex max-h-80 w-80 flex-col rounded-card border border-border bg-surface shadow-lg"
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-fg">{title}</h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="ml-auto shrink-0 rounded p-1 text-muted hover:text-fg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {total === 0 ? (
          <p className="px-2 py-3 text-sm text-muted">No application</p>
        ) : (
          sections.map((section, i) =>
            section.applications.length === 0 ? null : (
              <div key={section.label ?? i} className="mb-2 last:mb-0">
                {section.label && (
                  <div className="px-2 pb-1 pt-2">
                    <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
                      {section.label} ({section.applications.length})
                    </div>
                    {section.hint && (
                      <div className="text-[11px] text-muted">{section.hint}</div>
                    )}
                  </div>
                )}
                <ul>
                  {section.applications.map((application) => (
                    <li key={application.id}>
                      {/* A plain anchor, not next/link: it opens in a new tab
                          anyway, and every detail link resolves to the SAME
                          static page — Next's viewport prefetch would fire one
                          request per row and flood the gateway (see the comment
                          on components/ApplicationCard.tsx). */}
                      <a
                        href={`/application?id=${encodeURIComponent(application.externalId)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate rounded px-2 py-1 text-sm text-fg hover:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-accent"
                        title={application.name}
                      >
                        {application.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
