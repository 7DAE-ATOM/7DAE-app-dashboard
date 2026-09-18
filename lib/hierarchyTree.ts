import type { HierarchyTree, HierarchyTreeNode } from "./types";

/**
 * The machinery behind every hierarchical filter axis: Business Capabilities
 * and Data Objects today.
 *
 * Both are crawled flat from LeanIX as `relToParent` links, and both are used
 * the same way — an application only knows the leaves it is directly linked
 * to, so checking a parent can only mean anything once the tree is held
 * client-side and expanded to its descendants at filtering time.
 *
 * Originally written for the capabilities alone (`lib/businessCapabilities.ts`),
 * generalised when the Data Objects axis needed the exact same behaviour: two
 * copies of this would diverge at the first fix.
 */

/** The flat crawl shape both queries return. */
export type FlatHierarchyNode = {
  id: string;
  name: string | null;
  description?: string | null;
  externalId?: { externalId: string } | null;
  relToParent?: {
    edges?: { node?: { factSheet?: { id?: string } | null } | null }[] | null;
  } | null;
};

/** Rebuilds the tree from the flat crawl. Two defensive rules, both silent by
 * design — a malformed LeanIX record must not cost the whole filter:
 * - a node whose parent isn't in the crawl (missing page, inconsistent data)
 *   becomes a root instead of vanishing;
 * - a parent chain that loops back on itself is broken at the offending node,
 *   which becomes a root, so the walk always terminates. */
export function buildHierarchyTree(flat: FlatHierarchyNode[]): HierarchyTree {
  const byId = new Map<string, HierarchyTreeNode>();
  for (const node of flat) {
    byId.set(node.id, {
      id: node.id,
      name: node.name?.trim() || "—",
      externalId: node.externalId?.externalId ?? null,
      description: node.description ?? null,
      // The data guarantees a single parent, so only the first edge is read.
      parentId: node.relToParent?.edges?.[0]?.node?.factSheet?.id ?? null,
      children: [],
    });
  }

  const roots: HierarchyTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (!parent || parent.id === node.id || createsCycle(node, parent, byId)) {
      node.parentId = null;
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  sortByName(roots);
  return { roots, byId };
}

/** Would attaching `node` under `parent` close a loop? Walks the parent chain
 * upward; the `byId.size` bound makes it terminate even on data that is
 * already cyclic before this node is attached. */
function createsCycle(
  node: HierarchyTreeNode,
  parent: HierarchyTreeNode,
  byId: Map<string, HierarchyTreeNode>,
): boolean {
  let current: HierarchyTreeNode | undefined = parent;
  for (let guard = 0; current && guard <= byId.size; guard++) {
    if (current.id === node.id) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

function sortByName(nodes: HierarchyTreeNode[]): void {
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  for (const node of nodes) sortByName(node.children);
}

/** A node's id plus every descendant's — the set a single checked node
 * stands for. */
export function subtreeIds(node: HierarchyTreeNode): Set<string> {
  const ids = new Set<string>();
  const stack = [node];
  while (stack.length) {
    const current = stack.pop()!;
    if (ids.has(current.id)) continue;
    ids.add(current.id);
    stack.push(...current.children);
  }
  return ids;
}

/** Turns the checked ids into the ids actually matched: each checked node
 * plus all of its descendants. Checking a parent and one of its children is
 * therefore idempotent — the union collapses them. */
export function expandSelection(
  tree: HierarchyTree | null,
  checkedIds: string[],
): Set<string> {
  const expanded = new Set<string>();
  if (!tree) return expanded;
  for (const id of checkedIds) {
    const node = tree.byId.get(id);
    // An id that no longer exists in the tree still filters on itself, so a
    // stale selection narrows the catalogue instead of silently widening it.
    if (!node) {
      expanded.add(id);
      continue;
    }
    for (const descendantId of subtreeIds(node)) expanded.add(descendantId);
  }
  return expanded;
}

/**
 * How many applications each node would bring in — the count shown next to
 * its label.
 *
 * `linksOf` is what each axis supplies: the list of nodes an application is
 * directly linked to (its capabilities, its data objects…).
 *
 * Bottom-up over **sets of application ids**, not a sum of the children's
 * counts: an application linked to two nodes of the same subtree must be
 * counted once, and summing would count it twice.
 */
export function countApplicationsPerNode<T extends { id: string }>(
  tree: HierarchyTree | null,
  applications: T[],
  linksOf: (application: T) => { id: string }[] | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!tree) return counts;

  const directByNode = new Map<string, string[]>();
  for (const app of applications) {
    for (const link of linksOf(app) ?? []) {
      const list = directByNode.get(link.id);
      if (list) list.push(app.id);
      else directByNode.set(link.id, [app.id]);
    }
  }

  const collect = (node: HierarchyTreeNode): Set<string> => {
    const appIds = new Set(directByNode.get(node.id) ?? []);
    for (const child of node.children) {
      for (const id of collect(child)) appIds.add(id);
    }
    counts.set(node.id, appIds.size);
    return appIds;
  };
  for (const root of tree.roots) collect(root);

  return counts;
}

/** Checked ids → names, for the PDF export header (which must not print raw
 * technical ids). Ids missing from the tree are skipped. */
export function nodeNames(
  tree: HierarchyTree | null,
  checkedIds: string[],
): string[] {
  if (!tree) return [];
  return checkedIds
    .map((id) => tree.byId.get(id)?.name)
    .filter((name): name is string => !!name);
}
