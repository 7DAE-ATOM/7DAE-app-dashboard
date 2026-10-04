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

/** Fixed horizontal gap between two interface slots along a provider's top
 * border (independent of how many slots end up used — no density cap in
 * this first version, decision: many interfaces just crowd/overlap). Also
 * the minimum spacing `orientInterfaceCircles` keeps between two circles
 * along a border. */
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
 * further slots extend outward left/right of it. Purely the default
 * placement — `orientInterfaceCircles` then turns a circle toward its
 * consumers, and the user can drag it anywhere along the whole perimeter
 * (see `projectPointToRectanglePerimeter`). `width` must be the provider's
 * *current* (possibly resized) width so a newly revealed interface centers
 * on it correctly. */
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

// ---------------------------------------------------------------------------
// Unified radial placement
// ---------------------------------------------------------------------------
//
// One strategy for every way an application lands on the canvas — the
// catalogue seed ("Show in Discover"), the context-menu reveals and the
// search box. Placing one application is the n = 1 case of placing n; the
// seed is the "nothing fixed yet" case. See
// `_specification/vibe coding/placement-unifie-radial-applications-discover.md`.

type Point = { x: number; y: number };
type Box = { x: number; y: number; width: number; height: number };

/** An application already on the canvas — an obstacle that never moves. */
export type PlacedBox = Box & { id: string };

/** Minimum clear space kept between two application rectangles. Also covers
 * the half-circle an interface protrudes past its provider's border. */
const BOX_GAP = 40;
/** Opening of the fan a node that already has placed neighbours receives,
 * centred on the direction away from them. 240° per the spec; to be
 * confirmed in use. */
const FAN_SPAN = (240 * Math.PI) / 180;
/** Horizontal distances count for less than vertical ones when looking for
 * free space: screens are wide, so a diagram should grow sideways first. */
const LANDSCAPE_BIAS = 1.6;
/** Tried in this order, as fractions of the spacing between two slots, to
 * dodge whatever already occupies part of a ring. 0 first, so an unobstructed
 * ring is always laid out the same way. */
const RING_ROTATIONS = [0, 0.125, -0.125, 0.25, -0.25, 0.375, -0.375, 0.5];
/** Safety nets: no realistic graph comes near them. */
const MAX_RINGS = 60;
const MAX_SEARCH_RADIUS = 400;

function overlaps(a: Box, b: Box, gap = BOX_GAP): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

function collides(box: Box, obstacles: Box[]): boolean {
  return obstacles.some((o) => overlaps(box, o));
}

function centreOf(b: Box): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

