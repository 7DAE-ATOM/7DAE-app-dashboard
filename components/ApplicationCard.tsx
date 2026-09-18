"use client";

import clsx from "clsx";
import Link from "next/link";
import { useMemo } from "react";
import type { Application } from "@/lib/types";
import { usePhoto } from "@/lib/usePhoto";
import { generateApplicationCoverDataUri } from "@/lib/generated-cover";
import ChipCategory from "./ChipCategory";
import BadgeStatus from "./BadgeStatus";
import ChipBusinessCriticality from "./ChipBusinessCriticality";
import { PICTOGRAM_SIZE } from "@/lib/pictogramSizes";

/**
 * Application names run from a 3-letter acronym to a full sentence, so a fixed
 * size either wastes the card or clips the name. Step the type down as the
 * name grows — and start lower on a compact card, which is roughly half as
 * wide. Classes are literals: Tailwind's JIT scans sources and the project has
 * no safelist, so a computed `text-[${n}px]` would be purged.
 */
function titleSizeClass(length: number, compact: boolean): string {
  if (compact) {
    if (length > 44) return "text-[11px]";
    if (length > 26) return "text-xs";
    return "text-sm";
  }
  if (length > 64) return "text-sm";
  return "text-base";
}

export default function ApplicationCard({
  application,
  compact = false,
}: {
  application: Application;
  /** Densest grid setting (8 cards per row, see `lib/catalogueDensity.ts`):
   * around 200px wide the secondary meta line and a two-line title turn the
   * card into a block of ellipses, so both are trimmed. The 4:3 cover ratio
   * never changes — that is what keeps rows aligned. */
  compact?: boolean;
}) {
  const { url: realCover } = usePhoto(
    application.coverPhoto?.id ?? "",
    application.coverPhoto?.uri ?? "",
  );
  const generatedCover = useMemo(
    () => generateApplicationCoverDataUri(application.name, application.externalId),
    [application.name, application.externalId],
  );
  const coverSrc = application.coverPhoto ? realCover : generatedCover;
  // Category and criticality always share a size — see lib/pictogramSizes.ts.
  const pictogramSize = compact
    ? PICTOGRAM_SIZE.cardCompact
    : PICTOGRAM_SIZE.card;

  return (
    <Link
      href={`/application?id=${encodeURIComponent(application.externalId)}`}
      // No prefetch: every detail link resolves to the SAME static page
      // (/application, the ?id= is read client-side), so Next's viewport
      // prefetch would just refetch the same shell per card and spam the gateway
      // with 301/403 on load. Navigation still works on click.
      prefetch={false}
      // Full-height flex column so the status row can be pinned to the bottom
      // whatever the name takes: cards on the same grid row stay aligned.
      className="bench-card group flex h-full flex-col overflow-hidden rounded-card transition-all duration-200"
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-surface-2">
        <img
          src={coverSrc}
          alt={application.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div
        // `gap`, not `space-y-*`: the spacing utility sets a margin-top on
        // every sibling, which would fight the `mt-auto` that pushes the
        // status row down.
        className={clsx(
          "flex flex-1 flex-col",
          compact ? "gap-1.5 px-3 pt-3 pb-2" : "gap-2 px-4 pt-4 pb-3",
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <ChipCategory category={application.category} size={pictogramSize} />
          <ChipBusinessCriticality
            level={application.businessCriticality}
            size={pictogramSize}
          />
        </div>
        <h3
          className={clsx(
            "font-semibold leading-tight break-words hyphens-auto",
            titleSizeClass(application.name.length, compact),
            compact ? "line-clamp-3" : "line-clamp-2",
          )}
          // Truncation is still possible for the rare very long name, so keep
          // the full one reachable on hover.
          title={application.name}
        >
          {application.name}
        </h3>
        {!compact && (
          <p className="text-[11px] text-muted font-mono">
            [{application.externalId}]
            {application.portfolio ? ` · ${application.portfolio.name}` : ""}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          <BadgeStatus status={application.status} />
          <span className="text-xs text-muted font-mono">
            {application.completion}%
          </span>
        </div>
      </div>
    </Link>
  );
}
