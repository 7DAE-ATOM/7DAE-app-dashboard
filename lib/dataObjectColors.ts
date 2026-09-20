import type { HierarchyTree } from "./types";
import type { Theme } from "./useTheme";

/**
 * The colour code behind Discover's data-object legend: one colour per data
 * object, the same one in the filter tree and on the flows that carry it.
 *
 * Two sides have to agree on it — `DiscoverHighlightPanel` (the legend) and
 * `GraphEdge` (the dots) — so the rule lives here, in a module that knows
 * nothing of React or of the DOM, rather than in either of them.
 *
 * "Random" means *no meaning*, not *different every time*: a colour is derived
 * from the data object's technical id and is therefore stable from one render
 * to the next, from one session to the next, and between the tree and the
 * arrows. A real draw would be reshuffled every time a node lands on the
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
  dark: { saturation: 62, base: 46, step: 9, max: 78 },
  light: { saturation: 58, base: 32, step: 8, max: 62 },
};

/** How far a node may drift from its root's hue, in degrees either way. Wide
 * enough to separate a few siblings, narrow enough that a whole subtree still
 * reads as one colour. */
const HUE_SPREAD = 12;
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
 * The hue comes from a hash of the **root's** id rather than from its index
 * among the roots: an index would shift every other tree's colour the day a
 * new root shows up in the crawl.
 */
export function buildDataObjectColors(
  tree: HierarchyTree | null,
  theme: Theme,
): Map<string, string> {
  const colors = new Map<string, string>();
  if (!tree) return colors;
  const band = BANDS[theme];

  for (const root of tree.roots) {
    const rootHue = hash(root.id) % 360;
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
  }

  return colors;
}
