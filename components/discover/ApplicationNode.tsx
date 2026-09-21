"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Handle, Position } from "@xyflow/react";
import { useDiscoverDisplaySettings } from "@/lib/discoverDisplaySettings";
import { APP_NODE_HEIGHT, APP_NODE_WIDTH } from "@/lib/discover-graph-layout";
import ResizeHorizontalIcon from "@/components/icons/ResizeHorizontalIcon";
import InfoIcon from "@/components/icons/InfoIcon";
import { useApplicationInfo } from "./ApplicationInfoContext";
import ApplicationInfoCard from "./ApplicationInfoCard";
import CapabilityPie from "./CapabilityPie";
import { useCapabilityColors } from "@/lib/discoverCapabilityLegend";

/** Half the rectangle's height, so the disc sits in the middle band and
 * clears the info button's corner. */
const PIE_SIZE = APP_NODE_HEIGHT / 2;

export type ApplicationNodeData = {
  name: string;
  externalId: string | null;
  managerName: string | null;
  isRoot: boolean;
  /** Per-node, user-resizable — falls back to the default when absent. */
  width?: number;
  /** Reports a resize-in-progress width from a drag on either vertical
   * edge; `DiscoverGraph`'s `handleResizeApplication` clamps it (floor, and
   * never past a currently-visible interface circle) and, for the left
   * edge, compensates the node's position and its circles' relative
   * position so nothing moves visually except the border itself. */
  onResize: (edge: "left" | "right", proposedWidth: number) => void;
};

/** One vertical-edge resize handle: an invisible hit-zone (`nodrag` so it
 * doesn't also trigger xyflow's node-move drag) that shows a resize cursor
 * and icon on hover, and drives `onResize` via native pointer events while
 * the user holds the button down. */
