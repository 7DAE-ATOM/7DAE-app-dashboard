"use client";

import { createLegendStore } from "@/lib/discoverLegend";

/**
 * The data-object legend: the checkbox in the Highlight panel's Data Object
 * chapter, and the palette drawn as dots on the flows (`GraphEdge`).
 *
 * All the machinery is in `lib/discoverLegend.ts`, shared with the capability
 * legend (`lib/discoverCapabilityLegend.ts`). What is left here is the storage
 * key and the names its consumers read.
 */
const legend = createLegendStore("discover-data-object-legend");

export const dataObjectLegend = legend;

export function setDataObjectLegendEnabled(enabled: boolean): void {
  legend.setEnabled(enabled);
}

export function useDataObjectLegendEnabled(): boolean {
  return legend.useEnabled();
}

/** The palette to draw with, or `null` when nothing should be drawn. */
export function useDataObjectColors(): ReadonlyMap<string, string> | null {
  return legend.useColors();
}
