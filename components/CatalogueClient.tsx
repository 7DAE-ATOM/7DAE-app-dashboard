"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ApplicationCard from "@/components/ApplicationCard";
import FilterBar, { type FilterValue } from "@/components/FilterBar";
import FilterSheet from "@/components/FilterSheet";
import Pagination from "@/components/Pagination";
import { filterApplications } from "@/lib/applications";
import { useApplications } from "@/lib/useApplications";
import { usePageQuery } from "@/lib/usePageQuery";
import {
  useCatalogueFilters,
  setCatalogueFilters,
  setCataloguePage,
} from "@/lib/catalogueFilters";
import { serializeFilters } from "@/lib/filterDescription";
import {
  SEED_CONFIRM_THRESHOLD,
  SEED_MAX,
  buildDiscoverSeedHref,
} from "@/lib/discoverSeed";

const PAGE_SIZE = 6;

/** Shared by the two side-panel actions (export, open in Discover) so they
 * stay visually identical — one is a <button>, the other a <Link>. */
const ACTION_BUTTON_CLASS =
  "mt-3 block w-full text-center text-xs font-mono px-3 py-2 rounded border border-border bg-surface hover:bg-accent/10 hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors";

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
  const { filters } = useCatalogueFilters();

  const visible = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
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

  const handleShowInDiscover = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (discoverIds.length > SEED_MAX) {
      e.preventDefault();
      alert(
        `Too many applications to open in Discover (${discoverIds.length}). ` +
          `Narrow the filters down to ${SEED_MAX} or fewer.`,
      );
      return;
    }
    if (
      discoverIds.length > SEED_CONFIRM_THRESHOLD &&
      !window.confirm(`Open ${discoverIds.length} applications in Discover?`)
    ) {
      e.preventDefault();
    }
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
          filtersDescription: serializeFilters(filters),
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
              value={filters}
              onChange={handleFiltersChange}
            />
            <div className="mt-4 text-xs text-muted font-mono">
              {visible.length} / {applications.length} applications
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={visible.length === 0 || isExporting}
              className={ACTION_BUTTON_CLASS}
            >
              {isExporting ? "Generating PDF…" : `Export PDF (${visible.length})`}
            </button>
            {/* An <a> has no `disabled`, so the empty case renders a real
             * disabled button instead of a dead link. */}
            {visible.length === 0 ? (
              <button type="button" disabled className={ACTION_BUTTON_CLASS}>
                Show in Discover (0)
              </button>
            ) : (
              <Link
                href={buildDiscoverSeedHref(discoverIds)}
                target="_blank"
                rel="noopener noreferrer"
                // The href carries every filtered id — nothing worth prefetching.
                prefetch={false}
                title="Opens in a new tab"
                onClick={handleShowInDiscover}
                className={ACTION_BUTTON_CLASS}
              >
                Show in Discover ({visible.length}){" "}
                <span aria-hidden="true">↗</span>
              </Link>
            )}
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

      <FilterSheet
        categories={categories}
        statuses={statuses}
        portfolios={portfolios}
        businessCriticalities={businessCriticalities}
        value={filters}
        onChange={handleFiltersChange}
        count={visible.length}
      />
    </main>
  );
}
