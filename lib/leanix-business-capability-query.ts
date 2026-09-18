/**
 * GraphQL query for LeanIX BusinessCapability FactSheets, POSTed as-is (as
 * `{ query }`) to `/api/leanix/graphql/query`.
 *
 * This is the **hierarchy** source for the catalogue's Business Capabilities
 * filter. The applications' own `relApplicationToBusinessCapability` only
 * carries the capabilities they are directly linked to, with no parent — so
 * the tree has to be crawled separately and held client-side to resolve a
 * checked parent into its descendants.
 *
 * Only `relToParent` is requested (not `relToChild`): each capability has a
 * single parent, so the children lists are rebuilt from the parent links in
 * `lib/businessCapabilities.ts` — half the payload, same tree.
 */
const BUSINESS_CAPABILITY_QUERY = `
query {
  allFactSheets(factSheetType: BusinessCapability) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        ... on BusinessCapability {
          id
          externalId {
            externalId
          }
          name
          relToParent {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on BusinessCapability {
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
 * `buildApplicationsQuery` (rebuilding the `allFactSheets(...)` argument
 * list) rather than GraphQL `variables`, whose support on this endpoint is
 * unconfirmed. */
export function buildBusinessCapabilitiesQuery(opts: { after?: string }): string {
  const args = ["factSheetType: BusinessCapability"];
  if (opts.after) {
    args.push(`after: "${opts.after}"`);
  }
  return BUSINESS_CAPABILITY_QUERY.replace(
    "allFactSheets(factSheetType: BusinessCapability)",
    `allFactSheets(${args.join(", ")})`,
  );
}
