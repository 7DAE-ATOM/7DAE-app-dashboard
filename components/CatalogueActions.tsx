"use client";

import Link from "next/link";
import GraphIcon from "@/components/icons/GraphIcon";
import PdfIcon from "@/components/icons/PdfIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";

type Props = {
  /** Applications currently matching the filters — shown in each tooltip. */
  count: number;
  isExporting: boolean;
  onExportPdf: () => void;
  /** `null` when there is nothing to open (no match) — an `<a>` has no
   * `disabled`, so that case renders a real disabled button instead. */
  discoverHref: string | null;
  onDiscoverClick: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

/** Shared by the two icon actions so they stay visually identical — one is a
 * <button>, the other a <Link>. Round pill, solid glyph, no border. */
const ACTION_BUTTON_CLASS =
  "inline-flex h-11 w-11 items-center justify-center rounded-full bg-surface text-accent shadow-sm transition-colors hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Styled tooltip under the button, carrying the full label *and* the exact
 * count — that count used to be a badge pinned to the icon, which couldn't
 * show more than two digits. Shown on hover and on keyboard focus; never
 * intercepts the pointer, so it can't swallow a click. */
function ActionTooltip({ label }: Readonly<{ label: string }>) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-fg px-3 py-1.5 text-xs font-medium text-bg shadow-lg group-hover:block group-focus-within:block"
    >
      <span
        aria-hidden="true"
        className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-fg"
      />
      {label}
    </span>
  );
}

/**
 * The two quick actions — Export PDF and Show in Discover — rendered as round
 * icon buttons for the filter panel's "ACTIONS" row, on the catalogue and on
 * the map alike. Purely presentational: every behaviour (PDF generation,
 * Discover seed URL and its thresholds) lives in `useApplicationActions`.
 */
export default function CatalogueActions({
  count,
  isExporting,
  onExportPdf,
  discoverHref,
  onDiscoverClick,
}: Readonly<Props>) {
  const exportLabel = isExporting ? "Generating PDF…" : `Export PDF (${count})`;
  const discoverLabel = `Show in Discover (${count})`;

  return (
    <div className="flex items-center gap-3">
      <div className="group relative">
        <button
          type="button"
          onClick={onExportPdf}
          disabled={count === 0 || isExporting}
          aria-label={exportLabel}
          className={ACTION_BUTTON_CLASS}
        >
          {isExporting ? <RefreshIcon size={21} className="animate-spin" /> : <PdfIcon size={21} />}
        </button>
        <ActionTooltip label={exportLabel} />
      </div>

      <div className="group relative">
        {discoverHref === null ? (
          <button
            type="button"
            disabled
            aria-label={discoverLabel}
            className={ACTION_BUTTON_CLASS}
          >
            <GraphIcon size={21} />
          </button>
        ) : (
          <Link
            href={discoverHref}
            target="_blank"
            rel="noopener noreferrer"
            // The href carries every filtered id — nothing worth prefetching.
            prefetch={false}
            onClick={onDiscoverClick}
            aria-label={`${discoverLabel} — opens in a new tab`}
            className={ACTION_BUTTON_CLASS}
          >
            <GraphIcon size={21} />
          </Link>
        )}
        <ActionTooltip label={discoverLabel} />
      </div>
    </div>
  );
}
