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

/** Checked ids → names, for the PDF export header. */
export function dataObjectNames(
  tree: DataObjectTree | null,
  checkedIds: string[],
): string[] {
  return nodeNames(tree, checkedIds);
}
