"use client";

import useSWR from "swr";
import { getDataObjectTree } from "@/lib/dataObjects";
import type { DataObjectTree } from "@/lib/types";

/** SWR key for the Data Object hierarchy. Exported so `RefreshButton` can
 * invalidate it alongside the applications and the capabilities. */
export const SWR_KEY_DATA_OBJECTS = "data-objects";

export type DataObjectTreeState = {
  tree: DataObjectTree | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Loads the Data Object hierarchy behind the catalogue's Data Objects filter.
 *
 * Same contract as `useBusinessCapabilityTree`, for the same reason: the error
 * is **returned, never thrown**, so a failed crawl costs its own filter section
 * and not the whole catalogue.
 *
 * `enabled` is SWR's own way of not fetching (a `null` key): it lets a caller
 * that only *sometimes* needs the hierarchy — `DataObjectColorsSync`, which
 * needs it only while the legend is on — hold the hook unconditionally while
 * costing nothing. The cache stays shared: several callers, one crawl.
 */
export function useDataObjectTree(enabled = true): DataObjectTreeState {
  const { data, error, isLoading } = useSWR(
    enabled ? SWR_KEY_DATA_OBJECTS : null,
    getDataObjectTree,
  );

  return {
    tree: data ?? null,
    isLoading,
    error: (error as Error) ?? null,
  };
}
