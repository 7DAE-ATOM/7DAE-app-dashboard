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
import { useDataObjectColors } from "@/lib/discoverDataObjectLegend";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

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
  /** What flows along this arrow — the data objects of the interface it
   * targets, or the union of the folded ones in the simplified view. Built by
   * `DiscoverGraph`'s `edges` memo, deduplicated and sorted by name. */
  dataObjects: { id: string; name: string }[];
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
/** Data-object dots. Radius and spacing are in **graph** pixels, not divided
 * by the zoom: unlike the curvature handle, these are part of the diagram and
 * must scale with it — which is also what makes them come out right in the
 * PNG/SVG export. */
const DOT_RADIUS = 5;
const DOT_SPACING = 13;
/** Past this, a row of dots stops being readable and spills over the
 * neighbouring nodes; the rest is announced by a "+N" marker rather than
 * silently dropped. */
const MAX_DOTS = 6;
/** The dots stay inside this slice of the curve, so they never ride up onto a
 * node or under the arrow head. On a short arrow they close up instead of
 * overflowing. */
const DOT_SPAN = 0.6;
/** How fast a data object travels when the flows are animated, in graph
 * pixels per second. A **speed**, not a duration: a fixed duration per trip
 * would make long links race and short ones crawl, which would read as a
 * difference in throughput that does not exist. Fixed here on purpose —
 * deliberately not exposed to the user. */
const FLOW_SPEED = 70;
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
  const { edgeCurvature, animateFlows } = useDiscoverDisplaySettings();
  // The system preference wins over the toolbar switch, and it restores the
  // still rendering rather than freezing the dots wherever the keyframes
  // start — see `lib/usePrefersReducedMotion.ts`.
  const reducedMotion = usePrefersReducedMotion();
  const animated = animateFlows && !reducedMotion;
  const override = useEdgeCurvature(id);
  // `null` as long as the legend is off — then this edge renders exactly what
  // it rendered before the feature existed.
  const dataObjectColors = useDataObjectColors();
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

  /** Point of the quadratic bezier at `t` — the same curve the path draws, so
   * a dot sits on the line whatever the curvature, global or manual. */
  function pointAt(t: number): { x: number; y: number } {
    const u = 1 - t;
    return {
      x: u * u * d.sx + 2 * u * t * cx + t * t * d.tx,
      y: u * u * d.sy + 2 * u * t * cy + t * t * d.ty,
    };
  }

  /** The coloured dots to draw, already placed. Data objects the loaded
   * hierarchy doesn't know are dropped first: no dot without a legend entry
   * to read it by. */
  const dots = (() => {
    if (!dataObjectColors) return [];
    const carried = d.dataObjects.filter((o) => dataObjectColors.has(o.id));
    if (carried.length === 0) return [];

    const shown = carried.slice(0, MAX_DOTS);
    const hidden = carried.slice(MAX_DOTS);
    const slots = shown.length + (hidden.length > 0 ? 1 : 0);
    // Constant spacing in graph pixels, then squeezed so the whole row stays
    // within its slice of a short arrow rather than spilling past its ends.
    const step =
      slots > 1 ? Math.min(DOT_SPACING / len, DOT_SPAN / (slots - 1)) : 0;
    const first = 0.5 - (step * (slots - 1)) / 2;

    // Animated, the row of dots becomes a train: a **negative** delay starts
    // each one mid-cycle instead of making it queue up, and a constant delay
    // between them reproduces in motion the regular spacing they have at
    // rest.
    const gap = DOT_SPACING / FLOW_SPEED;

    const placed = shown.map((o, i) => ({
      key: o.id,
      ...pointAt(first + step * i),
      delay: -i * gap,
      fill: dataObjectColors.get(o.id)!,
      title: o.name,
      label: null as string | null,
    }));
    if (hidden.length > 0) {
      placed.push({
        key: "overflow",
        ...pointAt(first + step * shown.length),
        delay: -shown.length * gap,
        fill: "var(--color-muted)",
        title: hidden.map((o) => o.name).join(", "),
        label: `+${hidden.length}`,
      });
    }
    return placed;
  })();

  /** One trip, at the same speed on every flow. The chord stands in for the
   * arc length: at the curvatures actually used the two differ by a few
   * percent, which no eye reads as a speed difference. */
  const flowDuration = Math.max(0.5, len / FLOW_SPEED);

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
      {/* What flows along this arrow. Drawn inside the edge's own group, so
          the highlight's `.rf-dim` dims them with it and the image export
          captures them without knowing they exist.

          They answer the hover like the path underneath does: without it,
          moving onto a dot would read as leaving the line and would make the
          curvature handle — which sits at the very same midpoint — fade away
          under the pointer. The handle stays the last sibling, so it keeps
          winning hit-testing where they overlap. */}
      {dots.map((dot) => (
        <g
          key={dot.key}
          onPointerEnter={show}
          onPointerLeave={scheduleHide}
          pointerEvents="all"
          // Animated, the dot rides the very path the edge draws, from the
          // arrow head back to the application — the arrow states a
          // dependency, the movement states the transport. The group sits at
          // the origin and `offset-path` places it; changing that path while
          // a node is dragged never restarts the animation, which is why this
          // is CSS rather than SMIL.
          className={animated ? "discover-flow-dot" : undefined}
          style={
            animated
              ? ({
                  offsetPath: `path("${path}")`,
                  "--flow-duration": `${flowDuration}s`,
                  "--flow-delay": `${dot.delay}s`,
                } as React.CSSProperties)
              : undefined
          }
        >
          <circle
            cx={animated ? 0 : dot.x}
            cy={animated ? 0 : dot.y}
            r={DOT_RADIUS}
            fill={dot.fill}
            stroke="var(--color-bg)"
            strokeWidth={1.5}
          >
            <title>{dot.title}</title>
          </circle>
          {dot.label && (
            <text
              x={animated ? 0 : dot.x}
              y={animated ? 0 : dot.y}
              textAnchor="middle"
              dominantBaseline="central"
              pointerEvents="none"
              fill="var(--color-bg)"
              style={{ fontSize: 6, fontWeight: 700 }}
            >
              {dot.label}
            </text>
          )}
        </g>
      ))}
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
