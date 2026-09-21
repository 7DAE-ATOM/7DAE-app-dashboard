"use client";

import { useEffect, useMemo } from "react";
import { buildHierarchyColors } from "@/lib/hierarchyColors";
import type { LegendStore } from "@/lib/discoverLegend";
import { useCanvasContents, type CanvasContents } from "@/lib/discoverCanvasContents";
import type { Application, HierarchyTree } from "@/lib/types";
import { useTheme } from "@/lib/useTheme";

type Props = {
  legend: LegendStore;
  /** The axis' hierarchy hook, which must not fetch when `enabled` is false.
   * Taken as a prop rather than imported so one component serves both axes;
   * destructured below so the hook rules see a plain `useX(…)` call. */
  useTree: (enabled: boolean) => { tree: HierarchyTree | null };
  /** Which ids of this axis the canvas currently carries. The two axes read
   * the canvas differently — interfaces carry data objects, applications
   * carry capabilities — and that difference is the caller's to state. It
   * decides which trees get the front of the hue wheel, so that whatever is
   * on screen comes out in unmistakably different colours. */
  canvasIds: (contents: CanvasContents, applicationsById: Map<string, Application>) => Set<string>;
  applicationsById: Map<string, Application>;
  /** Degrees this axis turns the hue wheel by, so the two axes never share a
   * colour — see `buildHierarchyColors`. */
  hueRotation?: number;
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
 * the render triggered by the tree's arrival — and now by every canvas change
 * — in the parent, and therefore in `DiscoverGraph`, which is not memoized.
 * Here it stops at something that renders nothing.
 *
 * Nothing is fetched while the box is unticked (SWR's `null` key), and the
 * cache is shared with the catalogue and with the panel — one crawl, whoever
 * asks.
 */
export default function LegendColorsSync({
  legend,
  useTree,
  canvasIds,
  applicationsById,
  hueRotation = 0,
}: Readonly<Props>) {
  const enabled = legend.useEnabled();
  const { tree } = useTree(enabled);
  const theme = useTheme();
  const contents = useCanvasContents();

  const onCanvas = useMemo(
    () => (enabled ? canvasIds(contents, applicationsById) : null),
    [enabled, canvasIds, contents, applicationsById],
  );

  // Rebuilt when the hierarchy, the theme, or **which families are on the
  // canvas** change — the last one is what keeps the displayed trees at the
  // wide end of the hue wheel. Adding a node inside a family already there
  // leaves every colour untouched.
  const colors = useMemo(
    () => (enabled && onCanvas ? buildHierarchyColors(tree, theme, hueRotation, onCanvas) : null),
    [enabled, tree, theme, hueRotation, onCanvas],
  );

  useEffect(() => {
    if (colors && colors.size > 0) legend.publishColors(colors);
    else legend.resetColors();
  }, [legend, colors]);

  // A palette must not outlive the page that computed it.
  useEffect(() => () => legend.resetColors(), [legend]);

  return null;
}
