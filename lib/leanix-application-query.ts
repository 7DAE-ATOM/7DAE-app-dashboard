/**
 * GraphQL query for LeanIX Application FactSheets, POSTed as-is (as
 * `{ query }`) to `/api/leanix/graphql/query`. Only fields already mapped by
 * `Application` (`lib/types.ts`) are requested — other attributes exposed by
 * the schema (`coreBusinessStatus`, `resourceAdequacy`, `kpi_*`, …) are
 * deferred to the iterations that actually use them, to keep the payload lean.
 */
const APPLICATION_QUERY = `
query {
  allFactSheets(factSheetType: Application) {
    totalCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      cursor
      node {
        ... on Application {
          id
          externalId {
            externalId
          }
          name
          appCategory
          appStatus
          description
          release
          operator
          providerType
          deptProvider
          businessCriticality
          functionalSuitability
          technicalSuitability
          kpi_functionalSuitability
          kpi_maintainability
          kpi_understandability
          kpi_security
          deta06ComplianceLevel
          deta06MissingDocs
          obsoRiskStatus
          airbusSite
          programCategory
          partIS
          BRDURL
          ARDURL
          confluenceURL
          gDrivePath
          completion {
            percentage
          }
          lifecycle {
            phases {
              phase
              startDate
            }
          }
          documents {
            edges {
              node {
                id
                documentType
                name
                origin
                url
              }
            }
          }
          relApplicationToBusinessOwnerUsers {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on Users {
                    externalId {
                      externalId
                    }
                  }
                }
              }
            }
          }
          relApplicationToSolutionArchitectUsers {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on Users {
                    externalId {
                      externalId
                    }
                  }
                }
              }
            }
          }
          relApplicationToPortfolio {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on Portfolio {
                    externalId {
                      externalId
                    }
                  }
                }
              }
            }
          }
          relApplicationToDataObject {
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
          relApplicationToBusinessCapability {
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

/**
 * Builds the query text for one page, optionally filtered to a single
 * externalId. Uses text substitution on the `allFactSheets(...)` argument
 * list rather than GraphQL `variables` — the endpoint's support for
 * `variables` is unconfirmed, so a single readable query file plus string
 * substitution is the more robust choice.
 */
export function buildApplicationsQuery(opts: {
  after?: string;
  externalId?: string;
}): string {
  const args: string[] = [];
  if (opts.externalId) {
    // `filter` and `factSheetType` can't be combined as sibling arguments
    // on `allFactSheets` — and external-id lookup is its own filter field,
    // `filter.externalIds` (distinct from `filter.ids`, which resolves
    // technical ids, the convention used by `leanix-interface-query.ts`).
    args.push(`filter: { externalIds: ["externalId/${opts.externalId}"] }`);
  } else {
    args.push("factSheetType: Application");
  }
  if (opts.after) {
    args.push(`after: "${opts.after}"`);
  }
  return APPLICATION_QUERY.replace(
    "allFactSheets(factSheetType: Application)",
    `allFactSheets(${args.join(", ")})`,
  );
}