function boundsOfBoxes(boxes: Box[]): Box {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Ramanujan's approximation — plenty for a capacity estimate. */
function ellipsePerimeter(rx: number, ry: number): number {
  return Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
}

/**
 * Maps a fraction of arc length along an elliptic arc to the parametric
 * angle. Slots are spaced by **arc length**, not by angle: on a flat ellipse,
 * equal angles crowd the boxes at the ends of the long axis.
 */
function arcLengthSampler(rx: number, ry: number, start: number, span: number) {
  const steps = 256;
  const lengths = [0];
  let prev = { x: rx * Math.cos(start), y: ry * Math.sin(start) };
  for (let i = 1; i <= steps; i++) {
    const t = start + (span * i) / steps;
    const p = { x: rx * Math.cos(t), y: ry * Math.sin(t) };
    lengths.push(lengths[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y));
    prev = p;
  }
  const total = lengths[steps];
  return (fraction: number): number => {
    const target = fraction * total;
    let i = 1;
    while (i < steps && lengths[i] < target) i++;
    const segment = lengths[i] - lengths[i - 1] || 1;
    const local = (target - lengths[i - 1]) / segment;
    return start + (span * (i - 1 + local)) / steps;
  };
}

/**
 * Lays `count` boxes of `width x height` around `anchor`, on concentric
 * ellipses: a full ring when `outward` is null, a `FAN_SPAN` fan centred on
 * `outward` otherwise. Each ring holds what its perimeter allows; the ring is
 * rotated to dodge `obstacles`, and whatever still collides moves on to the
 * next, wider ring. Returned in angular (clockwise) order, ring by ring, so
 * the caller's ordering of the group maps onto neighbouring slots.
 */
function placeRadialGroup(
  anchor: Box,
  count: number,
  width: number,
  height: number,
  obstacles: Box[],
  outward: Point | null,
): Box[] {
  const result: Box[] = [];
  const taken = [...obstacles];
  const c = centreOf(anchor);
  const span = outward ? FAN_SPAN : 2 * Math.PI;
  // Ring 0 per the spec: ~1.5 box widths across, ~2.5 box heights down —
  // and never closer than the anchor's own half-size plus a clear gap.
  const rx0 = Math.max(1.5 * width, anchor.width / 2 + width / 2 + 2 * BOX_GAP);
  const ry0 = Math.max(2.5 * height, anchor.height / 2 + height / 2 + 2 * BOX_GAP);

  for (let ring = 0; result.length < count && ring < MAX_RINGS; ring++) {
    const rx = rx0 + ring * (width + 2 * BOX_GAP);
    const ry = ry0 + ring * (height + 2 * BOX_GAP);
    // A full ring starts at the top; a fan is centred on `outward`, measured
    // in the ellipse's own parametric angle so the centre lands on that ray.
    const start = outward
      ? Math.atan2(outward.y / ry, outward.x / rx) - span / 2
      : -Math.PI / 2;
    const angleAt = arcLengthSampler(rx, ry, start, span);
    const slotSpacing = (width + height) / 2 + BOX_GAP;
    const capacity = Math.max(
      1,
      Math.floor((ellipsePerimeter(rx, ry) * (span / (2 * Math.PI))) / slotSpacing),
    );

    const slotsFor = (n: number, rotation: number): Box[] =>
      Array.from({ length: n }, (_, i) => {
        // A ring closes on itself (wrap the fraction); a fan doesn't, so its
        // slots sit in the middle of n equal sectors.
        let f = outward ? (i + 0.5 + rotation) / n : (i + rotation) / n;
        if (!outward) f = ((f % 1) + 1) % 1;
        else f = clamp(f, 0, 1);
        const t = angleAt(f);
        return {
          x: c.x + rx * Math.cos(t) - width / 2,
          y: c.y + ry * Math.sin(t) - height / 2,
          width,
          height,
        };
      });

    // As many as fit on this ring without touching one another…
    let n = Math.min(count - result.length, capacity);
    while (n > 1) {
      const slots = slotsFor(n, 0);
      if (!slots.some((a, i) => slots.some((b, j) => j > i && overlaps(a, b)))) break;
      n -= 1;
    }
    // …then the rotation that leaves the most of them clear of the canvas.
    let best: Box[] = [];
    for (const rotation of RING_ROTATIONS) {
      const free = slotsFor(n, rotation).filter((b) => !collides(b, taken));
      if (free.length > best.length) best = free;
      if (best.length === n) break;
    }
    result.push(...best);
    taken.push(...best);
  }
  return result;
}

/** Nearest spot to `target` (a centre) where a `width x height` box touches
 * nothing — scanned on a half-box lattice, ring by ring, closest first. */
function nearestFreeBox(
  target: Point,
  width: number,
  height: number,
  obstacles: Box[],
): Box {
  const stepX = (width + BOX_GAP) / 2;
  const stepY = (height + BOX_GAP) / 2;
  const at = (i: number, j: number): Box => ({
    x: target.x - width / 2 + i * stepX,
    y: target.y - height / 2 + j * stepY,
    width,
    height,
  });
  for (let r = 0; r <= MAX_SEARCH_RADIUS; r++) {
    const ring: { i: number; j: number; d: number }[] = [];
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        ring.push({ i, j, d: Math.hypot(i * stepX, j * stepY) });
      }
    }
    ring.sort((a, b) => a.d - b.d || a.j - b.j || a.i - b.i);
    for (const { i, j } of ring) {
      const box = at(i, j);
      if (!collides(box, obstacles)) return box;
    }
  }
  return at(0, 0);
}

/**
 * Where a block of `size` goes when it is attached to nothing already on the
 * canvas: at the origin when the canvas is empty, otherwise **beside** what
 * is there, as close to its centre as possible, sideways first
 * (`LANDSCAPE_BIAS`).
 *
 * `clusters` are the bounding boxes of the groups already placed (connected
 * applications). A block may not enter one — a lone application dropped in
 * the gap between a hub and its ring would read as part of it — but it may
 * fill the space between two groups. Candidates sit on a lattice of one box
 * plus gap, aligned to the origin, so lone applications (each its own
 * cluster) line up into a compact grid.
 */
