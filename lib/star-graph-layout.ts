/**
 * Polar layout for the star graph: one hub in the middle, neighbours spread
 * over one or two concentric rings. Pure geometry, no JSX and no DOM — the
 * numbers can be checked without mounting React.
 *
 * Every size below is in viewBox units; the rendered SVG scales the whole
 * thing to its container, so these are relative, not CSS pixels.
 *
 * Rings are ELLIPSES, wider than tall. Nodes are boxes — wide and short — and
 * two axis-aligned boxes clear each other as soon as `|dx| >= W+gap` OR
 * `|dy| >= H+gap`. Near the top and bottom of a ring, neighbours are separated
 * almost entirely in x, the expensive direction for a wide box; on the flanks
 * they are separated in y, which is cheap. Stretching the ring in x buys
 * clearance exactly where it is needed and costs nothing elsewhere — a circle
 * would have to be far larger to satisfy the same constraint.
 */

export type StarEdgeDirection = "in" | "out" | "both" | "none";

export type StarNodeInput = {
  id: string;
  /** Full name. Truncated for display; the caller shows the original in a <title>. */
  label: string;
  /** Short code drawn under the name (an externalId, typically 4 chars). */
  sublabel?: string;
};

export type StarNeighborInput = StarNodeInput & {
  direction: StarEdgeDirection;
};

export type PlacedBox = {
  /** Box centre. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Truncated label actually drawn. */
  display: string;
};

export type PlacedNeighbor = StarNeighborInput &
  PlacedBox & {
    /** Edge trimmed to both box boundaries so the arrowheads stay visible. */
    edge: { x1: number; y1: number; x2: number; y2: number };
  };

export type StarLayout = {
  viewBox: string;
  fonts: { name: number; code: number; centerName: number; centerCode: number };
  center: PlacedBox;
  neighbors: PlacedNeighbor[];
};

/** Mean advance width as a fraction of the font size. */
const SANS_RATIO = 0.52;
const MONO_RATIO = 0.6;

const CENTER = {
  nameFont: 14,
  codeFont: 10,
  height: 46,
  padX: 14,
  minWidth: 110,
  maxWidth: 260,
};

/**
 * Two presets. The dense one shrinks both box and type so ~30 nodes still fit;
 * the roomy one spends the available space on legibility.
 */
const PRESETS = {
  /** n <= 12 — a single ring. */
  roomy: {
    nameFont: 12,
    codeFont: 9,
    height: 34,
    padX: 10,
    minWidth: 76,
    maxWidth: 130,
    rings: [{ rx: 290, ry: 140 }],
    innerCapacity: 12,
  },
  /** n > 12 — two rings. */
  dense: {
    nameFont: 11,
    codeFont: 9,
    height: 32,
    padX: 8,
    minWidth: 64,
    maxWidth: 96,
    rings: [
      { rx: 220, ry: 125 },
      { rx: 395, ry: 175 },
    ],
    innerCapacity: 12,
  },
} as const;

const ARROW_CLEARANCE = 3;
const PADDING = 16;
/** Above this many neighbours the single ring is split into two. */
export const SINGLE_RING_MAX = 12;

function textWidth(text: string, fontSize: number, ratio: number): number {
  return text.length * fontSize * ratio;
}

