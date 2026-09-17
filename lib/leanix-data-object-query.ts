/**
 * GraphQL query for LeanIX DataObject FactSheets, POSTed as-is (as `{ query }`)
 * to `/api/leanix/graphql/query`.
 *
 * This is the **hierarchy** source for the catalogue's Data Objects filter,
 * the exact counterpart of `lib/leanix-business-capability-query.ts`: the
 * applications' own `relApplicationToDataObject` only carries the data objects
 * they are directly linked to, with no parent, so the tree has to be crawled
 * separately and held client-side.
 *
 * `relDataObjectToApplication` is deliberately **not** requested, although the
 * relation exists: it is the other direction of `relApplicationToDataObject`,
 * which every application already carries (`lib/leanix-application-query.ts`)
 * across the whole crawled catalogue. Asking for both would mean two sources
 * for one relation — bound to disagree — and a widely used data object would
 * repeat hundreds of applications already in memory. An "applications of this
 * data object" view can invert the application-side list in one pass, with no
 * query change.
 *
 * Only `relToParent` is requested (not `relToChild`): each node has a single
 * parent, so the children lists are rebuilt from the parent links in
 * `lib/hierarchyTree.ts` — half the payload, same tree.
 */
const DATA_OBJECT_QUERY = `
query {
  allFactSheets(factSheetType: DataObject) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        ... on DataObject {
          id
          externalId {
            externalId
          }
          name
          description
          relToParent {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on DataObject {
                    externalId {
                      externalId
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

/** One page of the crawl. Same text-substitution convention as
 * `buildBusinessCapabilitiesQuery` (rebuilding the `allFactSheets(...)`
 * argument list) rather than GraphQL `variables`, whose support on this
 * endpoint is unconfirmed. */
export function buildDataObjectsQuery(opts: { after?: string }): string {
  const args = ["factSheetType: DataObject"];
  if (opts.after) {
    args.push(`after: "${opts.after}"`);
  }
  return DATA_OBJECT_QUERY.replace(
    "allFactSheets(factSheetType: DataObject)",
    `allFactSheets(${args.join(", ")})`,
  );
}
