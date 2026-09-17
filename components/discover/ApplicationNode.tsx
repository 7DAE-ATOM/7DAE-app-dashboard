"use client";

import { useRef, useState } from "react";
import { Handle, Position } from "@xyflow/react";
import { useDiscoverDisplaySettings } from "@/lib/discoverDisplaySettings";
import { APP_NODE_HEIGHT, APP_NODE_WIDTH } from "@/lib/discover-graph-layout";
import ResizeHorizontalIcon from "@/components/icons/ResizeHorizontalIcon";
import InfoIcon from "@/components/icons/InfoIcon";
import { useApplicationInfo } from "./ApplicationInfoContext";
import ApplicationInfoCard from "./ApplicationInfoCard";

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
  const { openApplicationId, toggle, close, resolveApplication } = useApplicationInfo();
  const width = data.width ?? APP_NODE_WIDTH;
  const infoOpen = openApplicationId === id;
  return (
    <div
      className="relative flex flex-col justify-center rounded-card border bg-surface px-3 py-2 shadow-sm"
      style={{
        width,
        height: APP_NODE_HEIGHT,
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
      {settings.showName && (
        <div className="truncate font-mono text-sm font-semibold text-fg" title={data.name}>
          {data.name}
        </div>
      )}
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
            aria-label="Application info"
            onClick={(e) => {
              e.stopPropagation();
              toggle(id);
            }}
          >
            <InfoIcon size={12} />
          </button>
          {infoOpen && (
            <ApplicationInfoCard application={resolveApplication(id)} onClose={close} />
          )}
        </>
      )}
    </div>
  );
}