function freeSpotBeside(
  size: { width: number; height: number },
  clusters: Box[],
  cell: { width: number; height: number },
): Point {
  if (clusters.length === 0) return { x: 0, y: 0 };
  const centre = centreOf(boundsOfBoxes(clusters));
  const stepX = cell.width + BOX_GAP;
  const stepY = cell.height + BOX_GAP;
  const baseI = Math.round((centre.x - size.width / 2) / stepX);
  const baseJ = Math.round((centre.y - size.height / 2) / stepY);
  const weighted = (i: number, j: number) => Math.hypot((i * stepX) / LANDSCAPE_BIAS, j * stepY);

  let best: { box: Box; d: number; i: number; j: number } | null = null;
  for (let r = 0; r <= MAX_SEARCH_RADIUS; r++) {
    // Nothing on ring r can beat what was found: the weighted distance of any
    // ring-r candidate is at least this.
    if (best && r * Math.min(stepX / LANDSCAPE_BIAS, stepY) > best.d) break;
    for (let i = -r; i <= r; i++) {
      for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const box = {
          x: (baseI + i) * stepX,
          y: (baseJ + j) * stepY,
          width: size.width,
          height: size.height,
        };
        if (collides(box, clusters)) continue;
        const d = weighted(i, j);
        if (best && (d > best.d || (d === best.d && (j > best.j || (j === best.j && i >= best.i))))) {
          continue;
        }
        best = { box, d, i, j };
      }
    }
  }
  if (best) return { x: best.box.x, y: best.box.y };
  const all = boundsOfBoxes(clusters);
  return { x: all.x + all.width + BOX_GAP, y: all.y };
}

