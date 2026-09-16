"use client";

import { BaseEdge, type EdgeProps } from "@xyflow/react";
import {
  EDGE_CURVATURE_NEUTRAL,
  useDiscoverDisplaySettings,
} from "@/lib/discoverDisplaySettings";

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

/** Quadratic-bezier edge with a control point offset along the segment's
 * normal — same curvature technique as `/depgraph`'s `RadialEdge`, generic
 * enough to reuse verbatim (it knows nothing about applications/interfaces).
 *
 * The amplitude is capped, then scaled by the user's curvature setting. The
 * setting is read here rather than threaded through the edge data so that
 * moving the slider re-renders the edges alone — node positions and the whole
 * `edges` memo in `DiscoverGraph` stay untouched. */
export default function GraphEdge({ data, markerEnd, style }: EdgeProps) {
  const { edgeCurvature } = useDiscoverDisplaySettings();
  const d = data as unknown as GraphEdgeData;
  const mx = (d.sx + d.tx) / 2;
  const my = (d.sy + d.ty) / 2;
  const dx = d.tx - d.sx;
  const dy = d.ty - d.sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const capped = Math.min(len * BASE_RATIO, MAX_CURVE);
  const scaled = capped * (edgeCurvature / EDGE_CURVATURE_NEUTRAL);
  const magnitude = d.parallel ? Math.max(scaled, MIN_GAP) : scaled;
  const offset = magnitude * d.bend;

  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  const path = `M ${d.sx} ${d.sy} Q ${cx} ${cy} ${d.tx} ${d.ty}`;
  return <BaseEdge path={path} markerEnd={markerEnd} style={style} />;
}
