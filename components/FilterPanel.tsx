"use client";

import clsx from "clsx";
import type { ComponentProps } from "react";
import FilterBar from "@/components/FilterBar";

type Props = ComponentProps<typeof FilterBar> & {
  /** The N of "N / M applications" — how many survive the filters. */
  count: number;
  /** The M — the unfiltered total. */
  total: number;
  /** Layout only: where the panel sits, how wide and how tall it may grow.
   * Never the frame's appearance, which has to stay identical on both pages.
   * Note it lands on a `flex flex-col` root, so a caller that hides the panel
   * restores it with `lg:flex`, not `lg:block`. */
  className?: string;
};

/**
 * The framed filter panel shared by the catalogue and the map.
 *
 * The frame lives here rather than in `FilterBar` on purpose: `FilterSheet`
 * is already a chassis of its own (surface, top border, rounded top, p-6,
 * grab handle, "Show N results"), and a frame inside it would stack padding
 * and draw a border with no contrast. So the mobile sheet renders a bare
 * `FilterBar`, and the two desktop pages share this wrapper — which is what
 * keeps them from drifting apart again.
 */
export default function FilterPanel({
  count,
  total,
  className,
  ...bar
}: Readonly<Props>) {
  return (
    <div className={clsx("flex flex-col", className)}>
      {/* Scrolling belongs to the framed box, not to the wrapper: on the map
       * the panel is height-capped, and scrolling the wrapper would carry the
       * top and bottom borders out of sight. Inert on the catalogue, which
       * caps nothing. */}
      <div className="glass-panel min-h-0 overflow-y-auto p-5">
        <FilterBar {...bar} />
      </div>
      <div className="mt-4 shrink-0 font-mono text-xs text-muted">
        {count} / {total} applications
      </div>
    </div>
  );
}
