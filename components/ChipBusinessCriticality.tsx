"use client";

import { useState } from "react";
import type { BusinessCriticality } from "@/lib/types";
import { BUSINESS_CRITICALITY_LABELS, CRITICALITY_ICONS } from "@/lib/labels";
import { PICTOGRAM_SIZE } from "@/lib/pictogramSizes";

/**
 * Business criticality as a gauge pictogram (see `CRITICALITY_ICONS`): the
 * same shield with as many of its four bars lit as the level is high. It
 * replaces the coloured text chip, which took more width than the whole rest
 * of the card's chip row.
 *
 * Two consequences worth knowing: the level is no longer colour-coded (all
 * four artworks are blue), and neighbouring levels differ by a single bar —
 * hence the generous default size, and the label kept in `alt`/`title`.
 *
 * Client component only because of the `onError` fallback: a missing asset
 * falls back to the text chip rather than hiding the level altogether.
 */
export default function ChipBusinessCriticality({
  level,
  size = PICTOGRAM_SIZE.card,
}: {
  level: BusinessCriticality;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  // An undefined criticality is not information worth a pictogram: "Not set"
  // only added noise next to the category one.
  if (level === "NA") return null;

  const label = BUSINESS_CRITICALITY_LABELS[level];
  const icon = CRITICALITY_ICONS[level];
  if (!icon) return null;

  if (failed) {
    return (
      <span className="inline-flex items-center rounded bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
        {label}
      </span>
    );
  }

  return (
    <img
      src={icon}
      alt={label}
      title={label}
      width={size}
      height={size}
      // Explicit dimensions in the style: Tailwind's preflight forces
      // `img { height: auto }`, which would otherwise ignore the attribute.
      style={{ width: size, height: size }}
      className="shrink-0 object-contain"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
