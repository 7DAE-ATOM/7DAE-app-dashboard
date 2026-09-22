import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";

const elk = new ELK();

/** Default footprint of an Application rectangle. The width is only the
 * fallback: it is normally driven by the Box width slider
 * (`lib/discoverDisplaySettings.ts`, which mirrors this value as
 * `BOX_WIDTH_DEFAULT`) and can be overridden per node by the resize handles
 * (`ApplicationNode.tsx`, `DiscoverGraph`'s `handleResizeApplication`). The
 * height never changes. */
export const APP_NODE_WIDTH = 200;
/** Tall enough for the three rows a card can show at once — name (20px line
 * box), External ID and manager (16px each) — plus its `py-2` padding and its
 * border: 52 + 16 + 4. At 60 the last row overflowed the rectangle, which was
 * survivable on screen and plainly wrong in an exported image. */
export const APP_NODE_HEIGHT = 72;
export const INTERFACE_NODE_SIZE = 20;
/** Floor under which a rectangle can't be shrunk, even with no interface
 * circles attached — keeps the labels usable. */
export const MIN_APP_NODE_WIDTH = 120;

/** The one-time initial layout of a set of root Application rectangles.
 *
 * Without `edges` (roots added one by one, no known relation between them)
 * there is nothing for a hub-and-spoke "radial" layout to be radial about,
 * so it just packs them without overlap (`elk.algorithm: "box"`). With
 * `edges` — the catalogue-seeded graph, where the relations internal to the
 * selection are known upfront — a layered left-to-right flow reads the
 * consumer → provider direction far better than a blind packing.
 *
 * Edges are expressed **between applications** (consumer → provider): the
 * interface circles are xyflow children of their provider, positioned
 * afterward by `interfaceSlotPosition`, so they never take part in ELK.
 *
 * Everything added after this one pass (interfaces, revealed
 * providers/consumers) is positioned locally, never through ELK. */
export async function layoutRootApplications(
  ids: string[],
  edges: { id: string; source: string; target: string }[] = [],
  width: number = APP_NODE_WIDTH,
): Promise<Map<string, { x: number; y: number }>> {
  const graph: ElkNode = {
    id: "root",
    children: ids.map((id) => ({ id, width, height: APP_NODE_HEIGHT })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };
  const result = await elk.layout(graph, {
    layoutOptions:
      edges.length > 0
        ? {
            "elk.algorithm": "layered",
            "elk.direction": "RIGHT",
            "elk.spacing.nodeNode": "60",
            "elk.layered.spacing.nodeNodeBetweenLayers": "120",
          }
        : { "elk.algorithm": "box", "elk.spacing.nodeNode": "60" },
  });
  const positions = new Map<string, { x: number; y: number }>();
  for (const child of result.children ?? []) {
    if (typeof child.x === "number" && typeof child.y === "number") {
      positions.set(child.id, { x: child.x, y: child.y });
    }
  }
  return positions;
}

/** Fixed horizontal gap between two interface slots along a provider's top
 * border (independent of how many slots end up used — no density cap in
 * this first version, decision: many interfaces just crowd/overlap). */
const INTERFACE_SLOT_STEP = INTERFACE_NODE_SIZE + 12;

/** Every interface circle's relative y at its initial reveal — the
 * provider's top border. Nothing pins it there afterward: the user can then
 * drag it anywhere along the full perimeter (see
 * `projectPointToRectanglePerimeter`). */
export const INTERFACE_Y = -INTERFACE_NODE_SIZE / 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Nearest point to `p` lying exactly on the outline of the `w x h`
 * rectangle spanning `[0, w] x [0, h]` (its 4 edges, corners included) —
 * never a point strictly inside or outside it.
 *
 * Used in `DiscoverGraph`'s `onNodesChange` to let a dragged interface
 * circle slide freely around its provider's whole outline instead of being
 * locked to one side: whatever raw position a drag frame produces, snapping
 * its center back onto the outline every frame makes the circle glide along
 * the border in the direction the pointer moves, including around corners
 * from one side to the next.
 *
 * Two cases:
 * - `p` outside the rectangle: the closest point of the *solid* rectangle
 *   (clamping each axis independently) is already exactly on its outline —
 *   no need to test individual edges.
 * - `p` inside: clamping would return `p` itself, so instead measure the
 *   distance to each of the 4 edges and snap to the nearest one. */
export function projectPointToRectanglePerimeter(
  p: { x: number; y: number },
  w: number,
  h: number,
): { x: number; y: number } {
  const outside = p.x < 0 || p.x > w || p.y < 0 || p.y > h;
  if (outside) {
    return { x: clamp(p.x, 0, w), y: clamp(p.y, 0, h) };
  }
  const candidates = [
    { d: p.y, point: { x: p.x, y: 0 } }, // top edge
    { d: h - p.y, point: { x: p.x, y: h } }, // bottom edge
    { d: p.x, point: { x: 0, y: p.y } }, // left edge
    { d: w - p.x, point: { x: w, y: p.y } }, // right edge
  ];
  return candidates.reduce((best, c) => (c.d < best.d ? c : best)).point;
}

/** Position (relative to the provider's top-left corner) of interface
 * "slot" `slot` on a provider whose current width is `width` — a fixed,
 * stable index, not a recomputed `i / count` fraction. This is what lets
 * already-visible interfaces keep their exact place when siblings are added
 * or removed: each interface keeps whichever slot it was assigned (tracked
 * by the caller, `DiscoverGraph`'s `interfaceSlotRef`) for as long as it
 * stays visible, instead of every interface being repositioned whenever the
 * provider's visible count changes. Slot 0 sits centered on the top border;
 * further slots extend outward left/right of it. Purely the initial
 * placement — once revealed, the user can drag a circle anywhere along the
 * whole perimeter (see `projectPointToRectanglePerimeter`), independently of
 * its slot. `width` must be the provider's *current* (possibly resized)
 * width so a newly revealed interface centers on it correctly. */
export function interfaceSlotPosition(slot: number, width: number): { x: number; y: number } {
  const centerX = width / 2;
  // 0, 1, -1, 2, -2, ... so new slots alternate sides around the center
  // instead of drifting off in one direction only.
  const offsetIndex = Math.ceil(slot / 2) * (slot % 2 === 0 ? -1 : 1);
  return {
    x: centerX + offsetIndex * INTERFACE_SLOT_STEP - INTERFACE_NODE_SIZE / 2,
    y: INTERFACE_Y,
  };
}

function rectsOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  gap = 20,
): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

/** Positions a newly revealed Application rectangle near the node that
 * caused its reveal (an interface circle, or another application), nudging
 * downward on overlap with any already-placed node — never touches ELK, so
 * existing positions (including manual drags) are never disturbed. */
export function placeNewApplicationNode(
  anchor: { x: number; y: number },
  direction: "left" | "right",
  existing: { x: number; y: number; width: number; height: number }[],
  width: number = APP_NODE_WIDTH,
): { x: number; y: number } {
  const dx = direction === "right" ? width + 80 : -(width + 80);
  let candidate = { x: anchor.x + dx, y: anchor.y };
  const box = () => ({ ...candidate, width, height: APP_NODE_HEIGHT });
  let guard = 0;
  while (existing.some((n) => rectsOverlap(box(), n)) && guard < 50) {
    candidate = { ...candidate, y: candidate.y + APP_NODE_HEIGHT + 30 };
    guard += 1;
  }
  return candidate;
}
