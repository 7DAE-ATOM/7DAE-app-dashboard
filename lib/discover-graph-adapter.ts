import type {
  ApplicationInterfacesNode,
  InterfaceNode,
} from "./atom-api";
import type {
  DataObject,
  DiscoverApplicationNode,
  DiscoverEdge,
  DiscoverInterfaceNode,
} from "./types";

/** `managerName` is never known from these GraphQL shapes (the Interface
 * queries don't carry it) — callers resolve it separately from the
 * already-loaded `Application[]` catalogue and patch it in. */
function toApplicationNode(factSheet: {
  id: string;
  name: string | null;
  externalId?: { externalId: string } | null;
}): DiscoverApplicationNode {
  return {
    kind: "application",
    id: factSheet.id,
    externalId: factSheet.externalId?.externalId ?? null,
    name: factSheet.name ?? factSheet.id,
    managerName: null,
  };
}

/** Same tolerance as `mapDataObjects` in `lib/application-adapter.ts` — a null
 * FactSheet is skipped, a blank name falls back to a dash. Deduplicated (the
 * same data object can be attached twice) and sorted here rather than in the
 * card, so the list is stable from one opening to the next. */
function toDataObjects(rel: InterfaceNode["relInterfaceToDataObject"]): DataObject[] {
  const byId = new Map<string, DataObject>();
  for (const edge of rel?.edges ?? []) {
    const fs = edge.node.factSheet;
    if (!fs || byId.has(fs.id)) continue;
    byId.set(fs.id, {
      id: fs.id,
      name: fs.name?.trim() || "—",
      description: fs.description ?? null,
    });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function toInterfaceNode(iface: InterfaceNode, providerId: string): DiscoverInterfaceNode {
  return {
    kind: "interface",
    id: iface.id,
    name: iface.name,
    protocol: iface.protocol,
    providerId,
    externalId: iface.externalId?.externalId ?? null,
    dataObjects: toDataObjects(iface.relInterfaceToDataObject),
  };
}

/** *Show Interfaces Inbound* — circles only, for the interfaces this
 * application provides. Filters out any edge with an incomplete FactSheet
 * (missing/malformed LeanIX data) rather than throwing. */
export function toInboundInterfaces(node: ApplicationInterfacesNode): DiscoverInterfaceNode[] {
  const edges = node.relProviderApplicationToInterface?.edges ?? [];
  return edges
    .map((e) => e.node.factSheet)
    .filter((iface): iface is InterfaceNode => !!iface)
    .map((iface) => toInterfaceNode(iface, node.id));
}

/** *Show Interfaces Outbound* — the interfaces this application consumes,
 * plus their (possibly not-yet-visible) provider applications and the
 * consumer→interface edges. */
export function toOutboundInterfacesAndProviders(node: ApplicationInterfacesNode): {
  interfaces: DiscoverInterfaceNode[];
  providers: DiscoverApplicationNode[];
  edges: DiscoverEdge[];
} {
  const interfaces: DiscoverInterfaceNode[] = [];
  const providers: DiscoverApplicationNode[] = [];
  const edges: DiscoverEdge[] = [];

  for (const edge of node.relConsumerApplicationToInterface?.edges ?? []) {
    const iface = edge.node.factSheet;
    if (!iface) continue;
    const providerFactSheet = iface.relInterfaceToProviderApplication?.edges?.[0]?.node?.factSheet;
    if (!providerFactSheet) continue;
    interfaces.push(toInterfaceNode(iface, providerFactSheet.id));
    providers.push(toApplicationNode(providerFactSheet));
    edges.push({
      id: `${node.id}::${iface.id}`,
      consumerId: node.id,
      interfaceId: iface.id,
      interfacetype: edge.node.interfacetype,
      frequency: edge.node.frequency,
    });
  }

  return { interfaces, providers, edges };
}

/** Relations *internal* to a set of applications, for the catalogue-seeded
 * graph: every interface whose provider is in the set (guaranteed by only
 * walking the provider-side relation of each fetched application) **and**
 * which has at least one consumer in the set. Interfaces reaching outside
 * the selection are dropped — the seeded graph is closed on the selection,
 * and the context menus remain the way to expand past it.
 *
 * One `fetchApplicationsInterfaces` call is enough: the consumers of a
 * provided interface are already nested in the provider's own response. */
export function toInternalRelations(
  nodes: ApplicationInterfacesNode[],
  selectedIds: Set<string>,
): { interfaces: DiscoverInterfaceNode[]; edges: DiscoverEdge[] } {
  const interfaces: DiscoverInterfaceNode[] = [];
  const edges: DiscoverEdge[] = [];
  const seenInterfaces = new Set<string>();
  const seenEdges = new Set<string>();

  for (const node of nodes) {
    if (!selectedIds.has(node.id)) continue;
    const factSheets = new Map(
      (node.relProviderApplicationToInterface?.edges ?? [])
        .map((e) => e.node.factSheet)
        .filter((iface): iface is InterfaceNode => !!iface)
        .map((iface) => [iface.id, iface]),
    );

    for (const iface of toInboundInterfaces(node)) {
      const factSheet = factSheets.get(iface.id);
      if (!factSheet) continue;
      const internalEdges = toInterfaceConsumers(factSheet).edges.filter((e) =>
        selectedIds.has(e.consumerId),
      );
      if (internalEdges.length === 0) continue;

      if (!seenInterfaces.has(iface.id)) {
        seenInterfaces.add(iface.id);
        interfaces.push(iface);
      }
      for (const edge of internalEdges) {
        if (seenEdges.has(edge.id)) continue;
        seenEdges.add(edge.id);
        edges.push(edge);
      }
    }
  }

  return { interfaces, edges };
}

/**
 * Every interface provided by the fetched applications, and every edge
 * reaching it — the **permissive** twin of `toInternalRelations`, for
 * rehydrating a saved diagram.
 *
 * The difference is the whole point: `toInternalRelations` drops an interface
 * that has no consumer inside the selection, because a catalogue-seeded graph
 * is meant to be closed on that selection. A saved diagram is not — *Show
 * inbound interfaces* legitimately leaves a circle with no consumer drawn, and
 * filtering here would make those circles vanish on reload, silently. What may
 * legitimately be dropped is decided by the caller, against the **saved** ids,
 * which are the only authority on what was on screen.
 */
export function toDiagramRelations(nodes: ApplicationInterfacesNode[]): {
  interfaces: DiscoverInterfaceNode[];
  edges: DiscoverEdge[];
} {
  const interfaces: DiscoverInterfaceNode[] = [];
  const edges: DiscoverEdge[] = [];
  const seenInterfaces = new Set<string>();
  const seenEdges = new Set<string>();

  for (const node of nodes) {
    const factSheets = new Map(
      (node.relProviderApplicationToInterface?.edges ?? [])
        .map((e) => e.node.factSheet)
        .filter((iface): iface is InterfaceNode => !!iface)
        .map((iface) => [iface.id, iface]),
    );

    for (const iface of toInboundInterfaces(node)) {
      if (!seenInterfaces.has(iface.id)) {
        seenInterfaces.add(iface.id);
        interfaces.push(iface);
      }
      const factSheet = factSheets.get(iface.id);
      if (!factSheet) continue;
      for (const edge of toInterfaceConsumers(factSheet).edges) {
        if (seenEdges.has(edge.id)) continue;
        seenEdges.add(edge.id);
        edges.push(edge);
      }
    }
  }

  return { interfaces, edges };
}

/** Consumers of an already-visible Interface, for *Show dependencies* on a
 * circle — from either the provider-side query (nested consumers already
 * present) or a dedicated `fetchInterfaceDependencies` call. */
export function toInterfaceConsumers(iface: InterfaceNode): {
  consumers: DiscoverApplicationNode[];
  edges: DiscoverEdge[];
} {
  const consumers: DiscoverApplicationNode[] = [];
  const edges: DiscoverEdge[] = [];

  for (const edge of iface.relInterfaceToConsumerApplication?.edges ?? []) {
    const factSheet = edge.node.factSheet;
    if (!factSheet) continue;
    consumers.push(toApplicationNode(factSheet));
    edges.push({
      id: `${factSheet.id}::${iface.id}`,
      consumerId: factSheet.id,
      interfaceId: iface.id,
      interfacetype: edge.node.interfacetype,
      frequency: edge.node.frequency,
    });
  }

  return { consumers, edges };
}

/** The provider of an already-visible Interface, for *Show dependencies* on
 * a circle discovered via a consumer (which doesn't need this — its provider
 * was already revealed) or completed via `fetchInterfaceDependencies`. */
export function toInterfaceProvider(iface: InterfaceNode): DiscoverApplicationNode | null {
  const factSheet = iface.relInterfaceToProviderApplication?.edges?.[0]?.node?.factSheet;
  return factSheet ? toApplicationNode(factSheet) : null;
}
