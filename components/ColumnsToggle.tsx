"use client";

import clsx from "clsx";
import {
  COLUMN_OPTIONS,
  setDensity,
  useCatalogueDensity,
} from "@/lib/catalogueDensity";

/** Three-bar glyph, purely decorative — the digit carries the meaning. */
function GridGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 12 12"
      className="h-3 w-3"
      fill="currentColor"
    >
      <rect x="0" y="1" width="3" height="10" rx="0.5" />
      <rect x="4.5" y="1" width="3" height="10" rx="0.5" />
      <rect x="9" y="1" width="3" height="10" rx="0.5" />
    </svg>
  );
}

/**
 * Cards-per-row selector for the catalogue grid (3 / 5 / 8).
 *
 * Desktop only: below `lg` the grid is locked to 1 then 2 columns, so the
 * control would have nothing to change. Styled like `Pagination`'s buttons so
 * the two display controls read as one family.
 */
export default function ColumnsToggle() {
  const { columns } = useCatalogueDensity();

  const btnBase =
    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition-colors";
  const btnInactive = "bg-surface text-fg border-border hover:border-accent";
  const btnActive = "bg-accent text-accent-fg border-accent";

  return (
    <div
      role="group"
      aria-label="Cards per row"
      className="hidden lg:inline-flex items-center gap-1"
    >
      <span className="mr-1 text-xs text-muted">Cards per row</span>
      {COLUMN_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => setDensity({ columns: n })}
          aria-pressed={n === columns}
          aria-label={`${n} cards per row`}
          className={clsx(btnBase, n === columns ? btnActive : btnInactive)}
        >
          <GridGlyph />
          {n}
        </button>
      ))}
    </div>
  );
}
