"use client";

import dynamic from "next/dynamic";
import FilterPanel from "@/components/FilterPanel";
import FilterSheet from "@/components/FilterSheet";
import { useApplicationActions } from "@/components/useApplicationActions";
import {
  clearFilters,
  setCatalogueFilters,
  useCatalogueFilters,
} from "@/lib/appFilters";
import { useApplications } from "@/lib/useApplications";
import { useFilteredApplications } from "@/lib/useFilteredApplications";

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
  // Same store as the catalogue: a filter set there applies here, and the
  // other way round.
  const { filters, resetToken } = useCatalogueFilters();

  const {
    visible,
    selectable,
    capabilityTree,
    capabilityCounts,
    dataObjectTree,
    dataObjectCounts,
    countUnder,
  } =
    useFilteredApplications(applications, filters);

  const { actions, dialog } = useApplicationActions({
    applications,
    visible,
    filters,
    capabilityTree,
    dataObjectTree,
  });

  return (
    <div className="relative h-[calc(100vh-57px)]">
      <div className="absolute inset-0">
        <MapView applications={visible} />
      </div>
      {/* `lg:flex`, not `lg:block`: the panel's root is a flex column, and a
          block display would break the height cap that makes the frame
          scroll internally. */}
      <FilterPanel
        className="absolute top-4 left-4 md:left-6 w-[340px] max-h-[calc(100vh-100px)] z-10 hidden lg:flex"
        categories={categories}
        statuses={statuses}
        portfolios={portfolios}
        businessCriticalities={businessCriticalities}
        capabilityTree={capabilityTree}
        capabilityCounts={capabilityCounts}
        dataObjectTree={dataObjectTree}
        dataObjectCounts={dataObjectCounts}
        selectableApplications={selectable}
        capabilityResetToken={resetToken}
        actions={actions}
        previewCount={countUnder}
        value={filters}
        onChange={setCatalogueFilters}
        onClear={clearFilters}
        count={visible.length}
        total={applications.length}
      />
      <FilterSheet
        categories={categories}
        statuses={statuses}
        portfolios={portfolios}
        businessCriticalities={businessCriticalities}
        capabilityTree={capabilityTree}
        capabilityCounts={capabilityCounts}
        dataObjectTree={dataObjectTree}
        dataObjectCounts={dataObjectCounts}
        selectableApplications={selectable}
        capabilityResetToken={resetToken}
        actions={actions}
        previewCount={countUnder}
        value={filters}
        onChange={setCatalogueFilters}
        onClear={clearFilters}
        count={visible.length}
      />

      {/* After the sheet, not before: both are `fixed z-50`, so DOM order is
          what puts the dialog on top when the mobile sheet is open. */}
      {dialog}
    </div>
  );
}
