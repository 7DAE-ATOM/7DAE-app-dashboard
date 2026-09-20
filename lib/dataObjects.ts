import { fetchAllDataObjectNodes } from "./atom-api";
import type { Application, DataObjectTree } from "./types";
import {
  buildHierarchyTree,
  countApplicationsPerNode as countPerNode,
  nodeNames,
} from "./hierarchyTree";

/**
 * The Data Objects axis of the catalogue filter — the twin of
 * `lib/businessCapabilities.ts`, sharing all of its machinery through
 * `lib/hierarchyTree.ts`.
 *
 * The link between an application and its data objects comes from the
 * application itself (`Application.dataObjects`, fed by
 * `relApplicationToDataObject` on the application query), not from the
 * hierarchy crawl: it is the same LeanIX relation seen from the other side,
 * and it is already loaded for the whole catalogue.
 */

export async function getDataObjectTree(): Promise<DataObjectTree> {
  return buildHierarchyTree(await fetchAllDataObjectNodes());
}

export function countApplicationsPerDataObject(
  tree: DataObjectTree | null,
  applications: Application[],
): Map<string, number> {
  return countPerNode(tree, applications, (app) => app.dataObjects);
}

/**
 * The data objects actually **carried by a flow** on the Discover canvas: the
 * union of the interfaces' own data objects.
 *
 * Deliberately not `countApplicationsPerDataObject` above, which answers a
 * different question — which applications *declare* a data object. LeanIX
 * carries the two relations separately and they diverge: an interface can
 * carry a data object that neither end declares. Restricting the legend to
 * what circulates therefore needs this set and nothing else.
 *
 * Intersected with the loaded hierarchy, which is what implements "a data
 * object absent from the hierarchy gets neither a place in the tree nor a
 * colour": nothing could label or legend it.
 */
export function carriedDataObjectIds(
  tree: DataObjectTree | null,
  interfaces: { dataObjectIds: string[] }[],
): Set<string> {
  const carried = new Set<string>();
  if (!tree) return carried;
  for (const iface of interfaces) {
    for (const id of iface.dataObjectIds) {
      if (tree.byId.has(id)) carried.add(id);
    }
  }
  return carried;
}

/** Checked ids → names, for the PDF export header. */
export function dataObjectNames(
  tree: DataObjectTree | null,
  checkedIds: string[],
): string[] {
  return nodeNames(tree, checkedIds);
}
