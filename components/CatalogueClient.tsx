"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ApplicationCard from "@/components/ApplicationCard";
import CatalogueActions from "@/components/CatalogueActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import FilterBar, { type FilterValue } from "@/components/FilterBar";
import FilterSheet from "@/components/FilterSheet";
import Pagination from "@/components/Pagination";
import { filterApplications } from "@/lib/applications";
import { useApplications } from "@/lib/useApplications";
import { useBusinessCapabilityTree } from "@/lib/useBusinessCapabilityTree";
import {
  capabilityNames,
  countApplicationsPerNode,
  expandSelection,
} from "@/lib/businessCapabilities";
import { usePageQuery } from "@/lib/usePageQuery";
import {
  useCatalogueFilters,
  setCatalogueFilters,
  setCataloguePage,
} from "@/lib/catalogueFilters";
import { serializeFilters } from "@/lib/filterDescription";
import { SEED_CONFIRM_THRESHOLD, buildDiscoverSeedHref } from "@/lib/discoverSeed";

const PAGE_SIZE = 6;

function CatalogueSkeleton() {
  return (
    <main className="px-4 md:px-6 py-8 max-w-[1600px] mx-auto">
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="hidden lg:block">
          <div className="h-[400px] rounded-card bg-surface-2 skeleton-pulse" />
        </aside>
        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-card overflow-hidden">
                <div className="aspect-[4/3] bg-surface-2 skeleton-pulse" />
                <div className="px-4 pt-4 pb-3 space-y-2">
                  <div className="h-4 w-24 rounded bg-surface-2 skeleton-pulse" />
                  <div className="h-5 w-3/4 rounded bg-surface-2 skeleton-pulse" />
                  <div className="h-4 w-1/2 rounded bg-surface-2 skeleton-pulse" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function CatalogueClient() {
  const {
    applications,
    categories,
    statuses,
    businessCriticalities,
    portfolios,
    loading,
    error,
  } = useApplications();

  if (error) throw error;
  if (loading) return <CatalogueSkeleton />;

  return (
    <CatalogueLoaded
      applications={applications}
      categories={categories}
      statuses={statuses}
      businessCriticalities={businessCriticalities}
      portfolios={portfolios}
    />
  );
}

type LoadedProps = {
  applications: ReturnType<typeof useApplications>["applications"];
  categories: ReturnType<typeof useApplications>["categories"];
  statuses: ReturnType<typeof useApplications>["statuses"];
  businessCriticalities: ReturnType<typeof useApplications>["businessCriticalities"];
  portfolios: ReturnType<typeof useApplications>["portfolios"];
};

function CatalogueLoaded({
  applications,
  categories,
  statuses,
  businessCriticalities,
  portfolios,
}: LoadedProps) {
  // Filters live in an in-memory store (see lib/catalogueFilters) so they
  // survive catalogue → detail → catalogue ("Back to catalog") and can be reset
  // by the "Catalogue" menu, while being lost on reload.
  const { filters, resetToken } = useCatalogueFilters();

  // Secondary resource: a failed crawl costs the section, not the page (the
  // hook returns its error instead of throwing, unlike `useApplications`).
  const { tree: capabilityTree } = useBusinessCapabilityTree();

  const capabilityIdsExpanded = useMemo(
    () => expandSelection(capabilityTree, filters.businessCapabilityIds),
    [capabilityTree, filters.businessCapabilityIds],
  );

  // Every axis *except* the capabilities — this is what the per-node counts
  // are measured against, so they say what each node would actually add.
  const withoutCapabilityAxis = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  );
  const capabilityCounts = useMemo(
    () => countApplicationsPerNode(capabilityTree, withoutCapabilityAxis),
    [capabilityTree, withoutCapabilityAxis],
  );

  const visible = useMemo(
    () =>
      capabilityIdsExpanded.size === 0
        ? withoutCapabilityAxis
        : filterApplications(withoutCapabilityAxis, {
            businessCapabilityIdsExpanded: capabilityIdsExpanded,
          }),
    [withoutCapabilityAxis, capabilityIdsExpanded],
  );

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const { page, setPage } = usePageQuery(totalPages);
  const paged = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Mirror the (URL-driven, clamped) page into the store so the detail page's
  // "Back to catalog" link can restore it via ?page=N.
  useEffect(() => {
    setCataloguePage(page);
  }, [page]);

  const handleFiltersChange = (v: FilterValue) => {
    setCatalogueFilters(v);
    setPage(1);
  };

  const [isExporting, setIsExporting] = useState(false);

  // The whole filtered set, not the current page — same rule as the PDF export.
  const discoverIds = useMemo(() => visible.map((a) => a.id), [visible]);

  /** Href of the pending Discover navigation while the warning dialog is up
   * — `null` when no dialog is open. Taken from the anchor itself, so it is
   * the URL `next/link` already resolved (basePath included); rebuilding it
   * by hand would 404 behind the AFTER gateway. */
  const [pendingDiscoverHref, setPendingDiscoverHref] = useState<string | null>(null);
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
    // Opened from the Continue click, so it counts as a user gesture.
    if (pendingDiscoverHref) window.open(pendingDiscoverHref, "_blank", "noopener,noreferrer");
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `application-export-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setIsExporting(false);
    }
  };

  // One node, rendered by the desktop panel and the mobile sheet alike.
  const actions = (
    <CatalogueActions
      count={visible.length}
      isExporting={isExporting}
      onExportPdf={handleExportPdf}
      discoverHref={visible.length === 0 ? null : buildDiscoverSeedHref(discoverIds)}
      onDiscoverClick={handleShowInDiscover}
    />
  );

  return (
    <main className="px-4 md:px-6 py-8 max-w-[1600px] mx-auto">
      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        <aside className="hidden lg:block">
          <div className="sticky top-[80px]">
            <FilterBar
              categories={categories}
              statuses={statuses}
              portfolios={portfolios}
              businessCriticalities={businessCriticalities}
              capabilityTree={capabilityTree}
              capabilityCounts={capabilityCounts}
              capabilityResetToken={resetToken}
              actions={actions}
              value={filters}
              onChange={handleFiltersChange}
            />
            <div className="mt-4 text-xs text-muted font-mono">
              {visible.length} / {applications.length} applications
            </div>
          </div>
        </aside>

        <section>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {paged.map((m) => (
              <ApplicationCard key={m.id} application={m} />
            ))}
          </div>
          {visible.length === 0 && (
            <div className="py-20 text-center text-muted">
              No application matches these filters.
            </div>
          )}
          <Pagination
            page={page}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalItems={visible.length}
            onPageChange={setPage}
          />
        </section>
      </div>

      {pendingDiscoverHref !== null && (
        <ConfirmDialog
          title="Large selection"
          message={
            `Opening ${discoverIds.length} applications in Discover — the graph will be dense ` +
            `and loading their relations will take longer. Continue?`
          }
          onConfirm={confirmShowInDiscover}
          onCancel={closeDiscoverDialog}
        />
      )}

      <FilterSheet
        categories={categories}
        statuses={statuses}
        portfolios={portfolios}
        businessCriticalities={businessCriticalities}
        capabilityTree={capabilityTree}
        capabilityCounts={capabilityCounts}
        capabilityResetToken={resetToken}
        actions={actions}
        value={filters}
        onChange={handleFiltersChange}
        count={visible.length}
      />
    </main>
  );
}
