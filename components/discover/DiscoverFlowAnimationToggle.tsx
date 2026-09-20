"use client";

import clsx from "clsx";
import FlowAnimationIcon from "@/components/icons/FlowAnimationIcon";
import { useDataObjectLegendEnabled } from "@/lib/discoverDataObjectLegend";
import {
  setDiscoverDisplaySetting,
  useDiscoverDisplaySettings,
} from "@/lib/discoverDisplaySettings";

/**
 * Sets the data-object dots travelling along the flows instead of sitting
 * still at their midpoint.
 *
 * Same treatment as its neighbour `DiscoverInfoIconsToggle`: one pictogram for
 * both states, which one you are in carried by the filled/quiet treatment, and
 * a tooltip naming the action rather than the state.
 *
 * It animates the dots — it does not create them. With the legend off there is
 * nothing on the flows to move, so the tooltip says what to tick. Greying the
 * button out would be worse: an inert control whose cause lives at the bottom
 * of another panel reads as a fault.
 */
export default function DiscoverFlowAnimationToggle() {
  const { animateFlows } = useDiscoverDisplaySettings();
  const legendOn = useDataObjectLegendEnabled();

  const label = animateFlows ? "Stop animating flows" : "Animate flows";
  const title = legendOn
    ? label
    : `${label} — tick “Only what flows on the diagram” in the Highlight panel to see them`;

  return (
    <button
      type="button"
      aria-pressed={animateFlows}
      aria-label={label}
      title={title}
      onClick={() => setDiscoverDisplaySetting("animateFlows", !animateFlows)}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded border transition-colors",
        animateFlows
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface text-muted hover:text-fg",
      )}
    >
      <FlowAnimationIcon size={16} />
    </button>
  );
}
