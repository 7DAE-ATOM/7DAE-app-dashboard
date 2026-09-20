"use client";

import useSWR from "swr";
import { getBusinessCapabilityTree } from "@/lib/businessCapabilities";
import type { BusinessCapabilityTree } from "@/lib/types";

/** SWR key for the Business Capability hierarchy. Exported so
 * `RefreshButton` can invalidate it alongside the applications. */
export const SWR_KEY_BUSINESS_CAPABILITIES = "business-capabilities";

export type BusinessCapabilityTreeState = {
  tree: BusinessCapabilityTree | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Loads the capability hierarchy that backs the catalogue's Business
 * Capabilities filter.
 *
 * The error is **returned, never thrown** — same reasoning as
 * `useApplicationLinks`: this is a secondary resource, and a failed crawl must
 * cost the filter section alone, not replace the whole catalogue with the
 * `app/error.tsx` screen (which is what `CatalogueClient` does with the
 * applications' own error).
 *
 * Called from the same render as `useApplications`, so the two crawls run in
 * parallel with no sequencing to write; the global SWR cache then shares the
 * tree across pages.
 *
 * `enabled` is SWR's own way of not fetching (a `null` key): it lets a caller
 * that only *sometimes* needs the hierarchy — `LegendColorsSync`, which needs
 * it only while the capability legend is on — hold the hook unconditionally
 * while costing nothing. The cache stays shared: several callers, one crawl.
 */
export function useBusinessCapabilityTree(enabled = true): BusinessCapabilityTreeState {
  const { data, error, isLoading } = useSWR(
    enabled ? SWR_KEY_BUSINESS_CAPABILITIES : null,
    getBusinessCapabilityTree,
  );

  return {
    tree: data ?? null,
    isLoading,
    error: (error as Error) ?? null,
  };
}
