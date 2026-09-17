"use client";

import clsx from "clsx";
import InfoIcon from "@/components/icons/InfoIcon";
import {
  setDiscoverDisplaySetting,
  useDiscoverDisplaySettings,
} from "@/lib/discoverDisplaySettings";

/**
 * Shows or hides the info icons carried by the application rectangles and the
 * interface circles — useful when the diagram is being projected or captured
 * rather than explored.
 *
 * Same pictogram in both states: which one you are in is carried by the
 * filled/quiet treatment, exactly like the selected segment of
 * `DiscoverViewModeToggle`. The tooltip names the action the click will
 * perform, not the current state.
 *
 * Reads and writes the store itself — nothing upstream needs to know.
 */
export default function DiscoverInfoIconsToggle() {
  const { showInfoIcons } = useDiscoverDisplaySettings();
  const label = showInfoIcons ? "Hide info icons" : "Show info icons";

  return (
    <button
      type="button"
      aria-pressed={showInfoIcons}
      aria-label={label}
      title={label}
      onClick={() => setDiscoverDisplaySetting("showInfoIcons", !showInfoIcons)}
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded border transition-colors",
        showInfoIcons
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface text-muted hover:text-fg",
      )}
    >
      <InfoIcon size={16} />
    </button>
  );
}
