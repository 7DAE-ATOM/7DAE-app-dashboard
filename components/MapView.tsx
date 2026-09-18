"use client";

import { useMemo, useRef, useState } from "react";
import type { Application } from "@/lib/types";
import { WORLD, EUROPE, type MapPanel } from "@/lib/world-map.generated";
import { projectOnPanel } from "@/lib/mapProjection";
import { AIRBUS_SITES } from "@/lib/airbusSites";
import { aggregateBySite } from "@/lib/siteAggregation";
import SiteApplicationsPopup, {
  type PopupSection,
} from "@/components/map/SiteApplicationsPopup";

/**
 * Offline basemap with one bubble per Airbus site.
 *
 * The outlines are generated at development time by
 * `scripts/generate-world-map.mjs` and committed, so this renders path strings
 * — no tile server, no network request, no projection library at runtime.
 *
 * Deliberately NOT themed from `useTheme()`: everything reads `--color-*`
 * tokens, so switching light/dark is a repaint with zero JavaScript.
 */

/** Bubble radii in each panel's own canvas units, calibrated so they land
 *  around 18-48 CSS px on the world map and 12-26 px on the much smaller
 *  inset. They differ because the panels render at very different scales; the
 *  NUMBER inside each bubble carries the information, the size is only a cue. */
const WORLD_RADII = { min: 22, max: 58 };
const INSET_RADII = { min: 36, max: 80 };

/** Rendered width of the inset. Its panel is nearly square (1200×1150). */
const INSET_WIDTH = 380;

type Bubble = {
  key: string;
  label: string;
  count: number;
  /** Where the bubble is drawn. */
  x: number;
  y: number;
  /** True position, when the bubble has been moved off it. */
  anchorX?: number;
  anchorY?: number;
  applications: readonly Application[];
};

type Target =
  | { kind: "bubble"; key: string; x: number; y: number }
  | { kind: "unlocated"; x: number; y: number };

function radius(count: number, maxCount: number, r: { min: number; max: number }) {
  if (maxCount <= 0) return r.min;
  // Area, not radius: encoding on the radius would quadruple the apparent
  // weight of a doubled count.
  return r.min + (r.max - r.min) * Math.sqrt(count / maxCount);
}

