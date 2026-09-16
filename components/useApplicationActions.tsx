"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import CatalogueActions from "@/components/CatalogueActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { FilterValue } from "@/components/FilterBar";
import { capabilityNames } from "@/lib/businessCapabilities";
import {
  SEED_CONFIRM_THRESHOLD,
  buildDiscoverSeedHref,
  storeSeedIds,
} from "@/lib/discoverSeed";
import { downloadBlob, exportDateStamp } from "@/lib/downloadBlob";
import { serializeFilters } from "@/lib/filterDescription";
import type { Application, BusinessCapabilityTree } from "@/lib/types";

type Params = {
  /** The unfiltered list — only to tell "export everything" from "export a
   * subset", which is what the extra confirmation hangs on. */
  applications: Application[];
  /** What the filters let through: the subject of both actions. */
  visible: Application[];
  filters: FilterValue;
  capabilityTree: BusinessCapabilityTree | null;
};

type ApplicationActions = {
  /** The ACTIONS row, handed to `FilterBar` / `FilterSheet` through their
   * `actions` prop. Rendered **twice** on a page: the desktop column is
   * `hidden lg:block`, so it stays mounted while the mobile sheet is open. */
  actions: ReactNode;
  /** The oversized-selection warning. Must be rendered **once**, at the page
   * root — two of them would share an `aria-labelledby` and fight over the
   * focus, which is why it isn't folded into `actions`. Render it *after*
   * the mobile sheet: both are `fixed z-50`, so DOM order decides which one
   * ends up on top. */
  dialog: ReactNode;
};

/**
 * The catalogue's and the map's two quick actions — Export PDF and Show in
 * Discover — with all their state.
 *
 * Extracted from `CatalogueClient` so `/map` can offer the same actions
 * without a second copy of the PDF plumbing and the Discover thresholds.
 * A hook rather than a wrapping component because the two nodes it produces
 * land in different places: the row travels down into `FilterBar` as a prop,
 * the dialog stays at the page root.
 */
export function useApplicationActions({
  applications,
  visible,
  filters,
  capabilityTree,
}: Params): ApplicationActions {
  const [isExporting, setIsExporting] = useState(false);

  // The whole filtered set, not the current page — same rule as the PDF export.
  const discoverIds = useMemo(() => visible.map((a) => a.id), [visible]);

  /** Href of the pending Discover navigation while the warning dialog is up
   * — `null` when no dialog is open. Taken from the anchor itself, so it is
   * the URL `next/link` already resolved (basePath included); rebuilding it
   * by hand would 404 behind the AFTER gateway. */
  const [pendingDiscoverHref, setPendingDiscoverHref] = useState<string | null>(
    null,
  );
  const discoverTriggerRef = useRef<HTMLAnchorElement | null>(null);

  const handleShowInDiscover = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Below the threshold the link navigates natively — no dialog, and no
    // popup blocker to fight.
    if (discoverIds.length <= SEED_CONFIRM_THRESHOLD) return;
    e.preventDefault();
    discoverTriggerRef.current = e.currentTarget;
    setPendingDiscoverHref(e.currentTarget.href);
  };

  const closeDiscoverDialog = () => {
    setPendingDiscoverHref(null);
    discoverTriggerRef.current?.focus();
  };

  const confirmShowInDiscover = () => {
    if (!pendingDiscoverHref) return closeDiscoverDialog();
    // Past the threshold the ids no longer fit in a URL (see
    // `lib/discoverSeed.ts`): hand them over through storage and keep only a
    // token in the query. The rest of the URL — basePath included — comes
    // from the anchor `next/link` already resolved, so only the query is
    // rewritten here.
    const token = storeSeedIds(discoverIds);
    let href = pendingDiscoverHref;
    if (token) {
      const url = new URL(pendingDiscoverHref);
      url.search = `seed=${token}`;
      href = url.toString();
    }
    // Opened from the Continue click, so it counts as a user gesture.
    window.open(href, "_blank", "noopener,noreferrer");
    closeDiscoverDialog();
  };

  const handleExportPdf = async () => {
    if (visible.length === 0 || isExporting) return;
    if (
      visible.length === applications.length &&
      !window.confirm(`Export all ${visible.length} applications as PDF?`)
    ) {
      return;
    }
    setIsExporting(true);
    try {
      // Imported here and not at module scope: this is what keeps the PDF
      // engine out of the initial bundle of both pages.
      const { pdf } = await import("@react-pdf/renderer");
      const CatalogueExport = (await import("@/components/pdf/CatalogueExport"))
        .default;
      const blob = await pdf(
        CatalogueExport({
          applications: visible,
          filtersDescription: serializeFilters(
            filters,
            capabilityNames(capabilityTree, filters.businessCapabilityIds),
          ),
          baseUrl: window.location.origin,
        }),
      ).toBlob();
      downloadBlob(blob, `application-export-${exportDateStamp()}.pdf`);
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const actions = (
    <CatalogueActions
      count={visible.length}
      isExporting={isExporting}
      onExportPdf={handleExportPdf}
      discoverHref={
        visible.length === 0 ? null : buildDiscoverSeedHref(discoverIds)
      }
      onDiscoverClick={handleShowInDiscover}
    />
  );

  const dialog =
    pendingDiscoverHref === null ? null : (
      <ConfirmDialog
        title="Large selection"
        message={
          `Opening ${discoverIds.length} applications in Discover — the graph will be dense ` +
          `and loading their relations will take longer. Continue?`
        }
        onConfirm={confirmShowInDiscover}
        onCancel={closeDiscoverDialog}
      />
    );

  return { actions, dialog };
}
