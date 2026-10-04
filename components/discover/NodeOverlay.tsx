"use client";

import type { ReactNode } from "react";
import { useInternalNode, ViewportPortal } from "@xyflow/react";

/** Above every node and edge xyflow can stack: a selected node is lifted by
 * 1000, its child interfaces and their links one more (see `calculateZ` /
 * `getElevatedEdgeZIndex` in `@xyflow/system`). */
const OVERLAY_Z_INDEX = 10000;

/**
 * Renders `children` over the node `nodeId`, but outside it — in xyflow's
 * viewport portal.
 *
 * Why not simply inside the node: every node is its own stacking context with
 * a z-index set by xyflow, and the interface circles (children of their
 * application) plus the links attached to them are always one level above the
 * application rectangles. A card drawn inside a node, whatever its own
 * z-index, therefore stays behind them and behind every later node — which is
 * what made the identity cards unreadable.
 *
 * The wrapper replicates the node's box in graph coordinates (it still pans
 * and zooms with the canvas, and follows the node when it is dragged), so a
 * card positioned against its parent — `left: calc(100% + 8px)`,
 * `bottom: 0` — lands exactly where it did when it lived in the node.
 */
export default function NodeOverlay({
  nodeId,
  children,
}: Readonly<{ nodeId: string; children: ReactNode }>) {
  const node = useInternalNode(nodeId);
  if (!node) return null;
  const { x, y } = node.internals.positionAbsolute;

  return (
    <ViewportPortal>
      <div
        // The portal sits in the viewport, which ignores the pointer; the box
        // itself must too, so only the card it hosts catches events.
        className="pointer-events-none absolute"
        style={{
          left: x,
          top: y,
          width: node.measured.width ?? 0,
          height: node.measured.height ?? 0,
          zIndex: OVERLAY_Z_INDEX,
        }}
      >
        {children}
      </div>
    </ViewportPortal>
  );
}
