"use client";

import { useEffect } from "react";
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
  clearFilters,
  useCatalogueFilters,
  setCatalogueFilters,
  setCataloguePage,
} from "@/lib/appFilters";

const PAGE_SIZE = 6;

function CatalogueSkeleton() {
  return (
    <main className="px-4 md:px-6 py-8">
      <div className="grid lg:grid-cols-[340px_1fr] gap-6">
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
  // Filters live in a shared store (see lib/appFilters) so they survive
  // catalogue → detail → catalogue ("Back to catalog") and a reload of the
  // tab, and are the same ones the map panel shows.
  const { filters, resetToken } = useCatalogueFilters();

  const { visible, capabilityTree, capabilityCounts, countUnder } =
    useFilteredApplications(applications, filters);

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
