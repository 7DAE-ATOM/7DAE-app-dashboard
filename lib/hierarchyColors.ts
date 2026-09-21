import type { HierarchyTree, HierarchyTreeNode } from "./types";
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
 * **Eight, evenly spaced**, and that count is the whole design. A first
 * attempt used twelve "named" hues picked by hand, and they were not spread:
 * four of them sat in the green-cyan band, two of them 22 degrees apart. On a
 * real diagram five top-level data objects came out in five greens.
 *
 * Even spacing is what makes the guarantee statable: **any two trees are at
 * least 45 degrees apart**, whichever ones happen to be on screen. That
 * matters because the trees actually displayed are an arbitrary handful out of
 * the whole hierarchy — their ranks are scattered, so a rule that only spreads
 * *consecutive* ranks would protect nothing. The order below spreads those
 * too, by at least 90 degrees.
 *
 * Eight rather than twelve because the eye cannot hold more: past that, "very
 * different colours" stops being deliverable and the extra entries only crowd
 * the ones already there.
 */
const HUE_WHEEL = [
  222, // blue
  42, // amber
  312, // magenta
  132, // green
  357, // red
  177, // teal
  87, // yellow-green
  267, // violet
];

/** Past a full lap, hues would repeat exactly. Half a step, so the ninth tree
 * lands halfway between the first and the second instead of on top of the
 * first. */
const LAP_SHIFT = 22;

/** How far a node may drift from its root's hue, in degrees either way —
 * enough to separate a few siblings, not enough to break the family
 * resemblance. **Roots are exempt**: level 1 is where the colours must be
 * unmistakably different, and a drift of even a few degrees would eat into the
 * spacing the wheel is there to guarantee. */
const HUE_SPREAD = 8;
/** Same idea on the lightness axis, inside the node's own depth band. */
const LIGHTNESS_SPREAD = 4;

/**
 * The roots holding at least one of `onCanvas` first, in tree order, then all
 * the others — also in tree order.
 *
 * Walking up from each present id costs one parent chain per id, rather than
 * one subtree walk per root; the `byId.size` bound makes it terminate even on
 * a chain that loops.
 */
function orderRootsByPresence(
  tree: HierarchyTree,
  onCanvas: ReadonlySet<string>,
): HierarchyTreeNode[] {
  if (onCanvas.size === 0) return tree.roots;
  const presentRoots = new Set<string>();
  for (const id of onCanvas) {
    let current = tree.byId.get(id);
    for (let guard = 0; current && guard <= tree.byId.size; guard++) {
      if (!current.parentId) {
        presentRoots.add(current.id);
        break;
      }
      current = tree.byId.get(current.parentId);
    }
  }
  if (presentRoots.size === 0) return tree.roots;
  return [
    ...tree.roots.filter((r) => presentRoots.has(r.id)),
    ...tree.roots.filter((r) => !presentRoots.has(r.id)),
  ];
}

/**
 * A colour per node of the hierarchy: hue from the tree it belongs to,
 * lightness from its depth.
 *
 * Every node gets one, including the ones nothing carries — filtering is the
 * caller's business: the legend only shows dots for what a visible interface
 * carries, and an edge only draws what it transports.
 *
 * `hueRotation` turns the whole wheel for this axis. Both axes can be lit at
 * once — dots on the flows, pie slices in the rectangles — and nothing should
 * suggest that a capability and a data object sharing a colour have anything
 * to do with each other. Half a step (22 degrees) makes every hue of one axis
 * land exactly between two hues of the other, which no choice of starting
 * *index* could guarantee.
 *
 * `onCanvas` is what makes the wheel deliver on its promise. The hue used to
 * come from a root's rank among **all** the roots of the hierarchy, and that
 * cannot work: the trees actually on a diagram are an arbitrary handful out of
 * the whole crawl, so two of them whose ranks differ by a multiple of the
 * wheel's length landed on the same entry — 312 and 334 degrees, two magentas,
 * on a real diagram — while amber and orange went unused because no displayed
 * root happened to reach them.
 *
 * So the trees **present on the canvas take the front of the wheel**, in tree
 * order, and the rest follow. Whatever is on screen is therefore spread across
 * the wheel from its widest end, which is the only way to guarantee that level
 * 1 reads as unmistakably different colours.
 *
 * The price, stated plainly: a tree's hue depends on which trees are on the
 * diagram. It changes when a **new top-level family** appears or leaves —
 * never when a node is added inside a family already there. Telling the trees
 * apart is worth that much churn; a colour nobody can distinguish is stable
 * and useless.
 */
export function buildHierarchyColors(
  tree: HierarchyTree | null,
  theme: Theme,
  hueRotation = 0,
  onCanvas: ReadonlySet<string> = new Set(),
): Map<string, string> {
  const colors = new Map<string, string>();
  if (!tree) return colors;
  const band = BANDS[theme];

  orderRootsByPresence(tree, onCanvas).forEach((root, rank) => {
    const lap = Math.floor(rank / HUE_WHEEL.length);
    const rootHue = (HUE_WHEEL[rank % HUE_WHEEL.length] + lap * LAP_SHIFT + hueRotation) % 360;
    // Iterative walk: the crawl can nest deeply and a recursion here would be
    // the only place in this axis at risk of blowing the stack.
    const stack: { id: string; depth: number }[] = [{ id: root.id, depth: 0 }];
    while (stack.length) {
      const { id, depth } = stack.pop()!;
      const node = tree.byId.get(id);
      if (!node || colors.has(id)) continue;

      const own = hash(id);
      // Two independent slices of the same hash, so a node's hue offset and
      // its lightness offset don't move together. A root keeps its wheel hue
      // exactly — see HUE_SPREAD.
      const hueOffset = depth === 0 ? 0 : (own % (HUE_SPREAD * 2 + 1)) - HUE_SPREAD;
      const lightOffset = ((own >>> 8) % (LIGHTNESS_SPREAD * 2 + 1)) - LIGHTNESS_SPREAD;

      const hue = (rootHue + hueOffset + 360) % 360;
      const lightness = Math.min(band.max, band.base + depth * band.step + lightOffset);
      colors.set(id, `hsl(${hue} ${band.saturation}% ${Math.round(lightness)}%)`);

      for (const child of node.children) stack.push({ id: child.id, depth: depth + 1 });
    }
  });

  return colors;
}
