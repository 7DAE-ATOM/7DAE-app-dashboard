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

/** Checked ids → names, for the PDF export header. */
export function capabilityNames(
  tree: BusinessCapabilityTree | null,
  checkedIds: string[],
): string[] {
  return nodeNames(tree, checkedIds);
}