function truncateToWidth(text: string, usable: number, fontSize: number): string {
  const max = Math.max(1, Math.floor(usable / (fontSize * SANS_RATIO)));
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Box width follows the text — a short name gets a small box — but is clamped
 * so collision clearances can assume the worst case (`maxWidth`) and stay
 * valid whatever the data.
 */
function boxWidth(
  display: string,
  sublabel: string | undefined,
  p: {
    nameFont: number;
    codeFont: number;
    padX: number;
    minWidth: number;
    maxWidth: number;
  },
): number {
  const content = Math.max(
    textWidth(display, p.nameFont, SANS_RATIO),
    sublabel ? textWidth(sublabel, p.codeFont, MONO_RATIO) : 0,
  );
  return Math.min(p.maxWidth, Math.max(p.minWidth, Math.round(content + 2 * p.padX)));
}

/**
 * Splits `n` between the two rings. Taken literally, the spec rule "first 12
 * inside, the rest outside" leaves a single lonely node on the outer ring at
 * n=13, which reads as a rendering bug; a ratio keeps both rings populated,
 * and the inner ring still caps at its own capacity so n=30 lands on 12 + 18.
 */
function innerCount(n: number, capacity: number): number {
  return Math.min(capacity, Math.ceil(n * 0.4));
}

/** Where a ray in direction (dx, dy) leaves a box centred on the origin. */
function boxExit(dx: number, dy: number, halfW: number, halfH: number): number {
  const byWidth = Math.abs(dx) < 1e-6 ? Infinity : halfW / Math.abs(dx);
  const byHeight = Math.abs(dy) < 1e-6 ? Infinity : halfH / Math.abs(dy);
  return Math.min(byWidth, byHeight);
}

/**
 * Places the hub at the origin, positions every neighbour, then shifts
 * everything into a viewBox sized to the real content bounding box — which is
 * what keeps n=1 or n=2 from rendering as a lone node lost in a large square.
 */
export function layoutStar(
  center: StarNodeInput,
  neighbors: StarNeighborInput[],
): StarLayout {
  const n = neighbors.length;
  const p = n > SINGLE_RING_MAX ? PRESETS.dense : PRESETS.roomy;
  const nInner = n > SINGLE_RING_MAX ? innerCount(n, p.innerCapacity) : n;
  const nOuter = n - nInner;

  const centerDisplay = truncateToWidth(
    center.label,
    CENTER.maxWidth - 2 * CENTER.padX,
    CENTER.nameFont,
  );
  const centerW = boxWidth(centerDisplay, center.sublabel, CENTER);

  const placed = neighbors.map((neighbor, i) => {
    const onInner = i < nInner;
    const ring = onInner ? p.rings[0] : (p.rings[1] ?? p.rings[0]);
    const count = onInner ? nInner : nOuter;
    const index = onInner ? i : i - nInner;
    // First node straight up, then clockwise: SVG's y axis points down, so
    // -PI/2 is up and a growing angle turns clockwise on screen.
    // With one or two neighbours, "first node at top" degenerates into a tall
    // narrow column that reads badly in a wide panel — those spread sideways.
    // The outer ring is offset by half a step so no node sits exactly at the
    // top, where two boxes have the least vertical separation.
    const startAngle = n <= 2 ? 0 : -Math.PI / 2;
    const offset = onInner ? 0 : Math.PI / Math.max(nOuter, 1);
    const theta = startAngle + (index * 2 * Math.PI) / count + offset;
    const x = ring.rx * Math.cos(theta);
    const y = ring.ry * Math.sin(theta);

    const display = truncateToWidth(neighbor.label, p.maxWidth - 2 * p.padX, p.nameFont);
    const width = boxWidth(display, neighbor.sublabel, p);

    // Trim the edge to both box boundaries, otherwise the arrowhead ends up
    // hidden under a box. A constant radial inset will not do: for a wide,
    // short box the true inset is several times larger sideways than
    // vertically, which would leave vertical arrows floating in space.
    const length = Math.hypot(x, y);
    const ux = x / length;
    const uy = y / length;
    const fromHub = boxExit(ux, uy, centerW / 2, CENTER.height / 2) + ARROW_CLEARANCE;
    const toNode = boxExit(ux, uy, width / 2, p.height / 2) + ARROW_CLEARANCE;

    return {
      ...neighbor,
      x,
      y,
      width,
      height: p.height as number,
      display,
      edge: {
        x1: fromHub * ux,
        y1: fromHub * uy,
        x2: x - toNode * ux,
        y2: y - toNode * uy,
      },
    };
  });

  let minX = -centerW / 2;
  let maxX = centerW / 2;
  let minY = -CENTER.height / 2;
  let maxY = CENTER.height / 2;

  for (const b of placed) {
    minX = Math.min(minX, b.x - b.width / 2);
    maxX = Math.max(maxX, b.x + b.width / 2);
    minY = Math.min(minY, b.y - b.height / 2);
    maxY = Math.max(maxY, b.y + b.height / 2);
  }

  const originX = minX - PADDING;
  const originY = minY - PADDING;

  const shift = <T extends PlacedNeighbor>(b: T): T => ({
    ...b,
    x: b.x - originX,
    y: b.y - originY,
    edge: {
      x1: b.edge.x1 - originX,
      y1: b.edge.y1 - originY,
      x2: b.edge.x2 - originX,
      y2: b.edge.y2 - originY,
    },
  });

  return {
    viewBox: `0 0 ${round(maxX - minX + PADDING * 2)} ${round(maxY - minY + PADDING * 2)}`,
    fonts: {
      name: p.nameFont,
      code: p.codeFont,
      centerName: CENTER.nameFont,
      centerCode: CENTER.codeFont,
    },
    center: {
      x: -originX,
      y: -originY,
      width: centerW,
      height: CENTER.height,
      display: centerDisplay,
    },
    neighbors: placed.map(shift),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
