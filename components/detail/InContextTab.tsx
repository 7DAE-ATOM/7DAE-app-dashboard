"use client";

import StarGraph, {
  type StarEdgeDirection,
  type StarNeighbor,
} from "@/components/StarGraph";
import { useApplicationLinks } from "@/lib/useApplicationLinks";
import type { Application, LinkDirection } from "@/lib/types";

const EDGE_DIRECTION: Record<LinkDirection, StarEdgeDirection> = {
  inbound: "in",
  outbound: "out",
  both: "both",
  unknown: "none",
};

function LegendEntry({
  markerStart,
  markerEnd,
  label,
}: {
  markerStart?: boolean;
  markerEnd?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <svg width="40" height="10" viewBox="0 0 40 10" aria-hidden="true">
        <defs>
          <marker
            id={`legend-${label}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="var(--color-muted)" />
          </marker>
        </defs>
        <line
          x1="4"
          y1="5"
          x2="36"
          y2="5"
          stroke="var(--color-muted)"
          strokeWidth="1.3"
          markerStart={markerStart ? `url(#legend-${label})` : undefined}
          markerEnd={markerEnd ? `url(#legend-${label})` : undefined}
        />
      </svg>
      <span className="text-xs uppercase tracking-[0.15em] font-mono text-muted">
        {label}
      </span>
    </div>
  );
}

/**
 * Content of the In Context tab on the Application detail page: a star
 * diagram of the applications this one exchanges data with.
 *
 * Unlike the other tabs, this one fetches its own data — `/links` is a
 * separate endpoint we do not want to pay for on every fiche opening. It
 * loads on first activation (`Tabs` only mounts the active panel) and keeps
 * any failure inside this panel instead of throwing to `app/error.tsx`.
 *
 * Neighbours open in a new tab, so exploring the graph never costs the reader
 * the fiche they started from.
 */
export default function InContextTab({
  application,
}: {
  application: Application;
}) {
  const { links, isLoading, error, retry } = useApplicationLinks(
    application.externalId,
  );

  if (isLoading) {
    return (
      <div className="aspect-[4/3] w-full rounded-card bg-surface-2 skeleton-pulse" />
    );
  }

  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 space-y-3 text-center">
        <p className="text-sm text-muted">
          Linked applications could not be loaded.
        </p>
        <button
          type="button"
          onClick={retry}
          className="text-xs uppercase tracking-[0.15em] font-mono text-accent hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!links || links.length === 0) {
    return <p className="text-sm text-muted">No linked application</p>;
  }

  const neighbors: StarNeighbor[] = links.map((link) => ({
    id: link.externalId,
    label: link.name,
    sublabel: link.externalId,
    direction: EDGE_DIRECTION[link.direction],
  }));

  return (
    <div className="space-y-4">
      <StarGraph
        center={{
          id: application.externalId,
          label: application.name,
          sublabel: application.externalId,
        }}
        neighbors={neighbors}
        nodeHref={(externalId) =>
          `/application?id=${encodeURIComponent(externalId)}`
        }
        ariaLabel={`${application.name} and its ${neighbors.length} linked applications`}
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-4">
        <LegendEntry markerStart label="Inbound" />
        <LegendEntry markerEnd label="Outbound" />
        <LegendEntry markerStart markerEnd label="Both" />
        <span className="text-xs uppercase tracking-[0.15em] font-mono text-muted ml-auto">
          {neighbors.length} linked
        </span>
      </div>
    </div>
  );
}
