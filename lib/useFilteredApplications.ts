"use client";

import { useCallback, useMemo } from "react";
import type { FilterValue } from "@/components/FilterBar";
import type { Application, BusinessCapabilityTree, DataObjectTree } from "@/lib/types";
import { filterApplications } from "@/lib/applications";
import { expandSelection } from "@/lib/hierarchyTree";
import { countApplicationsPerNode } from "@/lib/businessCapabilities";
import { countApplicationsPerDataObject } from "@/lib/dataObjects";
import { useBusinessCapabilityTree } from "@/lib/useBusinessCapabilityTree";
import { useDataObjectTree } from "@/lib/useDataObjectTree";

export type FilteredApplications = {
  /** The applications matching every axis — what the catalogue paginates and
   * what the map plots. */
  visible: Application[];
  /** `null` while the hierarchy loads, or if its crawl failed: the panel then
   * omits the whole section rather than showing it empty. */
  capabilityTree: BusinessCapabilityTree | null;
  capabilityCounts: Map<string, number>;
  dataObjectTree: DataObjectTree | null;
  dataObjectCounts: Map<string, number>;
  /** How many applications `visible` would hold under another filter — what
   * feeds the facet count on each filter option (that axis narrowed to the one
   * option, the others left as they are). Same pipeline as `visible`, so a
   * count and the result it announces can never disagree. */
  countUnder: (next: FilterValue) => number;
};

/**
 * Applies a `FilterValue` to a list of applications, and produces the per-node
 * counts of both hierarchical axes — Business Capabilities and Data Objects —
 * along the way.
 *
 * Shared by the catalogue and the map so the hierarchy plumbing exists once:
 * both render the same `FilterBar`, and duplicating these memos is how the two
 * views would end up filtering differently.
 */
export function useFilteredApplications(
  applications: Application[],
  filters: FilterValue,
): FilteredApplications {
  const { tree: capabilityTree } = useBusinessCapabilityTree();
  const { tree: dataObjectTree } = useDataObjectTree();

  const capabilityIdsExpanded = useMemo(
    () => expandSelection(capabilityTree, filters.businessCapabilityIds),
    [capabilityTree, filters.businessCapabilityIds],
  );
  const dataObjectIdsExpanded = useMemo(
    () => expandSelection(dataObjectTree, filters.dataObjectIds),
    [dataObjectTree, filters.dataObjectIds],
  );

  // Every flat axis, neither hierarchical one — the common ancestor of the two
  // counting bases below.
  const base = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  );

  // A node's count says what it would add *given the other filters*, so each
  // hierarchical axis is counted against everything except itself — including
  // the other hierarchical axis. Hence two bases rather than one.
  const afterCapabilities = useMemo(
    () =>
      capabilityIdsExpanded.size === 0
        ? base
        : filterApplications(base, {
            businessCapabilityIdsExpanded: capabilityIdsExpanded,
          }),
    [base, capabilityIdsExpanded],
  );
  const afterDataObjects = useMemo(
    () =>
      dataObjectIdsExpanded.size === 0
        ? base
        : filterApplications(base, { dataObjectIdsExpanded }),
    [base, dataObjectIdsExpanded],
  );

  const capabilityCounts = useMemo(
    () => countApplicationsPerNode(capabilityTree, afterDataObjects),
    [capabilityTree, afterDataObjects],
  );
  const dataObjectCounts = useMemo(
    () => countApplicationsPerDataObject(dataObjectTree, afterCapabilities),
    [dataObjectTree, afterCapabilities],
  );

  const visible = useMemo(
    () =>
      dataObjectIdsExpanded.size === 0
        ? afterCapabilities
        : filterApplications(afterCapabilities, { dataObjectIdsExpanded }),
    [afterCapabilities, dataObjectIdsExpanded],
  );

  const countUnder = useCallback(
    (next: FilterValue) => {
      const flat = filterApplications(applications, next);
      const capabilities = expandSelection(capabilityTree, next.businessCapabilityIds);
      const withCapabilities =
        capabilities.size === 0
          ? flat
          : filterApplications(flat, {
              businessCapabilityIdsExpanded: capabilities,
            });
      const objects = expandSelection(dataObjectTree, next.dataObjectIds);
      return objects.size === 0
        ? withCapabilities.length
        : filterApplications(withCapabilities, {
            dataObjectIdsExpanded: objects,
          }).length;
    },
    [applications, capabilityTree, dataObjectTree],
  );

  return {
    visible,
    capabilityTree,
    capabilityCounts,
    dataObjectTree,
    dataObjectCounts,
    countUnder,
  };
}
