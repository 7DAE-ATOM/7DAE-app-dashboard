"use client";

import { createLegendStore } from "@/lib/discoverLegend";

/**
 * The business-capability legend: the checkbox in the Highlight panel's
 * Business Capabilities chapter, and the palette drawn as pie slices inside
 * the application rectangles (`ApplicationNode`).
 *
 * The twin of `lib/discoverDataObjectLegend.ts`, and deliberately a **separate
 * instance**: the two axes are independent, one can be lit without the other,
 * and each remembers its own switch.
 */
const legend = createLegendStore("discover-capability-legend");

export const capabilityLegend = legend;

export function setCapabilityLegendEnabled(enabled: boolean): void {
  legend.setEnabled(enabled);
}

export function useCapabilityLegendEnabled(): boolean {
  return legend.useEnabled();
}

/** The palette to draw with, or `null` when nothing should be drawn. */
export function useCapabilityColors(): ReadonlyMap<string, string> | null {
  return legend.useColors();
}
