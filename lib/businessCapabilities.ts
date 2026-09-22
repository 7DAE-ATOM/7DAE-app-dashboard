import { fetchAllBusinessCapabilityNodes } from "./atom-api";
import type { Application, BusinessCapabilityTree } from "./types";
import {
  buildHierarchyTree,
  countApplicationsPerNode as countPerNode,
  expandSelection as expandHierarchySelection,
  nodeNames,
} from "./hierarchyTree";

/**
 * The Business Capability axis of the catalogue filter.
 *
 * All the machinery — tree building, descendant expansion, per-node counting —
 * lives in `lib/hierarchyTree.ts`, shared with the Data Objects axis
 * (`lib/dataObjects.ts`). What is specific to this axis, and all that is left
 * here, is *where the crawl comes from* and *which link list an application
 * carries*.
 */

export async function getBusinessCapabilityTree(): Promise<BusinessCapabilityTree> {
  return buildHierarchyTree(await fetchAllBusinessCapabilityNodes());
}

export const expandSelection = expandHierarchySelection;

export function countApplicationsPerNode(
  tree: BusinessCapabilityTree | null,
  applications: Application[],
): Map<string, number> {
  return countPerNode(tree, applications, (app) => app.businessCapabilities);
}

/**
 * The capabilities **directly** declared by the applications drawn on the
 * Discover canvas — the twin of `carriedDataObjectIds` in `lib/dataObjects.ts`.
 *
 * Deliberately not `countApplicationsPerNode` above, although that one answers
 * a question that looks the same. It rolls its children up, so a parent counts
 * whatever its descendants cover; that roll-up is right for the counter and
 * wrong for the colour. Colouring a parent on the strength of a cumulative
 * count would put a capability on an application's pie that the application
 * does not declare.
 *
 * Intersected with the loaded hierarchy: a capability absent from it gets
 * neither a dot in the tree nor a slice in a pie, since nothing could label it.
 */
export function coveredCapabilityIds(
  tree: BusinessCapabilityTree | null,
  applications: Application[],
): Set<string> {
  const covered = new Set<string>();
  if (!tree) return covered;
  for (const app of applications) {
    for (const capability of app.businessCapabilities) {
      if (tree.byId.has(capability.id)) covered.add(capability.id);
    }
  }
  return covered;
}

/** Checked ids → names, for the PDF export header. */
export function capabilityNames(
  tree: BusinessCapabilityTree | null,
  checkedIds: string[],
): string[] {
  return nodeNames(tree, checkedIds);
}