/** Bounding box of each connected group among `placed`. */
function clusterBounds(placed: Map<string, Box>, neighbours: (id: string) => Set<string>): Box[] {
  const seen = new Set<string>();
  const result: Box[] = [];
  for (const id of placed.keys()) {
    if (seen.has(id)) continue;
    const members: Box[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length > 0) {
      const current = stack.pop()!;
      members.push(placed.get(current)!);
      for (const n of neighbours(current)) {
        if (placed.has(n) && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    result.push(boundsOfBoxes(members));
  }
  return result;
}

/**
 * Places applications on a canvas where others may already sit.
 *
 * - `fixed`: the applications already on the canvas. Never moved.
 * - `toPlace`: the ones to position, **in order of preference** — the order
 *   decides ties and which slot of a ring each one takes (the caller groups
 *   them by interface so the links of one interface leave in one sector).
 * - `links`: undirected application ↔ application relations, among both sets.
 *
 * Grows outward from what is placed, in waves: a placed application receives
 * all its unplaced neighbours at once — a full ring if it has no placed
 * neighbour yet, an outward fan otherwise. A neighbour already tied to two
 * placed applications goes near their barycentre instead. What is tied to
 * nothing placed starts a group of its own, laid out the same way around its
 * best-connected member, then set beside the existing content. Deterministic,
 * and no returned box overlaps another or a fixed one.
 */
export function placeApplications(input: {
  fixed: PlacedBox[];
  toPlace: string[];
  links: [string, string][];
  width: number;
  height?: number;
}): Map<string, Point> {
  const width = input.width;
  const height = input.height ?? APP_NODE_HEIGHT;
  const fixedIds = new Set(input.fixed.map((b) => b.id));
  const order = [...new Set(input.toPlace)].filter((id) => !fixedIds.has(id));
  const rank = new Map(order.map((id, i) => [id, i]));
  const known = new Set([...fixedIds, ...order]);

  const adjacency = new Map<string, Set<string>>();
  for (const id of known) adjacency.set(id, new Set());
  for (const [a, b] of input.links) {
    if (a === b || !known.has(a) || !known.has(b)) continue;
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }
  const neighbours = (id: string) => adjacency.get(id) ?? new Set<string>();

  const placed = new Map<string, Box>(input.fixed.map((b) => [b.id, b]));
  const result = new Map<string, Point>();
  const pending = new Set(order);

  /** The waves, from `seeds` outward, within `scope` (the whole canvas, or a
   * group being laid out on its own before it is set in place). */
  const grow = (seeds: string[], scope: Map<string, Box>, todo: Set<string>) => {
    const queue = [...seeds];
    while (queue.length > 0) {
      const anchorId = queue.shift()!;
      const anchor = scope.get(anchorId)!;
      const group = order.filter((id) => todo.has(id) && neighbours(anchorId).has(id));
      if (group.length === 0) continue;

      const placedNeighbourCount = (id: string) =>
        [...neighbours(id)].filter((n) => scope.has(n)).length;
      const ringMembers = group.filter((id) => placedNeighbourCount(id) < 2);
      const bridging = group.filter((id) => placedNeighbourCount(id) >= 2);

      // Away from whatever this anchor is already tied to.
      const c = centreOf(anchor);
      let dx = 0;
      let dy = 0;
      for (const n of neighbours(anchorId)) {
        const box = scope.get(n);
        if (!box) continue;
        const p = centreOf(box);
        const len = Math.hypot(p.x - c.x, p.y - c.y);
        if (len < 1e-6) continue;
        dx += (p.x - c.x) / len;
        dy += (p.y - c.y) / len;
      }
      const hasPlacedNeighbour = [...neighbours(anchorId)].some((n) => scope.has(n));
      const pull = Math.hypot(dx, dy);
      // Neighbours pulling evenly from all sides leave no "outside": a full
      // ring is then the honest answer.
      const outward = hasPlacedNeighbour && pull > 1e-6 ? { x: -dx / pull, y: -dy / pull } : null;

      const boxes = placeRadialGroup(anchor, ringMembers.length, width, height, [...scope.values()], outward);
      ringMembers.forEach((id, i) => {
        scope.set(id, boxes[i]);
        todo.delete(id);
        queue.push(id);
      });
      for (const id of bridging) {
        const centres = [...neighbours(id)]
          .map((n) => scope.get(n))
          .filter((b): b is Box => !!b)
          .map(centreOf);
        const target = {
          x: centres.reduce((s, p) => s + p.x, 0) / centres.length,
          y: centres.reduce((s, p) => s + p.y, 0) / centres.length,
        };
        scope.set(id, nearestFreeBox(target, width, height, [...scope.values()]));
        todo.delete(id);
        queue.push(id);
      }
    }
  };

  const degree = (id: string) => neighbours(id).size;
  const byConnectivity = (a: string, b: string) =>
    degree(b) - degree(a) || (rank.get(a) ?? 0) - (rank.get(b) ?? 0) || a.localeCompare(b);

  // 1. Outward from the canvas.
  const seeds = input.fixed
    .map((b) => b.id)
    .filter((id) => [...neighbours(id)].some((n) => pending.has(n)))
    .sort(byConnectivity);
  grow(seeds, placed, pending);

  // 2. What is tied to nothing placed: its own groups, largest first.
  const groups: string[][] = [];
  const seen = new Set<string>();
  for (const id of order) {
    if (!pending.has(id) || seen.has(id)) continue;
    const members: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length > 0) {
      const current = stack.pop()!;
      members.push(current);
      for (const n of neighbours(current)) {
        if (pending.has(n) && !seen.has(n)) {
          seen.add(n);
          stack.push(n);
        }
      }
    }
    groups.push(members);
  }
  groups.sort(
    (a, b) =>
      b.length - a.length ||
      Math.min(...a.map((id) => rank.get(id)!)) - Math.min(...b.map((id) => rank.get(id)!)),
  );

  for (const members of groups) {
    const start = [...members].sort(byConnectivity)[0];
    const local = new Map<string, Box>([[start, { x: 0, y: 0, width, height }]]);
    const todo = new Set(members.filter((id) => id !== start));
    grow([start], local, todo);

    const boxes = [...local.values()];
    const bounds = boundsOfBoxes(boxes);
    const spot = freeSpotBeside(bounds, clusterBounds(placed, neighbours), { width, height });
    const shiftX = spot.x - bounds.x;
    const shiftY = spot.y - bounds.y;
    for (const [id, box] of local) {
      placed.set(id, { ...box, x: box.x + shiftX, y: box.y + shiftY });
    }
    for (const id of members) pending.delete(id);
  }

  for (const id of order) {
    const box = placed.get(id);
    if (box) result.set(id, { x: box.x, y: box.y });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Interface circles facing their consumers
// ---------------------------------------------------------------------------

/** Where a ray from the centre of a `w x h` rectangle (origin top-left) in
 * direction `d` crosses its border. */
function rayExit(w: number, h: number, d: Point): Point {
  const halfW = w / 2;
  const halfH = h / 2;
  const byWidth = Math.abs(d.x) < 1e-9 ? Infinity : halfW / Math.abs(d.x);
  const byHeight = Math.abs(d.y) < 1e-9 ? Infinity : halfH / Math.abs(d.y);
  const t = Math.min(byWidth, byHeight);
  return { x: halfW + d.x * t, y: halfH + d.y * t };
}

/**
 * Turns interface circles toward their consumers: each circle marked
 * `orient` goes on the border of its provider that faces the mean direction
 * of its consumers, so links leave the box instead of crossing it. Circles
 * not marked (dragged by hand, or without a consumer) stay put and are
 * obstacles: oriented ones keep a circle's spacing from them and from each
 * other along the outline.
 *
 * Positions are relative to the provider's top-left corner, as xyflow child
 * nodes expect — the circle's own top-left, not its centre.
 */
export function orientInterfaceCircles(
  provider: { x: number; y: number; width: number; height: number },
  circles: { id: string; position: Point; consumers: Point[]; orient: boolean }[],
): Map<string, Point> {
  const w = provider.width;
  const h = provider.height;
  const half = INTERFACE_NODE_SIZE / 2;
  const perimeter = 2 * (w + h);
  const centre = { x: provider.x + w / 2, y: provider.y + h / 2 };

  /** Clockwise distance along the outline from the top-left corner. */
  const toS = (p: Point): number => {
    const q = projectPointToRectanglePerimeter(p, w, h);
    if (q.y <= 0 && q.x < w) return q.x;
    if (q.x >= w && q.y < h) return w + q.y;
    if (q.y >= h && q.x > 0) return w + h + (w - q.x);
    return 2 * w + h + (h - q.y);
  };
  const fromS = (s: number): Point => {
    const t = ((s % perimeter) + perimeter) % perimeter;
    if (t < w) return { x: t, y: 0 };
    if (t < w + h) return { x: w, y: t - w };
    if (t < 2 * w + h) return { x: w - (t - w - h), y: h };
    return { x: 0, y: h - (t - 2 * w - h) };
  };
  const distance = (a: number, b: number) => {
    const d = Math.abs(a - b) % perimeter;
    return Math.min(d, perimeter - d);
  };

  const occupied = circles
    .filter((c) => !c.orient || c.consumers.length === 0)
    .map((c) => toS({ x: c.position.x + half, y: c.position.y + half }));

  const wanted = circles
    .filter((c) => c.orient && c.consumers.length > 0)
    .map((c) => {
      let dx = 0;
      let dy = 0;
      for (const p of c.consumers) {
        const len = Math.hypot(p.x - centre.x, p.y - centre.y);
        if (len < 1e-6) continue;
        dx += (p.x - centre.x) / len;
        dy += (p.y - centre.y) / len;
      }
      // Consumers cancelling each other out: face the first one.
      if (Math.hypot(dx, dy) < 1e-6) {
        dx = c.consumers[0].x - centre.x;
        dy = c.consumers[0].y - centre.y;
      }
      if (Math.hypot(dx, dy) < 1e-6) return null;
      return { id: c.id, s: toS(rayExit(w, h, { x: dx, y: dy })) };
    })
    .filter((c): c is { id: string; s: number } => c !== null)
    .sort((a, b) => a.s - b.s || a.id.localeCompare(b.id));

  const result = new Map<string, Point>();
  for (const { id, s } of wanted) {
    let chosen = s;
    // Closest free spot along the outline, alternating sides.
    for (let k = 0; k <= perimeter; k += 2) {
      const candidates = k === 0 ? [s] : [s + k, s - k];
      const free = candidates.find((c) =>
        occupied.every((o) => distance(c, o) >= INTERFACE_SLOT_STEP),
      );
      if (free !== undefined) {
        chosen = free;
        break;
      }
    }
    occupied.push(chosen);
    const p = fromS(chosen);
    result.set(id, { x: p.x - half, y: p.y - half });
  }
  return result;
}
