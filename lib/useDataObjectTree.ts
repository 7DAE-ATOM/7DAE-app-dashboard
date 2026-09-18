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
 */
export function useDataObjectTree(): DataObjectTreeState {
  const { data, error, isLoading } = useSWR(SWR_KEY_DATA_OBJECTS, getDataObjectTree);

  return {
    tree: data ?? null,
    isLoading,
    error: (error as Error) ?? null,
  };
}
