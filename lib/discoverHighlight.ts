/**
 * The matching rule behind Discover's functional highlight, shared by the two
 * sides that have to agree on it: `DiscoverGraph` (which paints) and
 * `DiscoverHighlightPanel` (which counts, and which decides whether anything
 * matched at all). Two copies of this would drift at the first fix.
 *
 * It lives in `lib/` rather than in the graph so the panel can reach it
 * without statically importing `DiscoverGraph`, which is deliberately
 * code-split behind `dynamic(ssr:false)`.
 */

/**
 * A panel selection, one entry per **ticked** node of each axis, already
 * expanded to that node's subtree.
 *
 * Groups rather than one flat set because `and` means "carries every ticked
 * value", and a ticked parent has to count as a single value: flattening it
 * would demand that an element carry every data object of the subtree, which
 * nothing ever does.
 */
export type AxisHighlightSelection = {
  dataObjects: ReadonlySet<string>[];
  capabilities: ReadonlySet<string>[];
  join: "or" | "and";
};

/** Does `own` — what an element is linked to in the model — satisfy `groups`?
 * An empty `groups` means the axis carries no selection and therefore does
 * not apply to anything. */
export function matchesAxis(
  own: Set<string>,
  groups: ReadonlySet<string>[],
  join: "or" | "and",
): boolean {
  if (groups.length === 0) return false;
  const hits = (group: ReadonlySet<string>) => {
    for (const id of own) if (group.has(id)) return true;
    return false;
  };
  return join === "and" ? groups.every(hits) : groups.some(hits);
}

/**
 * Whether an application is lit, given both axes.
 *
 * Conjunctive between chapters, but evaluated **only over the chapters that
 * carry a selection** — an interface has no business capability, so a rule
 * demanding both would light nothing as soon as a capability is ticked.
 */
export function applicationMatches(
  dataObjectIds: string[],
  capabilityIds: string[],
  selection: AxisHighlightSelection,
): boolean {
  const { dataObjects, capabilities, join } = selection;
  const axes: boolean[] = [];
  if (dataObjects.length > 0) {
    axes.push(matchesAxis(new Set(dataObjectIds), dataObjects, join));
  }
  if (capabilities.length > 0) {
    axes.push(matchesAxis(new Set(capabilityIds), capabilities, join));
  }
  return axes.length > 0 && axes.every(Boolean);
}
