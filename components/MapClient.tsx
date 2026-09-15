"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import FilterBar, { type FilterValue } from "@/components/FilterBar";
import FilterSheet from "@/components/FilterSheet";
import { filterApplications } from "@/lib/applications";
import { DEFAULT_FILTERS } from "@/lib/catalogueFilters";
import { useApplications } from "@/lib/useApplications";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

function MapSkeleton() {
  return (
    <div className="relative h-[calc(100vh-57px)] bg-surface-2 skeleton-pulse flex items-center justify-center">
      <span className="text-sm text-muted font-mono">Loading map…</span>
    </div>
  );
}

export default function MapClient() {
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
  if (loading) return <MapSkeleton />;

  return (
    <MapLoaded
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

function MapLoaded({
  applications,
  categories,
  statuses,
  businessCriticalities,
  portfolios,
}: LoadedProps) {
  // The map keeps its own (non-persisted) filter state, but starts from the
  // catalogue's defaults so a new axis never has to be duplicated here.
  const [filters, setFilters] = useState<FilterValue>(DEFAULT_FILTERS);

  const visible = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  );

  return (
    <div className="relative h-[calc(100vh-57px)]">
      <div className="absolute inset-0">
        <MapView applications={visible} />
      </div>
      <div className="absolute top-4 left-4 w-[340px] max-h-[calc(100vh-100px)] glass-panel p-5 overflow-y-auto z-10 hidden lg:block">
        <h2 className="text-lg font-bold mb-1">Applications by location</h2>
        <p className="text-xs text-muted mb-4">No location data available yet</p>
        <FilterBar
          categories={categories}
          statuses={statuses}
          portfolios={portfolios}
          businessCriticalities={businessCriticalities}
          value={filters}
          onChange={setFilters}
        />
      </div>
      <FilterSheet
        categories={categories}
        statuses={statuses}
        portfolios={portfolios}
        businessCriticalities={businessCriticalities}
        value={filters}
        onChange={setFilters}
        count={visible.length}
      />
    </div>
  );
}
