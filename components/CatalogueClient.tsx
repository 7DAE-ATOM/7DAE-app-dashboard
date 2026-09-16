"use client";

import { useEffect, useRef } from "react";
import ApplicationCard from "@/components/ApplicationCard";
import type { FilterValue } from "@/components/FilterBar";
import FilterPanel from "@/components/FilterPanel";
import FilterSheet from "@/components/FilterSheet";
import Pagination from "@/components/Pagination";
import { useApplicationActions } from "@/components/useApplicationActions";
import { useApplications } from "@/lib/useApplications";
import { useFilteredApplications } from "@/lib/useFilteredApplications";
import { usePageQuery } from "@/lib/usePageQuery";
import {
  COMPACT_COLUMNS,
  setDensity,
  useCatalogueDensity,
} from "@/lib/catalogueDensity";
import {
  clearFilters,
  useCatalogueFilters,
  setCatalogueFilters,
  setCataloguePage,
} from "@/lib/appFilters";

/**
 * Column count comes from `--cat-cols` on `<html>` (set before the first paint
 * by the inline script in `app/layout.tsx`) rather than from a React-rendered
 * inline style: no hydration mismatch, and no repaint of the whole grid once
 * the stored preference is read. Below `lg` the setting is ignored — 8 cards
 * per row on a phone is meaningless.
 *
 * The string must stay a literal: Tailwind's JIT scans source files, and the
 * project has no safelist, so a template-built class would be purged.
 */
const GRID_CLASS =
  "grid grid-cols-1 sm:grid-cols-2 gap-5 lg:[grid-template-columns:repeat(var(--cat-cols,3),minmax(0,1fr))]";

function CatalogueSkeleton() {
  const { columns, pageSize } = useCatalogueDensity();
  // "All rows": the real count isn't known before the data lands, so fill a
  // few rows — enough to cover the fold without painting hundreds of blocks.
  const placeholders = Math.min(pageSize ?? columns * 4, 40);
  return (
    <main className="px-4 md:px-6 py-8">
      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        <aside className="hidden lg:block">
          <div className="h-[400px] rounded-card bg-surface-2 skeleton-pulse" />
        </aside>
        <section>
          <div className={GRID_CLASS}>
            {Array.from({ length: placeholders }).map((_, i) => (
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
  // Filters live in a shared store (see lib/appFilters) so they survive
  // catalogue → detail → catalogue ("Back to catalog") and a reload of the
  // tab, and are the same ones the map panel shows.
  const { filters, resetToken } = useCatalogueFilters();

  const { visible, capabilityTree, capabilityCounts, countUnder } =
    useFilteredApplications(applications, filters);

  const { columns, rows, pageSize } = useCatalogueDensity();
  // "All rows" = a single page holding the whole filtered set. Resolving it to
  // a concrete size here (rather than to Infinity in the store) keeps the
  // `Showing 1–N of N` counter and the page arithmetic below honest.
  const size = pageSize ?? Math.max(visible.length, 1);

  const totalPages = Math.max(1, Math.ceil(visible.length / size));
  const { page, setPage } = usePageQuery(totalPages);
  const paged = visible.slice((page - 1) * size, page * size);

  // Changing the density must not throw the user back to page 1: land on the
  // page that still holds the application that was at the top of the grid.
  // `usePageQuery` clamps the result to `totalPages` on its own.
  // Keyed on `pageSize` (the setting) and not on `size` (which also moves with
  // the filters in "all" mode) so a filter change keeps going through the
  // usual reset-to-page-1 path.
  const prevSize = useRef(size);
  useEffect(() => {
    if (prevSize.current === size) return;
    const firstIndex = (page - 1) * prevSize.current;
    prevSize.current = size;
    setPage(Math.floor(firstIndex / size) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  // Mirror the (URL-driven, clamped) page into the store so the detail page's
  // "Back to catalog" link can restore it via ?page=N.
  useEffect(() => {
    setCataloguePage(page);
  }, [page]);

  const handleFiltersChange = (v: FilterValue) => {
    setCatalogueFilters(v);
    setPage(1);
  };

  const { actions, dialog } = useApplicationActions({
    applications,
    visible,
    filters,
    capabilityTree,
  });

  return (
    <main className="px-4 md:px-6 py-8">
      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
        <aside className="hidden lg:block">
          <FilterPanel
            className="sticky top-[80px]"
            categories={categories}
            statuses={statuses}
            portfolios={portfolios}
            businessCriticalities={businessCriticalities}
            capabilityTree={capabilityTree}
            capabilityCounts={capabilityCounts}
            capabilityResetToken={resetToken}
            actions={actions}
            previewCount={countUnder}
            value={filters}
            onChange={handleFiltersChange}
            onClear={clearFilters}
            count={visible.length}
            total={applications.length}
          />
        </aside>

        <section>
          <div className={GRID_CLASS}>
            {paged.map((m) => (
              <ApplicationCard
                key={m.id}
                application={m}
                compact={columns >= COMPACT_COLUMNS}
              />
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
            pageSize={size}
            totalItems={visible.length}
            onPageChange={setPage}
            rows={rows}
            onRowsChange={(r) => setDensity({ rows: r })}
          />
        </section>
      </div>

      <FilterSheet
        categories={categories}
        statuses={statuses}
        portfolios={portfolios}
        businessCriticalities={businessCriticalities}
        capabilityTree={capabilityTree}
        capabilityCounts={capabilityCounts}
        capabilityResetToken={resetToken}
        actions={actions}
        previewCount={countUnder}
        value={filters}
        onChange={handleFiltersChange}
        onClear={clearFilters}
        count={visible.length}
      />

      {/* After the sheet, not before: both are `fixed z-50`, so DOM order is
          what puts the dialog on top when the mobile sheet is open. */}
      {dialog}
    </main>
  );
}
