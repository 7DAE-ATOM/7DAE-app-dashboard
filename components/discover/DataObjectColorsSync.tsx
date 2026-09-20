"use client";

import { useEffect, useMemo } from "react";
import { buildDataObjectColors } from "@/lib/dataObjectColors";
import {
  publishDataObjectColors,
  resetDataObjectColors,
  useDataObjectLegendEnabled,
} from "@/lib/discoverDataObjectLegend";
import { useDataObjectTree } from "@/lib/useDataObjectTree";
import { useTheme } from "@/lib/useTheme";

/**
 * Loads the Data Object hierarchy while the legend is on, and publishes the
 * palette computed from it. Renders nothing.
 *
 * It exists because the palette has to outlive the panel. The hierarchy is
 * loaded by the panel's *inner* component, which is unmounted the moment the
 * panel is folded — and folding the panel to look at the diagram is precisely
 * the gesture the coloured dots are for. Mounted here, next to the panel
 * rather than inside it, the legend survives the fold and comes back on its
 * own after a reload.
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
export default function DataObjectColorsSync() {
  const enabled = useDataObjectLegendEnabled();
  const { tree } = useDataObjectTree(enabled);
  const theme = useTheme();

  // The palette depends on the hierarchy and the theme — never on the canvas.
  // That is what lets it be computed once and republished only on those two
  // events, and what lets the dots keep their colour while nodes come and go.
  const colors = useMemo(
    () => (enabled ? buildDataObjectColors(tree, theme) : null),
    [enabled, tree, theme],
  );

  useEffect(() => {
    if (colors && colors.size > 0) publishDataObjectColors(colors);
    else resetDataObjectColors();
  }, [colors]);

  // A palette must not outlive the page that computed it.
  useEffect(() => resetDataObjectColors, []);

  return null;
}
