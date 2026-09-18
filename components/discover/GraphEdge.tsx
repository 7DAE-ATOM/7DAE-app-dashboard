"use client";

import { useEffect, useRef, useState } from "react";
import {
  BaseEdge,
  useReactFlow,
  useViewport,
  type EdgeProps,
} from "@xyflow/react";
import {
  EDGE_CURVATURE_NEUTRAL,
  useDiscoverDisplaySettings,
} from "@/lib/discoverDisplaySettings";
import {
  setEdgeCurvature,
  useEdgeCurvature,
} from "@/lib/discoverEdgeCurvature";

export type GraphEdgeData = {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  /** Alternates +1/-1 across parallel edges between overlapping node pairs
   * so their curves separate instead of overlapping. */
  bend: number;
  /** True when another edge joins the same two nodes. Kept apart from `bend`
   * on purpose: which way an edge bows and whether it has a twin are two
   * different facts, and only the second one justifies a minimum gap. */
  parallel: boolean;
};

/** The historical curvature: the control point sits this fraction of the
 * segment's length away from it. */
const BASE_RATIO = 0.16;
/** Cap, in graph pixels. Without it the offset grows with the distance, and a
 * link crossing the canvas leaves in a wide arc over the other nodes. */
const MAX_CURVE = 60;
/** Even at 0% curvature, two edges between the same pair must read as two
 * lines rather than one. */
const MIN_GAP = 6;
/** Hit area of the invisible hover path, in graph pixels. */
const HOVER_WIDTH = 20;
/** Grace period before the handle goes away, so the pointer can travel from
 * the (thin) line to the handle without losing it. */
const HIDE_DELAY_MS = 250;

/** Quadratic-bezier edge with a control point offset along the segment's
 * normal — same curvature technique as `/depgraph`'s `RadialEdge`.
 *
 * The amplitude is capped, then scaled by the user's global curvature setting,
 * unless this particular edge carries a manual override (see
 * `lib/discoverEdgeCurvature.ts`), which then wins outright.
 *
 * The global setting is read here rather than threaded through the edge data
 * so that moving the slider re-renders the edges alone — node positions and the
 * whole `edges` memo in `DiscoverGraph` stay untouched. */
export default function GraphEdge({ id, data, markerEnd, style }: EdgeProps) {
  const { edgeCurvature } = useDiscoverDisplaySettings();
  const override = useEdgeCurvature(id);
  const { screenToFlowPosition } = useReactFlow();
  const { zoom } = useViewport();

  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartValue = useRef<number | null>(null);

  const d = data as unknown as GraphEdgeData;
  const mx = (d.sx + d.tx) / 2;
  const my = (d.sy + d.ty) / 2;
  const dx = d.tx - d.sx;
  const dy = d.ty - d.sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  let offset: number;
  if (override !== null) {
    offset = override;
  } else {
    const capped = Math.min(len * BASE_RATIO, MAX_CURVE);
    const scaled = capped * (edgeCurvature / EDGE_CURVATURE_NEUTRAL);
    offset = (d.parallel ? Math.max(scaled, MIN_GAP) : scaled) * d.bend;
  }

  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  const path = `M ${d.sx} ${d.sy} Q ${cx} ${cy} ${d.tx} ${d.ty}`;

  // Midpoint of the *curve*, not of the chord: for a quadratic bezier,
  // B(0.5) = (P0 + 2C + P2) / 4, which sits half the control offset away from
  // the chord. Anchoring the handle anywhere else leaves it floating beside the
  // line on strongly bowed edges.
  const handleX = mx + nx * (offset / 2);
  const handleY = my + ny * (offset / 2);

  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setHovered(true);
  }

  function scheduleHide() {
    if (dragging) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHovered(false), HIDE_DELAY_MS);
  }

  useEffect(() => () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  // Escape cancels the gesture and restores the value the edge had before it.
  useEffect(() => {
    if (!dragging) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setEdgeCurvature(id, dragStartValue.current);
      setDragging(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dragging, id]);

  function onPointerDown(e: React.PointerEvent<SVGCircleElement>) {
    // Without this the canvas pans under the gesture.
    e.stopPropagation();
    e.preventDefault();
    dragStartValue.current = override;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<SVGCircleElement>) {
    if (!dragging) return;
    e.stopPropagation();
    const p = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // ×2 mirrors the ½ above: the handle rides the curve, the value drives the
    // control point. Without it the curve would trail the pointer by half.
    const next = 2 * ((p.x - mx) * nx + (p.y - my) * ny);
    setEdgeCurvature(id, next);
  }

  function endDrag(e: React.PointerEvent<SVGCircleElement>) {
    if (!dragging) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    scheduleHide();
  }

  return (
    <>
      <BaseEdge path={path} markerEnd={markerEnd} style={style} />
      {/* Hover target: wide, invisible, and drawn on the same geometry. Own
          path rather than BaseEdge's built-in interaction one, whose event
          plumbing is an implementation detail of the library. */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={HOVER_WIDTH}
        pointerEvents="stroke"
        onPointerEnter={show}
        onPointerLeave={scheduleHide}
      />
      {(hovered || dragging) && (
        // Drawn in the edge's own SVG group, right after the hover path, and
        // not through `EdgeLabelRenderer`: that renderer's container is painted
        // *below* the edges layer, so the 20px-wide hover path above would
        // swallow every click on the handle. Last sibling here means it wins
        // hit-testing.
        //
        // Radii and widths are divided by the zoom so the handle keeps the same
        // size on screen at any zoom level — it is a control, not part of the
        // diagram.
        <circle
          className="nodrag nopan"
          cx={handleX}
          cy={handleY}
          r={6 / zoom}
          fill="var(--color-accent)"
          stroke="var(--color-bg)"
          strokeWidth={2 / zoom}
          pointerEvents="all"
          style={{ cursor: dragging ? "grabbing" : "grab" }}
          onPointerEnter={show}
          onPointerLeave={scheduleHide}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEdgeCurvature(id, null);
          }}
        >
          <title>Drag to bend · double-click to reset</title>
        </circle>
      )}
    </>
  );
}
