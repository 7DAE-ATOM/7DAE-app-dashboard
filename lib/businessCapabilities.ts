import { fetchAllBusinessCapabilityNodes, type BusinessCapabilityNode } from "./atom-api";
import type {
  Application,
  BusinessCapabilityTree,
  BusinessCapabilityTreeNode,
} from "./types";

/**
 * The Business Capability hierarchy behind the catalogue filter.
 *
 * The applications themselves only know the capabilities they are directly
 * linked to (`Application.businessCapabilities`), with no parent — so checking
 * a parent node can only mean anything once the tree is held here, client-side,
 * and expanded to its descendants at filtering time.
 */

export async function getBusinessCapabilityTree(): Promise<BusinessCapabilityTree> {
  return buildCapabilityTree(await fetchAllBusinessCapabilityNodes());
}

/** Rebuilds the tree from the flat crawl. Two defensive rules, both silent by
 * design — a malformed LeanIX record must not cost the whole filter:
 * - a node whose parent isn't in the crawl (missing page, inconsistent data)
 *   becomes a root instead of vanishing;
 * - a parent chain that loops back on itself is broken at the offending node,
 *   which becomes a root, so the walk always terminates. */
export function buildCapabilityTree(flat: BusinessCapabilityNode[]): BusinessCapabilityTree {
  const byId = new Map<string, BusinessCapabilityTreeNode>();
  for (const node of flat) {
    byId.set(node.id, {
      id: node.id,
      name: node.name?.trim() || "—",
      externalId: node.externalId?.externalId ?? null,
      // The data guarantees a single parent, so only the first edge is read.
      parentId: node.relToParent?.edges?.[0]?.node?.factSheet?.id ?? null,
      children: [],
    });
  }

  const roots: BusinessCapabilityTreeNode[] = [];
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
  node: BusinessCapabilityTreeNode,
  parent: BusinessCapabilityTreeNode,
  byId: Map<string, BusinessCapabilityTreeNode>,
): boolean {
  let current: BusinessCapabilityTreeNode | undefined = parent;
  for (let guard = 0; current && guard <= byId.size; guard++) {
    if (current.id === node.id) return true;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return false;
}

function sortByName(nodes: BusinessCapabilityTreeNode[]): void {
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  for (const node of nodes) sortByName(node.children);
}

/** A node's id plus every descendant's — the set a single checked node
 * stands for. */
export function subtreeIds(node: BusinessCapabilityTreeNode): Set<string> {
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
  tree: BusinessCapabilityTree | null,
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
 * Bottom-up over **sets of application ids**, not a sum of the children's
 * counts: an application linked to two capabilities of the same subtree must
 * be counted once, and summing would count it twice.
 */
export function countApplicationsPerNode(
  tree: BusinessCapabilityTree | null,
  applications: Application[],
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!tree) return counts;

  const directByCapability = new Map<string, string[]>();
  for (const app of applications) {
    for (const capability of app.businessCapabilities ?? []) {
      const list = directByCapability.get(capability.id);
      if (list) list.push(app.id);
      else directByCapability.set(capability.id, [app.id]);
    }
  }

  const collect = (node: BusinessCapabilityTreeNode): Set<string> => {
    const appIds = new Set(directByCapability.get(node.id) ?? []);
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
export function capabilityNames(
  tree: BusinessCapabilityTree | null,
  checkedIds: string[],
): string[] {
  if (!tree) return [];
  return checkedIds
    .map((id) => tree.byId.get(id)?.name)
    .filter((name): name is string => !!name);
}
