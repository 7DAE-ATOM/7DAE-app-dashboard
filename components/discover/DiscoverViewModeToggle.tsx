"use client";

import clsx from "clsx";
import {
  setDiscoverViewMode,
  useDiscoverViewMode,
  type DiscoverViewMode,
} from "@/lib/discoverViewMode";

/** The hint spells out the one thing that separates the two modes — whether
 * the interface circles are drawn — since "Simple"/"Complex" alone says
 * nothing about what is gained or lost. Native `title`, like every other
 * hover hint on the canvas (`NodeContextMenu`, `ApplicationNode`). */
const MODES: { value: DiscoverViewMode; label: string; hint: string }[] = [
  {
    value: "simple",
    label: "Simple",
    hint: "Simple — hides the interface circles: one arrow per consumer → provider pair. Same links, without the interface details.",
  },
  {
    value: "complex",
    label: "Complex",
    hint: "Complex — the LeanIX model as-is: each link passes through the interface circle that carries it, with its name and protocol.",
  },
];

/**
 * Two labelled segments rather than a `Switch`: a binary toggle doesn't name
 * the state it is in, and the current mode has to be readable without
 * touching anything.
 *
 * Reads and writes the store itself — nothing upstream needs to know the mode.
 */
export default function DiscoverViewModeToggle() {
  const mode = useDiscoverViewMode();

  return (
    // Same height and border as the export button and the gear it sits next to.
    <div
      role="radiogroup"
      aria-label="Diagram view mode"
      title="Show interface details?"
      className="flex h-9 items-center rounded border border-border bg-surface p-0.5"
    >
      {MODES.map((m) => {
        const active = mode === m.value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={m.hint}
            onClick={() => setDiscoverViewMode(m.value)}
            className={clsx(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-accent text-accent-fg"
                : "text-muted hover:text-fg",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
