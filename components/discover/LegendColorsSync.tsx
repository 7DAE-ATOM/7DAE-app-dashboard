"use client";

import { useEffect, useMemo } from "react";
import { buildHierarchyColors } from "@/lib/hierarchyColors";
import type { LegendStore } from "@/lib/discoverLegend";
import type { HierarchyTree } from "@/lib/types";
import { useTheme } from "@/lib/useTheme";

type Props = {
  legend: LegendStore;
  /** The axis' hierarchy hook, which must not fetch when `enabled` is false.
   * Taken as a prop rather than imported so one component serves both axes;
   * destructured below so the hook rules see a plain `useX(…)` call. */
  useTree: (enabled: boolean) => { tree: HierarchyTree | null };
  /** Where this axis enters the hue wheel — see `buildHierarchyColors`. */
  wheelStart?: number;
};

/**
 * Loads one axis' hierarchy while its legend is on, and publishes the palette
 * computed from it. Renders nothing.
 *
 * It exists because a palette has to outlive the panel. The hierarchies are
 * loaded by the panel's *inner* component, which is unmounted the moment the
 * panel is folded — and folding the panel to look at the diagram is precisely
 * the gesture the colours are for.
 *
 * A component rather than a hook called by `DiscoverClient`: a hook would put
 * the render triggered by the tree's arrival in the parent, and therefore in
 * `DiscoverGraph`, which is not memoized. Here it stops at something that
 * renders nothing.
 *
 * Nothing is fetched while the box is unticked (SWR's `null` key), and the
 * cache is shared with the catalogue and with the panel — one crawl, whoever
 * asks.
 */
export default function LegendColorsSync({ legend, useTree, wheelStart = 0 }: Readonly<Props>) {
  const enabled = legend.useEnabled();
  const { tree } = useTree(enabled);
  const theme = useTheme();

  // The palette depends on the hierarchy and the theme — never on the canvas.
  // That is what lets it be computed once and republished only on those two
  // events, and what lets the colours hold still while nodes come and go.
  const colors = useMemo(
    () => (enabled ? buildHierarchyColors(tree, theme, wheelStart) : null),
    [enabled, tree, theme, wheelStart],
  );

  useEffect(() => {
    if (colors && colors.size > 0) legend.publishColors(colors);
    else legend.resetColors();
  }, [legend, colors]);

  // A palette must not outlive the page that computed it.
  useEffect(() => () => legend.resetColors(), [legend]);

  return null;
}