function ResizeHandle({
  edge,
  onResize,
}: Readonly<{ edge: "left" | "right"; onResize: ApplicationNodeData["onResize"] }>) {
  const [hovering, setHovering] = useState(false);
  const dragRef = useRef<{ startClientX: number; startWidth: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const width = e.currentTarget.parentElement?.getBoundingClientRect().width ?? APP_NODE_WIDTH;
    dragRef.current = { startClientX: e.clientX, startWidth: width };

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!dragRef.current) return;
      const delta = moveEvent.clientX - dragRef.current.startClientX;
      const signedDelta = edge === "right" ? delta : -delta;
      onResize(edge, dragRef.current.startWidth + signedDelta);
    };
    const onPointerUp = () => {
      dragRef.current = null;
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  return (
    <div
      className="nodrag absolute top-0 bottom-0 z-10 flex items-center justify-center"
      // An edit affordance, not content: image exports drop it (see
      // `lib/discoverImageExport.ts`).
      data-export-hide=""
      style={{
        [edge]: -5,
        width: 10,
        cursor: "ew-resize",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onPointerDown={onPointerDown}
    >
      {hovering && (
        <div className="rounded-full bg-accent text-accent-fg p-0.5 shadow">
          <ResizeHorizontalIcon size={10} />
        </div>
      )}
    </div>
  );
}

/** Rectangle node — same visual footprint/style as the `/depgraph` card,
 * with a per-node resizable width (see `ResizeHandle` above) and an info
 * icon opening a lightweight identity card (see `ApplicationInfoContext`). */
export default function ApplicationNode({
  id,
  data,
}: Readonly<{ id: string; data: ApplicationNodeData }>) {
  const settings = useDiscoverDisplaySettings();
  const { openApplicationIds, toggle, closeApplication, resolveApplication } =
    useApplicationInfo();
  const capabilityColors = useCapabilityColors();
  const width = data.width ?? APP_NODE_WIDTH;
  const infoOpen = openApplicationIds.has(id);

  /** The capabilities this application declares, in the legend's colours.
   * Resolved through the context that already serves the identity card, so
   * nothing is added to the node's data and React Flow never re-measures.
   * Empty — no capability, or an application outside the loaded catalogue —
   * means no pie at all: an empty disc would read as an unknown coverage
   * rather than as none. */
  const slices = capabilityColors
    ? (resolveApplication(id)?.businessCapabilities ?? [])
        .filter((c) => capabilityColors.has(c.id))
        // Sorted so two applications covering the same capabilities show the
        // same succession of colours.
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ id: c.id, name: c.name, color: capabilityColors.get(c.id)! }))
    : [];

  return (
    <div
      className="relative flex flex-col justify-center rounded-card border bg-surface px-3 py-2 shadow-sm"
      style={{
        width,
        height: APP_NODE_HEIGHT,
        // Room for the pie, taken from the text rather than shared with it:
        // two unreadable things would be worse than one truncated name.
        ...(slices.length > 0 ? { paddingRight: PIE_SIZE + 10 } : {}),
        borderColor: data.isRoot ? "var(--color-accent)" : "var(--color-border)",
        borderWidth: data.isRoot ? 2 : 1.5,
      }}
    >
      <Handle type="source" position={Position.Left} style={{ visibility: "hidden" }} />
      <Handle type="source" position={Position.Right} style={{ visibility: "hidden" }} />
      <Handle type="target" position={Position.Left} style={{ visibility: "hidden" }} />
      <Handle type="target" position={Position.Right} style={{ visibility: "hidden" }} />
      <ResizeHandle edge="left" onResize={data.onResize} />
      <ResizeHandle edge="right" onResize={data.onResize} />
      {/* Right edge, vertically centred — which leaves the info button its
          bottom-right corner. No `nodrag`: the rectangle's own drag and click
          reach it by bubbling, and the slices need hover for their tooltip. */}
      {slices.length > 0 && (
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
          <CapabilityPie slices={slices} size={PIE_SIZE} />
        </div>
      )}
      {settings.showName &&
        (data.externalId ? (
          /* The detail page is keyed by externalId, so an application the
             repository gave no external id to keeps a plain, unlinked title
             rather than a link that would land nowhere.

             `next/link` and not a plain anchor: behind the AFTER gateway the
             app is served under a basePath, which Link applies and a bare
             `/application?…` href would miss. `prefetch={false}` for the usual
             reason (see `ApplicationCard`): every detail link resolves to the
             same static page, so viewport prefetch would spam the gateway. */
          <Link
            href={`/application?id=${encodeURIComponent(data.externalId)}`}
            prefetch={false}
            target="_blank"
            rel="noopener noreferrer"
            // `nodrag`, or a click-and-hold on the title drags the rectangle
            // and the navigation never fires. `stopPropagation`, or the
            // rectangle's own click pins the highlight on the way out.
            className="nodrag block truncate font-mono text-sm font-semibold text-fg hover:text-accent hover:underline"
            onClick={(e) => e.stopPropagation()}
            title={`${data.name} — open the application sheet in a new tab`}
          >
            {data.name}
          </Link>
        ) : (
          <div className="truncate font-mono text-sm font-semibold text-fg" title={data.name}>
            {data.name}
          </div>
        ))}
      {settings.showExternalId && (
        <div className="truncate text-xs text-muted">{data.externalId ?? "—"}</div>
      )}
      {settings.showManager && (
        <div className="truncate text-xs text-muted">{data.managerName ?? "—"}</div>
      )}
      {/* Rendered conditionally rather than hidden: an invisible button would
          still swallow the clicks meant for the rectangle. */}
      {settings.showInfoIcons && (
        <>
          <button
            type="button"
            className="nodrag absolute bottom-0.5 right-0.5 z-10 flex items-center justify-center text-muted hover:text-accent"
            data-export-hide=""
            aria-label="Application info"
            onClick={(e) => {
              e.stopPropagation();
              toggle(id);
            }}
          >
            <InfoIcon size={12} />
          </button>
          {infoOpen && (
            <ApplicationInfoCard
              application={resolveApplication(id)}
              onClose={() => closeApplication(id)}
            />
          )}
        </>
      )}
    </div>
  );
}
