/**
 * GraphQL queries for the LeanIX Interface FactSheet model that powers the
 * Discover graph — distinct from `lib/leanix-application-query.ts` (which
 * only requests the fields the Application detail page maps). POSTed as-is
 * (as `{ query }`) to `/api/leanix/graphql/query`.
 *
 * Both queries filter by technical `id` (`filter: { ids: [...] }`), never by
 * `externalId` — an Interface has no usable `externalId`, and an Application
 * may also lack one, so Discover identifies every node by its technical id.
 */

/** Starting from an Application: both directions in one round-trip —
 * interfaces it provides (with their consumers already nested) and
 * interfaces it consumes (with their provider already nested). */
const APPLICATION_INTERFACES_QUERY = `
query {
  allFactSheets(filter: { ids: ["__ID__"] }) {
    edges {
      node {
        ... on Application {
          id
          externalId { externalId }
          name

          relProviderApplicationToInterface {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on Interface {
                    externalId { externalId }
                    protocol

                    relInterfaceToConsumerApplication {
                      edges {
                        node {
                          interfacetype
                          frequency
                          factSheet {
                            id
                            name
                            ... on Application {
                              externalId { externalId }
                            }
                          }
                        }
                      }
                    }

                    relInterfaceToDataObject {
                      edges {
                        node {
                          factSheet {
                            id
                            name
                            ... on DataObject {
                              externalId { externalId }
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

          relConsumerApplicationToInterface {
            edges {
              node {
                interfacetype
                frequency
                factSheet {
                  id
                  name
                  ... on Interface {
                    externalId { externalId }
                    protocol

                    relInterfaceToProviderApplication {
                      edges {
                        node {
                          factSheet {
                            id
                            name
                            ... on Application {
                              externalId { externalId }
                            }
                          }
                        }
                      }
                    }

                    relInterfaceToDataObject {
                      edges {
                        node {
                          factSheet {
                            id
                            name
                            ... on DataObject {
                              externalId { externalId }
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
      }
    }
  }
}
`;

/** Starting from an Interface directly — used to complete a side that wasn't
 * nested in the Application-side query (e.g. the other consumers of an
 * interface first discovered via one of its consumers). */
const INTERFACE_DEPENDENCIES_QUERY = `
query {
  allFactSheets(filter: { ids: ["__ID__"] }) {
    edges {
      node {
        ... on Interface {
          id
          externalId { externalId }
          name
          protocol

          relInterfaceToConsumerApplication {
            edges {
              node {
                interfacetype
                frequency
                factSheet {
                  id
                  name
                  ... on Application {
                    externalId { externalId }
                  }
                }
              }
            }
          }

          relInterfaceToProviderApplication {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on Application {
                    externalId { externalId }
                  }
                }
              }
            }
          }

          relInterfaceToDataObject {
            edges {
              node {
                factSheet {
                  id
                  name
                  ... on DataObject {
                    externalId { externalId }
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

export function buildApplicationInterfacesQuery(id: string): string {
  return APPLICATION_INTERFACES_QUERY.replace("__ID__", id);
}

/** Same query for several applications in one round-trip — `filter: { ids }`
 * is already a list, so seeding the graph from the catalogue costs a handful
 * of requests instead of one per application. */
export function buildApplicationsInterfacesQuery(ids: string[]): string {
  const list = ids.map((id) => JSON.stringify(id)).join(", ");
  return APPLICATION_INTERFACES_QUERY.replace('["__ID__"]', `[${list}]`);
}

export function buildInterfaceDependenciesQuery(id: string): string {
  return INTERFACE_DEPENDENCIES_QUERY.replace("__ID__", id);
}
