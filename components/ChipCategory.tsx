"use client";

import { useState } from "react";
import type { ApplicationCategory } from "@/lib/types";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/lib/labels";
import { PICTOGRAM_SIZE } from "@/lib/pictogramSizes";

/**
 * Category as a pictogram (see `CATEGORY_ICONS`), on its own: each category
 * has its own artwork, so the label next to it was redundant. The label stays
 * available to screen readers and on hover.
 *
 * Client component only because of the `onError` fallback: if an asset ever
 * goes missing, the category falls back to its text chip instead of showing a
 * broken image. Both callers (`ApplicationCard`, `ApplicationHeader`) are
 * already client components.
 */
export default function ChipCategory({
  category,
  size = PICTOGRAM_SIZE.card,
}: {
  category: ApplicationCategory;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  const label = CATEGORY_LABELS[category] ?? CATEGORY_LABELS.notDefined;
  const icon = CATEGORY_ICONS[category] ?? CATEGORY_ICONS.notDefined;

  if (failed) {
    return (
      <span className="chip-type inline-flex items-center px-2 py-0.5 rounded">
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