export default function MapView({ applications }: { applications: Application[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [includeAllSites, setIncludeAllSites] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  const aggregation = useMemo(
    () => aggregateBySite(applications, includeAllSites),
    [applications, includeAllSites],
  );

  const hasBucket = useMemo(
    () => new Set(aggregation.buckets.map((b) => b.site.id)),
    [aggregation],
  );

  /** World map: the four non-European sites, plus ONE aggregate bubble for
   *  Europe. At this scale the five European sites sit inside a 76×110 box —
   *  five separate bubbles would merge into a blob, not merely overlap. */
  const worldBubbles = useMemo<Bubble[]>(() => {
    const out: Bubble[] = [];
    for (const bucket of aggregation.buckets) {
      if (bucket.site.inEurope) continue;
      const { x, y } = projectOnPanel(WORLD, bucket.site.lng, bucket.site.lat);
      out.push({
        key: bucket.site.id,
        label: bucket.site.label,
        count: bucket.applications.length,
        x,
        y,
        applications: bucket.applications,
      });
    }
    if (aggregation.europe.length > 0) {
      // Centred on the cluster rather than on any one site.
      const points = AIRBUS_SITES.filter((s) => s.inEurope && hasBucket.has(s.id)).map((s) =>
        projectOnPanel(WORLD, s.lng, s.lat),
      );
      out.push({
        key: "europe",
        label: "Europe",
        count: aggregation.europe.length,
        x: points.reduce((n, p) => n + p.x, 0) / (points.length || 1),
        y: points.reduce((n, p) => n + p.y, 0) / (points.length || 1),
        applications: aggregation.europe,
      });
    }
    return out;
  }, [aggregation, hasBucket]);

  /** Inset: the five European sites individually. */
  const insetBubbles = useMemo<Bubble[]>(
    () =>
      aggregation.buckets
        .filter((b) => b.site.inEurope)
        .map((bucket) => {
          const { x, y } = projectOnPanel(EUROPE, bucket.site.lng, bucket.site.lat);
          const offset = bucket.site.insetOffset;
          return {
            key: bucket.site.id,
            label: bucket.site.label,
            count: bucket.applications.length,
            x: x + (offset?.[0] ?? 0),
            y: y + (offset?.[1] ?? 0),
            ...(offset ? { anchorX: x, anchorY: y } : {}),
            applications: bucket.applications,
          };
        }),
    [aggregation],
  );

  const unlocatedCount =
    aggregation.classCounts.allSites +
    aggregation.classCounts.unknown +
    aggregation.classCounts.none;

  const openAt = (
    event: { clientX: number; clientY: number },
    next: { kind: "bubble"; key: string } | { kind: "unlocated" },
  ) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setTarget({
      ...next,
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    } as Target);
  };

  const renderBubbles = (
    bubbles: Bubble[],
    radii: { min: number; max: number },
    panelKey: string,
  ) =>
    bubbles.map((bubble) => {
      const r = radius(bubble.count, aggregation.maxCount, radii);
      return (
        <g
          key={`${panelKey}-${bubble.key}`}
          role="button"
          tabIndex={0}
          aria-label={`${bubble.label}, ${bubble.count} applications`}
          className="map-bubble"
          onClick={(e) => openAt(e, { kind: "bubble", key: bubble.key })}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            const box = e.currentTarget.getBoundingClientRect();
            openAt(
              { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 },
              { kind: "bubble", key: bubble.key },
            );
          }}
        >
          {bubble.anchorX !== undefined && (
            <>
              {/* The bubble has been moved away from its true position; the
                  leader line is what keeps the map honest about where the
                  site actually is. */}
              <line
                x1={bubble.anchorX}
                y1={bubble.anchorY}
                x2={bubble.x}
                y2={bubble.y}
                className="map-bubble-leader"
              />
              <circle
                cx={bubble.anchorX}
                cy={bubble.anchorY}
                r={5}
                className="map-bubble-anchor"
              />
            </>
          )}
          <circle cx={bubble.x} cy={bubble.y} r={r} className="map-bubble-disc" />
          <text x={bubble.x} y={bubble.y} className="map-bubble-label" fontSize={r * 0.8}>
            {bubble.count}
          </text>
        </g>
      );
    });

  /** Rebuilt on every render from the aggregation, never stored: changing a
   *  filter while the popup is open must update the list, not leave a stale
   *  one on screen. */
  const popup = useMemo(() => {
    if (!target) return null;
    if (target.kind === "unlocated") {
      const sections: PopupSection[] = [
        {
          label: "Declared on all sites",
          hint: "Not plotted: the same count on every bubble would hide the differences.",
          applications: aggregation.allSites,
        },
        {
          label: "Site not recognised",
          hint:
            aggregation.unknownValues.size > 0
              ? `Values read: ${[...aggregation.unknownValues.keys()].join(", ")}`
              : undefined,
          applications: aggregation.unknown,
        },
        { label: "No site declared", applications: aggregation.none },
      ];
      return {
        title: "Not on the map",
        subtitle: `${unlocatedCount} applications`,
        sections,
      };
    }
    const bubble =
      worldBubbles.find((b) => b.key === target.key) ??
      insetBubbles.find((b) => b.key === target.key);
    if (!bubble) return null;
    return {
      title: bubble.label,
      subtitle:
        bubble.key === "europe"
          ? `${bubble.count} applications — de-duplicated, not the sum of the inset`
          : `${bubble.count} applications`,
      sections: [{ applications: bubble.applications }] as PopupSection[],
    };
  }, [target, aggregation, worldBubbles, insetBubbles, unlocatedCount]);

  const nothingDrawn = worldBubbles.length === 0 && insetBubbles.length === 0;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <Panel panel={WORLD} className="block h-full w-full map-outline" ariaLabel="World map">
        {renderBubbles(worldBubbles, WORLD_RADII, "world")}
      </Panel>

      {/* Always shown, by decision: the inset is the only place the European
          cluster is readable at all. Hidden below `lg`, where the mobile
          filter sheet takes the screen and it could not fit. */}
      <div
        className="absolute bottom-4 right-4 hidden lg:block"
        style={{ width: INSET_WIDTH }}
      >
        <div className="overflow-hidden rounded-card border border-border bg-surface/80 shadow-lg backdrop-blur-sm">
          <div className="border-b border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted">
            Europe — detail
          </div>
          <Panel panel={EUROPE} className="block w-full map-outline" ariaLabel="Map of Europe">
            {renderBubbles(insetBubbles, INSET_RADII, "inset")}
          </Panel>
        </div>
      </div>

      {/* Top-centre, not top-left: the 340px filter panel lives there. */}
      <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-card border border-border bg-surface/90 px-3 py-1.5 text-xs text-muted shadow-lg backdrop-blur-md">
          {unlocatedCount > 0 ? (
            <button
              type="button"
              onClick={(e) => openAt(e, { kind: "unlocated" })}
              className="underline decoration-dotted underline-offset-2 hover:text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {unlocatedCount} applications not on the map
            </button>
          ) : (
            <span>All applications are located</span>
          )}
          {aggregation.classCounts.allSites > 0 && (
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={includeAllSites}
                onChange={(e) => setIncludeAllSites(e.target.checked)}
                className="accent-accent"
              />
              Count &ldquo;all sites&rdquo; everywhere
            </label>
          )}
        </div>
      </div>

      {nothingDrawn && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-card border border-border bg-surface/90 px-5 py-3 text-sm text-muted backdrop-blur-md">
            No application matches these filters.
          </div>
        </div>
      )}

      {popup && target && (
        <SiteApplicationsPopup
          title={popup.title}
          subtitle={popup.subtitle}
          sections={popup.sections}
          x={target.x}
          y={target.y}
          onClose={() => setTarget(null)}
        />
      )}
    </div>
  );
}

function Panel({
  panel,
  className,
  ariaLabel,
  children,
}: {
  panel: MapPanel;
  className: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${panel.width} ${panel.height}`}
      // `meet`, not `slice`: nothing may be cropped — the whole point of a
      // world map is that Tianjin and Mirabel are on it.
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      <path d={panel.land} className="map-land" />
      <path d={panel.borders} className="map-border" />
      {children}
    </svg>
  );
}
