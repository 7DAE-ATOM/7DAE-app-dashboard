"use client";

import { useCallback, useMemo } from "react";
import type { FilterValue } from "@/components/FilterBar";
import type { Application, BusinessCapabilityTree } from "@/lib/types";
import { filterApplications } from "@/lib/applications";
import {
  countApplicationsPerNode,
  expandSelection,
} from "@/lib/businessCapabilities";
import { useBusinessCapabilityTree } from "@/lib/useBusinessCapabilityTree";

export type FilteredApplications = {
  /** The applications matching every axis — what the catalogue paginates and
   * what the map plots. */
  visible: Application[];
  /** `null` while the hierarchy loads, or if its crawl failed: the panel then
   * omits the whole section rather than showing it empty. */
  capabilityTree: BusinessCapabilityTree | null;
  capabilityCounts: Map<string, number>;
  /** How many applications `visible` would hold under another filter — the
   * hover preview on each filter option. Same pipeline, so a preview and the
   * result it announces can never disagree. */
  countUnder: (next: FilterValue) => number;
};

/**
 * Applies a `FilterValue` to a list of applications, and produces the
 * per-node counts of the Business Capabilities tree along the way.
 *
 * Shared by the catalogue and the map so the capability plumbing exists once:
 * both render the same `FilterBar`, and duplicating these memos is how the
 * two views would end up filtering differently.
 */
export function useFilteredApplications(
  applications: Application[],
  filters: FilterValue,
): FilteredApplications {
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

  const countUnder = useCallback(
    (next: FilterValue) => {
      const base = filterApplications(applications, next);
      const expanded = expandSelection(capabilityTree, next.businessCapabilityIds);
      return expanded.size === 0
        ? base.length
        : filterApplications(base, {
            businessCapabilityIdsExpanded: expanded,
          }).length;
    },
    [applications, capabilityTree],
  );

  return { visible, capabilityTree, capabilityCounts, countUnder };
}
