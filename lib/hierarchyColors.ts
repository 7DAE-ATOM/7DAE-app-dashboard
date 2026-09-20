import type { HierarchyTree } from "./types";
import type { Theme } from "./useTheme";

/**
 * The colour code behind Discover's legends: one colour per node of a
 * hierarchy, the same one wherever that node shows up.
 *
 * Written for the data objects — the dots on the flows and their legend in the
 * filter tree — and generalised when the Business Capabilities axis needed the
 * very same rule for its pie slices. Nothing here is specific to either: it is
 * "one hue per tree, one lightness per depth", and it lives in a module that
 * knows nothing of React or of the DOM so both sides can agree on it.
 *
 * "Random" means *no meaning*, not *different every time*: a colour is derived
 * from the node's place in the hierarchy and is therefore stable from one
 * render to the next, from one session to the next, and between the tree and
 * the diagram. A real draw would be reshuffled every time a node lands on the
 * canvas — the legend would change under the user's eyes at the first
 * neighbourhood expansion, and two exports of the same diagram would no longer
 * be comparable.
 */

/** FNV-1a, 32-bit. Small, dependency-free, and well spread over short strings
 * — which is all that is asked of it here: a stable number per id. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Lightness band per theme. A colour readable on the dark background is washed
 * out on the light one, and the dots sit directly on that background.
 *
 * `base` is the root's lightness and `step` what each level down adds — dark
 * parent, light leaf, as asked. `max` is what keeps a deep branch from
 * dissolving into the page.
 */
const BANDS: Record<Theme, { saturation: number; base: number; step: number; max: number }> = {
  dark: { saturation: 66, base: 46, step: 9, max: 78 },
  light: { saturation: 64, base: 32, step: 8, max: 62 },
};

/**
 * One hue per tree, picked from a fixed wheel rather than hashed.
 *
 * Hashing the root's id was the first rule, and it failed on the very first
 * real diagram: two hashes can land a few degrees apart, and two top-level
 * data objects came out in the same green. A hash spreads *evenly on average*,
 * which says nothing about the handful of values actually drawn side by side.
 *
 * These twelve are ordered so that **consecutive** entries are far apart on
 * the wheel: the first trees added are the ones that must be told apart at a
 * glance, and they are the ones that get the widest separation.
 */
const HUE_WHEEL = [
  212, // blue
  28, // orange
  145, // green
  305, // magenta
  50, // amber
  190, // cyan
  266, // violet
  100, // lime
  340, // pink
  168, // teal
  8, // red
  230, // indigo
];

/** Past a full lap of the wheel, hues repeat; this nudges each lap so the
 * thirteenth tree isn't the exact colour of the first. */
const LAP_SHIFT = 11;

/** How far a node may drift from its root's hue, in degrees either way. Wide
 * enough to separate a few siblings, narrow enough that a whole subtree still
 * reads as one colour. */
const HUE_SPREAD = 8;
/** Same idea on the lightness axis, inside the node's own depth band. */
const LIGHTNESS_SPREAD = 4;

/**
 * A colour per node of the hierarchy: hue from the tree it belongs to,
 * lightness from its depth.
 *
 * Every node gets one, including the ones nothing carries — filtering is the
 * caller's business: the legend only shows dots for what a visible interface
 * carries, and an edge only draws what it transports.
 *
 * `wheelStart` is where this axis enters the wheel. The two axes are drawn on
 * the same canvas at the same time — dots on the flows, pie slices in the
 * rectangles — and nothing should suggest that a capability and a data object
 * of the same colour have anything to do with each other. Half a wheel apart
 * keeps the first trees of each axis, the ones actually seen, well clear of
 * one another.
 *
 * The hue comes from the root's **rank** among the roots, which
 * `buildHierarchyTree` sorts by name — so it is stable for a given hierarchy,
 * and only shifts if a top-level data object appears or disappears in LeanIX.
 * That is the price of telling the trees apart, and it is worth paying: a
 * hashed hue is stable but can put two neighbours in the same green.
 */
export function buildHierarchyColors(
  tree: HierarchyTree | null,
  theme: Theme,
  wheelStart = 0,
): Map<string, string> {
  const colors = new Map<string, string>();
  if (!tree) return colors;
  const band = BANDS[theme];

  tree.roots.forEach((root, index) => {
    const rank = index + wheelStart;
    const lap = Math.floor(rank / HUE_WHEEL.length);
    const rootHue = (HUE_WHEEL[rank % HUE_WHEEL.length] + lap * LAP_SHIFT) % 360;
    // Iterative walk: the crawl can nest deeply and a recursion here would be
    // the only place in this axis at risk of blowing the stack.
    const stack: { id: string; depth: number }[] = [{ id: root.id, depth: 0 }];
    while (stack.length) {
      const { id, depth } = stack.pop()!;
      const node = tree.byId.get(id);
      if (!node || colors.has(id)) continue;

      const own = hash(id);
      // Two independent slices of the same hash, so a node's hue offset and
      // its lightness offset don't move together.
      const hueOffset = (own % (HUE_SPREAD * 2 + 1)) - HUE_SPREAD;
      const lightOffset = ((own >>> 8) % (LIGHTNESS_SPREAD * 2 + 1)) - LIGHTNESS_SPREAD;

      const hue = (rootHue + hueOffset + 360) % 360;
      const lightness = Math.min(band.max, band.base + depth * band.step + lightOffset);
      colors.set(id, `hsl(${hue} ${band.saturation}% ${Math.round(lightness)}%)`);

      for (const child of node.children) stack.push({ id: child.id, depth: depth + 1 });
    }
  });

  return colors;
}
