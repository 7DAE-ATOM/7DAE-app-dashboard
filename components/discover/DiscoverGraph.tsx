"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  MarkerType,
  type Node,
  type Edge,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { DiscoverApplicationNode, DiscoverEdge, DiscoverInterfaceNode } from "@/lib/types";
import {
  fetchApplicationInterfaces,
  fetchApplicationsInterfaces,
  fetchInterfaceDependencies,
  type ApplicationInterfacesNode,
  type InterfaceNode as InterfaceFactSheet,
} from "@/lib/atom-api";
import {
  toInboundInterfaces,
  toInternalRelations,
  toOutboundInterfacesAndProviders,
  toInterfaceConsumers,
  toInterfaceProvider,
} from "@/lib/discover-graph-adapter";
import {
  APP_NODE_HEIGHT,
  APP_NODE_WIDTH,
  INTERFACE_NODE_SIZE,
  MIN_APP_NODE_WIDTH,
  interfaceSlotPosition,
  layoutRootApplications,
  placeNewApplicationNode,
  projectPointToRectanglePerimeter,
} from "@/lib/discover-graph-layout";
import ApplicationNodeComponent, { type ApplicationNodeData } from "./ApplicationNode";
import InterfaceNodeComponent, { type InterfaceNodeData } from "./InterfaceNode";
import GraphEdge, { type GraphEdgeData } from "./GraphEdge";
import NodeContextMenu, { type DiscoverContextMenuTarget } from "./NodeContextMenu";
import { ApplicationInfoContext } from "./ApplicationInfoContext";
import type { Application } from "@/lib/types";
import type { DiscoverGraphSnapshot } from "@/lib/discoverMermaid";
import { useDiscoverViewMode } from "@/lib/discoverViewMode";

const nodeTypes = { application: ApplicationNodeComponent, interface: InterfaceNodeComponent };
const edgeTypes = { graphEdge: GraphEdge };

export type DiscoverGraphHandle = {
  addApplication: (app: DiscoverApplicationNode) => void;
  removeApplication: (id: string) => void;
  /** What is on the canvas right now, in plain data — the graph's topology
   * lives here, so an exporter has no other way to reach it. Read-only: it
   * moves, refits and selects nothing. */
  snapshot: () => DiscoverGraphSnapshot;
};

type Props = {
  resolveManagerName: (applicationId: string) => string | null;
  resolveApplication: (applicationId: string) => Application | null;
  /** Applications to lay out in one batch on mount, from the catalogue's
   * "Show in Discover" link (`/discover?ids=…`). Passed as a prop rather
   * than pushed through the imperative handle because the graph is
   * `dynamic(ssr:false)`: on the render where the caller first has the
   * applications, `graphRef.current` is still null, so a caller-side effect
   * would silently seed nothing. */
  seed?: DiscoverApplicationNode[];
  /** Called when "Hide" removes an application that is also a selection
   * chip, so the toolbar bar drops it too — the graph has already removed
   * the node itself, this is only the parent's mirror of the selection. */
  onApplicationHidden?: (id: string) => void;
};

function boxSizeOf(node: Node): { width: number; height: number } {
  if (node.type === "interface") {
    return { width: INTERFACE_NODE_SIZE, height: INTERFACE_NODE_SIZE };
  }
  const width = (node.data as ApplicationNodeData | undefined)?.width ?? APP_NODE_WIDTH;
  return { width, height: APP_NODE_HEIGHT };
}

/** Interface nodes are children (`parentId`) of their provider so xyflow
 * moves them together when the rectangle is dragged — their stored
 * `position` is relative to the parent, not a screen coordinate. Every
 * consumer of node geometry (edge drawing, overlap checks) must resolve
 * through this instead of reading `node.position` directly. */
function absolutePosition(node: Node, byId: Map<string, Node>): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = byId.get(node.parentId);
  if (!parent) return node.position;
  const parentAbs = absolutePosition(parent, byId);
  return { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
}

function centerOf(node: Node, byId: Map<string, Node>): { x: number; y: number } {
  const abs = absolutePosition(node, byId);
  const size = boxSizeOf(node);
  return { x: abs.x + size.width / 2, y: abs.y + size.height / 2 };
}

/**
 * Folds `consumer → interface` links into `consumer → provider application`
 * ones, deduplicated: several interfaces of the same provider consumed by the
 * same application yield a single arrow. The count of folded interfaces is
 * the one thing the simplified view drops, deliberately.
 *
 * Self-consumption (an application consuming an interface it provides itself)
 * is skipped: the two endpoints share a centre, which makes `trimToBorder`
 * degenerate, and a loop onto oneself says nothing here.
 */
function collapseToApplications(
  edgeMeta: DiscoverEdge[],
  providerOf: (interfaceId: string) => string | undefined,
): { sourceId: string; targetId: string }[] {
  const seen = new Set<string>();
  const result: { sourceId: string; targetId: string }[] = [];
  for (const e of edgeMeta) {
    const targetId = providerOf(e.interfaceId);
    if (!targetId || targetId === e.consumerId) continue;
    const key = `${e.consumerId}|${targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({ sourceId: e.consumerId, targetId });
  }
  return result;
}

function boxesOf(nodes: Node[]) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return nodes.map((n) => ({ ...absolutePosition(n, byId), ...boxSizeOf(n) }));
}

/** Where a ray from `from` toward `to` leaves `from`'s box — same math as
 * `lib/star-graph-layout.ts`'s `boxExit`, so edges visibly touch the
 * rectangle/circle border instead of hiding under it. */
function trimToBorder(
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: { width: number; height: number },
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const halfW = size.width / 2;
  const halfH = size.height / 2;
  const byWidth = Math.abs(dx) < 1e-6 ? Infinity : halfW / Math.abs(dx);
  const byHeight = Math.abs(dy) < 1e-6 ? Infinity : halfH / Math.abs(dy);
  const t = Math.min(byWidth, byHeight);
  return { x: from.x + dx * t, y: from.y + dy * t };
}

function mergeInterfaceFactSheet(
  a: InterfaceFactSheet | undefined,
  b: InterfaceFactSheet,
): InterfaceFactSheet {
  if (!a) return b;
  return {
    ...a,
    ...b,
    relInterfaceToConsumerApplication:
      b.relInterfaceToConsumerApplication ?? a.relInterfaceToConsumerApplication,
    relInterfaceToProviderApplication:
      b.relInterfaceToProviderApplication ?? a.relInterfaceToProviderApplication,
    relInterfaceToDataObject: b.relInterfaceToDataObject ?? a.relInterfaceToDataObject,
  };
}

/** Adapted from `/depgraph`'s `DependencyGraph.tsx`: plain `useState` (not
 * `useNodesState`), edges derived from `edgeMeta` + live node positions via
 * `useMemo` so dragging never touches `edgeMeta`, and every expand/hide
 * action mutates state locally — ELK runs at most once, for the initial
 * root layout: either trivially (the first `addApplication` puts a single
 * node at the origin) or through the batch `seed` effect below, which lays
 * out a whole catalogue selection in one pass. Never again afterward. */
const DiscoverGraph = forwardRef<DiscoverGraphHandle, Props>(function DiscoverGraph(
  { resolveManagerName, resolveApplication, seed, onApplicationHidden },
  ref,
) {
  // Drawing mode only: `nodes`/`edgeMeta` below are identical in both, so
  // switching loses nothing and costs no fetch.
  const viewMode = useDiscoverViewMode();
  const simplified = viewMode === "simple";
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edgeMeta, setEdgeMeta] = useState<DiscoverEdge[]>([]);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [contextMenu, setContextMenu] = useState<DiscoverContextMenuTarget | null>(null);
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Captured via `onInit` instead of `useReactFlow()` so the component
   * doesn't have to be split around a `ReactFlowProvider` just to re-fit the
   * view after the batch seed lands (the `fitView` prop is mount-only). */
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const closeApplicationInfo = useCallback(() => setOpenApplicationId(null), []);
  const toggleApplicationInfo = useCallback(
    (id: string) => setOpenApplicationId((current) => (current === id ? null : id)),
    [],
  );
  const applicationInfoValue = useMemo(
    () => ({
      openApplicationId,
      toggle: toggleApplicationInfo,
      close: closeApplicationInfo,
      resolveApplication,
    }),
    [openApplicationId, toggleApplicationInfo, closeApplicationInfo, resolveApplication],
  );

  useEffect(() => {
    if (!openApplicationId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeApplicationInfo();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openApplicationId, closeApplicationInfo]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const edgeMetaRef = useRef(edgeMeta);
  edgeMetaRef.current = edgeMeta;

  const rootIdsRef = useRef<Set<string>>(new Set());
  /** Every interface's provider id — the source of truth for "who anchors
   * this circle", independent of node.data (kept lean/render-only). */
  const interfaceProviderRef = useRef<Map<string, string>>(new Map());
  /** Each interface's stable slot index around its provider (see
   * `interfaceSlotPosition`) — assigned once and kept even while the
   * interface is hidden, so re-showing it returns it to the same spot when
   * that spot is still free. Slots in use are derived from the *currently
   * visible* nodes at assignment time, never from this map alone, so a
   * hidden interface's old slot is immediately reusable by another one. */
  const interfaceSlotRef = useRef<Map<string, number>>(new Map());
  const appInterfacesCache = useRef<Map<string, ApplicationInterfacesNode>>(new Map());
  const interfaceFactSheetCache = useRef<Map<string, InterfaceFactSheet>>(new Map());

  const cacheInterfaceFactSheet = useCallback((fs: InterfaceFactSheet) => {
    interfaceFactSheetCache.current.set(
      fs.id,
      mergeInterfaceFactSheet(interfaceFactSheetCache.current.get(fs.id), fs),
    );
  }, []);

  const ensureAppInterfaces = useCallback(
    async (appId: string): Promise<ApplicationInterfacesNode | null> => {
      const cached = appInterfacesCache.current.get(appId);
      if (cached) return cached;
      const data = await fetchApplicationInterfaces(appId);
      if (!data) return null;
      appInterfacesCache.current.set(appId, data);
      for (const edge of data.relProviderApplicationToInterface?.edges ?? []) {
        if (edge.node.factSheet) cacheInterfaceFactSheet(edge.node.factSheet);
      }
      for (const edge of data.relConsumerApplicationToInterface?.edges ?? []) {
        if (edge.node.factSheet) cacheInterfaceFactSheet(edge.node.factSheet);
      }
      return data;
    },
    [cacheInterfaceFactSheet],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((current) => {
      const next = applyNodeChanges(changes, current);
      // Interface circles are draggable, but constrained to slide along
      // their provider's whole outline (all 4 sides, corners included) —
      // whatever raw position a drag frame produces, re-snap its center
      // onto the rectangle's perimeter every time. A no-op for any position
      // already on the outline (initial placement, or an untouched node).
      // The provider's *current* (possibly resized) width is looked up per
      // interface — never the default constant — so the constraint tracks
      // a rectangle that was just resized in the same gesture.
      const byId = new Map(next.map((n) => [n.id, n]));
      const half = INTERFACE_NODE_SIZE / 2;
      return next.map((n) => {
        if (n.type !== "interface") return n;
        const parent = n.parentId ? byId.get(n.parentId) : undefined;
        const parentWidth = parent ? boxSizeOf(parent).width : APP_NODE_WIDTH;
        const center = { x: n.position.x + half, y: n.position.y + half };
        const projected = projectPointToRectanglePerimeter(center, parentWidth, APP_NODE_HEIGHT);
        const position = { x: projected.x - half, y: projected.y - half };
        return position.x === n.position.x && position.y === n.position.y
          ? n
          : { ...n, position };
      });
    });
  }, []);

  /** Applies a resize gesture from `ApplicationNode`'s left/right handle:
   * clamps `proposedWidth` (floor `MIN_APP_NODE_WIDTH`, and never past a
   * currently-visible interface circle's center on that side — see the plan
   * for the derivation), then for the left edge only, shifts the rectangle's
   * own position and compensates every attached circle's relative position
   * by the same amount so nothing moves on screen except the border. */
  const handleResizeApplication = useCallback(
    (appId: string, edge: "left" | "right", proposedWidth: number) => {
      setNodes((current) => {
        const node = current.find((n) => n.id === appId);
        if (!node || node.type !== "application") return current;
        const oldWidth = (node.data as ApplicationNodeData).width ?? APP_NODE_WIDTH;
        const circleCenterXs = current
          .filter((n) => n.type === "interface" && interfaceProviderRef.current.get(n.id) === appId)
          .map((n) => n.position.x + INTERFACE_NODE_SIZE / 2);

        let newWidth: number;
        let growth = 0;
        if (edge === "right") {
          const minAllowed = Math.max(MIN_APP_NODE_WIDTH, 0, ...circleCenterXs);
          newWidth = Math.max(proposedWidth, minAllowed);
        } else {
          const minCenterX = circleCenterXs.length > 0 ? Math.min(...circleCenterXs) : Infinity;
          const minGrowth = Math.max(MIN_APP_NODE_WIDTH - oldWidth, -minCenterX);
          growth = Math.max(proposedWidth - oldWidth, minGrowth);
          newWidth = oldWidth + growth;
        }

        return current.map((n) => {
          if (n.id === appId) {
            return {
              ...n,
              position: growth !== 0 ? { ...n.position, x: n.position.x - growth } : n.position,
              data: { ...n.data, width: newWidth },
            };
          }
          if (
            growth !== 0 &&
            n.type === "interface" &&
            interfaceProviderRef.current.get(n.id) === appId
          ) {
            return { ...n, position: { ...n.position, x: n.position.x + growth } };
          }
          return n;
        });
      });
    },
    [],
  );

  const makeApplicationNode = useCallback(
    (app: DiscoverApplicationNode, position: { x: number; y: number }, isRoot: boolean): Node => ({
      id: app.id,
      type: "application",
      position,
      data: {
        name: app.name,
        externalId: app.externalId,
        managerName: resolveManagerName(app.id) ?? app.managerName,
        isRoot,
        width: APP_NODE_WIDTH,
        onResize: (edge, proposedWidth) => handleResizeApplication(app.id, edge, proposedWidth),
      } satisfies ApplicationNodeData,
    }),
    [resolveManagerName, handleResizeApplication],
  );

  function makeInterfaceNode(
    iface: DiscoverInterfaceNode,
    position: { x: number; y: number },
    parentId: string,
  ): Node {
    return {
      id: iface.id,
      type: "interface",
      // Relative to `parentId` (its provider) — a xyflow child node, so it
      // moves on-screen together with the provider's own drag/position,
      // with no extra code needed here or in the drag handler.
      position,
      parentId,
      data: { name: iface.name, protocol: iface.protocol } satisfies InterfaceNodeData,
    };
  }

  /** Adds any not-yet-visible interfaces of `newInterfaces` around
   * `providerId`, each taking its own previous slot if that's still free,
   * otherwise the lowest free slot — never touching the position of
   * interfaces already visible for this provider (so hiding one and
   * re-running *Show API* doesn't reshuffle the ones still shown), and never
   * reusing a slot currently occupied by one of them (so a newly revealed
   * interface doesn't land on top of an existing one). Positions are
   * relative to the provider (xyflow child nodes), so none of this needs the
   * provider's own (possibly dragged) position. */
  const placeProviderInterfaces = useCallback(
    (current: Node[], providerId: string, newInterfaces: DiscoverInterfaceNode[]): Node[] => {
      const existingIds = new Set(current.map((n) => n.id));
      const toAdd = newInterfaces.filter((i) => !existingIds.has(i.id));
      if (toAdd.length === 0) return current;

      const provider = current.find((n) => n.id === providerId);
      const providerWidth = provider ? boxSizeOf(provider).width : APP_NODE_WIDTH;
      const usedSlots = new Set<number>();
      for (const n of current) {
        if (n.type === "interface" && interfaceProviderRef.current.get(n.id) === providerId) {
          const slot = interfaceSlotRef.current.get(n.id);
          if (slot !== undefined) usedSlots.add(slot);
        }
      }
      let nextFreeSlot = 0;
      const newNodes = toAdd.map((iface) => {
        interfaceProviderRef.current.set(iface.id, providerId);
        let slot = interfaceSlotRef.current.get(iface.id);
        if (slot === undefined || usedSlots.has(slot)) {
          while (usedSlots.has(nextFreeSlot)) nextFreeSlot++;
          slot = nextFreeSlot;
        }
        usedSlots.add(slot);
        interfaceSlotRef.current.set(iface.id, slot);
        return makeInterfaceNode(iface, interfaceSlotPosition(slot, providerWidth), providerId);
      });
      return [...current, ...newNodes];
    },
    [],
  );

  const addApplication = useCallback(
    (app: DiscoverApplicationNode) => {
      rootIdsRef.current.add(app.id);
      setNodes((current) => {
        const existingIndex = current.findIndex((n) => n.id === app.id);
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = {
            ...next[existingIndex],
            data: { ...next[existingIndex].data, isRoot: true },
          };
          return next;
        }
        if (current.length === 0) {
          // Trivial ELK layout for a single node: always the origin.
          return [makeApplicationNode(app, { x: 0, y: 0 }, true)];
        }
        const byId = new Map(current.map((n) => [n.id, n]));
        const anchor = absolutePosition(current[current.length - 1], byId);
        const position = placeNewApplicationNode(anchor, "right", boxesOf(current));
        return [...current, makeApplicationNode(app, position, true)];
      });
    },
    [makeApplicationNode],
  );

  /** One-shot batch seed from `/discover?ids=…`: fetch every selected
   * application's interfaces, keep only the relations internal to the
   * selection, run ELK once over the resulting application-level graph, and
   * commit nodes + edges in a single pass. Deliberately not expressed as N
   * `addApplication` calls — those place each new root to the right of the
   * previous one, which degenerates into an unreadable horizontal row. */
  /** Which selection has already been seeded, as a signature of its ids —
   * not a plain boolean. A discarded run (StrictMode's
   * mount→unmount→mount, where the first pass is cancelled mid-flight)
   * releases it so the second mount really does seed; a re-render carrying
   * the same ids (e.g. the catalogue refetching behind `RefreshButton`)
   * still matches, and never wipes what the user has explored since. */
  const seededRef = useRef<string | null>(null);
  useEffect(() => {
    if (!seed || seed.length === 0) return;
    const ids = seed.map((app) => app.id);
    const signature = ids.join(",");
    if (seededRef.current === signature) return;
    seededRef.current = signature;
    let cancelled = false;
    let committed = false;

    const run = async () => {
      const selectedIds = new Set(ids);
      setSeeding(true);
      try {
        const fetched = await fetchApplicationsInterfaces(ids);
        if (cancelled) return;

        // Same cache priming as `ensureAppInterfaces`, so the context menus
        // opened on a seeded node don't re-fetch what we already hold.
        for (const node of fetched) {
          appInterfacesCache.current.set(node.id, node);
          for (const edge of node.relProviderApplicationToInterface?.edges ?? []) {
            if (edge.node.factSheet) cacheInterfaceFactSheet(edge.node.factSheet);
          }
          for (const edge of node.relConsumerApplicationToInterface?.edges ?? []) {
            if (edge.node.factSheet) cacheInterfaceFactSheet(edge.node.factSheet);
          }
        }

        const { interfaces, edges } = toInternalRelations(fetched, selectedIds);
        const byProvider = new Map<string, DiscoverInterfaceNode[]>();
        const providerOf = new Map<string, string>();
        for (const iface of interfaces) {
          providerOf.set(iface.id, iface.providerId);
          const list = byProvider.get(iface.providerId);
          if (list) list.push(iface);
          else byProvider.set(iface.providerId, [iface]);
        }

        // ELK lays out applications only: the circles are xyflow children of
        // their provider, so they're placed afterward, in relative coords.
        // Hence consumer → provider edges, not consumer → interface ones.
        const positions = await layoutRootApplications(
          ids,
          edges.map((e) => ({
            id: e.id,
            source: e.consumerId,
            target: providerOf.get(e.interfaceId) ?? e.consumerId,
          })),
        );
        if (cancelled) return;

        for (const id of ids) rootIdsRef.current.add(id);
        setNodes(() => {
          let next = seed.map((app) =>
            makeApplicationNode(app, positions.get(app.id) ?? { x: 0, y: 0 }, true),
          );
          for (const [providerId, providerInterfaces] of byProvider) {
            next = placeProviderInterfaces(next, providerId, providerInterfaces);
          }
          return next;
        });
        setEdgeMeta(edges);
        committed = true;
        // `fitView` as a prop only runs at mount, before the seed lands.
        requestAnimationFrame(() => flowRef.current?.fitView({ maxZoom: 1 }));
      } catch (e) {
        if (cancelled) return;
        setSeedError(e instanceof Error ? e.message : String(e));
        // The rectangles still belong on screen — only their relations
        // failed to load; fall back to the edgeless packing.
        const packed = await layoutRootApplications(ids).catch(
          () => new Map<string, { x: number; y: number }>(),
        );
        if (cancelled) return;
        for (const id of ids) rootIdsRef.current.add(id);
        setNodes(
          seed.map((app) => makeApplicationNode(app, packed.get(app.id) ?? { x: 0, y: 0 }, true)),
        );
        committed = true;
        requestAnimationFrame(() => flowRef.current?.fitView({ maxZoom: 1 }));
      } finally {
        if (!cancelled) setSeeding(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (!committed) seededRef.current = null;
    };
  }, [seed, makeApplicationNode, placeProviderInterfaces, cacheInterfaceFactSheet]);

  const removeApplication = useCallback((id: string) => {
    rootIdsRef.current.delete(id);
    const remainingIds = new Set(nodesRef.current.map((n) => n.id).filter((nid) => nid !== id));
    const adjacency = new Map<string, Set<string>>();
    const link = (a: string, b: string) => {
      if (!adjacency.has(a)) adjacency.set(a, new Set());
      if (!adjacency.has(b)) adjacency.set(b, new Set());
      adjacency.get(a)!.add(b);
      adjacency.get(b)!.add(a);
    };
    for (const [ifaceId, providerId] of interfaceProviderRef.current) link(ifaceId, providerId);
    for (const e of edgeMetaRef.current) link(e.interfaceId, e.consumerId);
    const visited = new Set<string>();
    const queue = [...rootIdsRef.current].filter((rid) => remainingIds.has(rid));
    for (const rid of queue) visited.add(rid);
    while (queue.length) {
      const current = queue.shift()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (remainingIds.has(neighbor) && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    setNodes((current) => current.filter((n) => n.id !== id && visited.has(n.id)));
    setEdgeMeta((current) =>
      current.filter((e) => visited.has(e.consumerId) && visited.has(e.interfaceId)),
    );
  }, []);

  const handleShowInterfacesInbound = useCallback(
    async (appId: string) => {
      setContextMenu(null);
      const data = await ensureAppInterfaces(appId);
      if (!data) return;
      const interfaces = toInboundInterfaces(data);
      setNodes((current) => placeProviderInterfaces(current, appId, interfaces));
    },
    [ensureAppInterfaces, placeProviderInterfaces],
  );

  const handleShowInterfacesOutbound = useCallback(
    async (appId: string) => {
      setContextMenu(null);
      const data = await ensureAppInterfaces(appId);
      if (!data) return;
      const { interfaces, providers, edges } = toOutboundInterfacesAndProviders(data);

      setNodes((current) => {
        let next = current;
        const existingIds = new Set(next.map((n) => n.id));
        const anchor = next.find((n) => n.id === appId)?.position ?? { x: 0, y: 0 };
        let cursor = anchor;
        for (const provider of providers) {
          if (existingIds.has(provider.id)) continue;
          const position = placeNewApplicationNode(cursor, "left", boxesOf(next));
          next = [...next, makeApplicationNode(provider, position, false)];
          existingIds.add(provider.id);
          cursor = position;
        }
        const byProvider = new Map<string, DiscoverInterfaceNode[]>();
        for (const iface of interfaces) {
          if (existingIds.has(iface.id)) continue;
          if (!byProvider.has(iface.providerId)) byProvider.set(iface.providerId, []);
          byProvider.get(iface.providerId)!.push(iface);
        }
        for (const [providerId, ifaces] of byProvider) {
          next = placeProviderInterfaces(next, providerId, ifaces);
        }
        return next;
      });

      setEdgeMeta((current) => {
        const existingIds = new Set(current.map((e) => e.id));
        return [...current, ...edges.filter((e) => !existingIds.has(e.id))];
      });
    },
    [ensureAppInterfaces, makeApplicationNode, placeProviderInterfaces],
  );

  const revealInterfaceDependencies = useCallback(
    async (ifaceId: string) => {
      let fs = interfaceFactSheetCache.current.get(ifaceId);
      if (!fs || !fs.relInterfaceToConsumerApplication || !fs.relInterfaceToProviderApplication) {
        const fetched = await fetchInterfaceDependencies(ifaceId);
        if (fetched) {
          cacheInterfaceFactSheet(fetched);
          fs = interfaceFactSheetCache.current.get(ifaceId);
        }
      }
      if (!fs) return;
      const { consumers, edges: newEdges } = toInterfaceConsumers(fs);
      const provider = toInterfaceProvider(fs);

      setNodes((current) => {
        let next = current;
        const existingIds = new Set(next.map((n) => n.id));
        const ifaceAnchor = () => {
          const byId = new Map(next.map((n) => [n.id, n]));
          const iface = byId.get(ifaceId);
          return iface ? absolutePosition(iface, byId) : { x: 0, y: 0 };
        };
        if (provider && !existingIds.has(provider.id)) {
          const position = placeNewApplicationNode(ifaceAnchor(), "left", boxesOf(next));
          next = [...next, makeApplicationNode(provider, position, false)];
          existingIds.add(provider.id);
          interfaceProviderRef.current.set(ifaceId, provider.id);
        }
        const missingConsumers = consumers.filter((c) => !existingIds.has(c.id));
        if (missingConsumers.length === 0) return next;
        let cursor = ifaceAnchor();
        const added: Node[] = [];
        for (const c of missingConsumers) {
          const position = placeNewApplicationNode(cursor, "right", boxesOf([...next, ...added]));
          added.push(makeApplicationNode(c, position, false));
          cursor = position;
        }
        return [...next, ...added];
      });

      setEdgeMeta((current) => {
        const existingIds = new Set(current.map((e) => e.id));
        return [...current, ...newEdges.filter((e) => !existingIds.has(e.id))];
      });
    },
    [cacheInterfaceFactSheet, makeApplicationNode],
  );

  const handleShowDependencies = useCallback(
    async (nodeId: string) => {
      setContextMenu(null);
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      if (node.type !== "application") {
        await revealInterfaceDependencies(nodeId);
        return;
      }
      const visibleIds = new Set(nodesRef.current.map((n) => n.id));
      const attached = new Set<string>();
      for (const [ifaceId, providerId] of interfaceProviderRef.current) {
        if (providerId === nodeId && visibleIds.has(ifaceId)) attached.add(ifaceId);
      }
      for (const e of edgeMetaRef.current) {
        if (e.consumerId === nodeId && visibleIds.has(e.interfaceId)) attached.add(e.interfaceId);
      }
      for (const ifaceId of attached) {
        await revealInterfaceDependencies(ifaceId);
      }
    },
    [revealInterfaceDependencies],
  );

  const handleHide = useCallback(
    (nodeId: string) => {
      setContextMenu(null);
      const node = nodesRef.current.find((n) => n.id === nodeId);
      if (!node) return;
      if (node.type === "application") {
        if (rootIdsRef.current.has(nodeId)) {
          // A selected root: hiding it is the same operation as removing its
          // chip (drops the node, then prunes whatever it was anchoring), plus
          // telling the parent to drop the chip itself.
          removeApplication(nodeId);
          onApplicationHidden?.(nodeId);
          return;
        }
        const ownedInterfaceIds = new Set(
          [...interfaceProviderRef.current.entries()]
            .filter(([, providerId]) => providerId === nodeId)
            .map(([ifaceId]) => ifaceId),
        );
        for (const id of ownedInterfaceIds) interfaceProviderRef.current.delete(id);
        setNodes((current) =>
          current.filter((n) => n.id !== nodeId && !ownedInterfaceIds.has(n.id)),
        );
        setEdgeMeta((current) =>
          current.filter((e) => e.consumerId !== nodeId && !ownedInterfaceIds.has(e.interfaceId)),
        );
      } else {
        interfaceProviderRef.current.delete(nodeId);
        setNodes((current) => current.filter((n) => n.id !== nodeId));
        setEdgeMeta((current) => current.filter((e) => e.interfaceId !== nodeId));
      }
    },
    [removeApplication, onApplicationHidden],
  );

  /** Reads refs only — `nodesRef`/`edgeMetaRef` are re-synced on every render
   * — so it never needs to be rebuilt, and the handle's identity stays put. */
  const snapshot = useCallback((): DiscoverGraphSnapshot => {
    const current = nodesRef.current;
    const present = new Set(current.map((n) => n.id));
    const byId = new Map(current.map((n) => [n.id, n]));
    const providerOf = (interfaceId: string) => byId.get(interfaceId)?.parentId;
    return {
      applications: current
        .filter((n) => n.type === "application")
        .map((n) => {
          const data = n.data as unknown as ApplicationNodeData;
          return {
            id: n.id,
            name: data.name,
            externalId: data.externalId,
            // `rootIdsRef`, not `data.isRoot`: the ref is the live set of
            // selected applications, while `data.isRoot` was frozen when the
            // node was built.
            isRoot: rootIdsRef.current.has(n.id),
          };
        }),
      // Nothing to describe in the simplified view — the circles aren't there.
      interfaces: simplified
        ? []
        : current
            .filter((n) => n.type === "interface")
            .map((n) => {
              const data = n.data as unknown as InterfaceNodeData;
              return {
                id: n.id,
                name: data.name,
                protocol: data.protocol,
                providerId: interfaceProviderRef.current.get(n.id) ?? n.parentId ?? "",
              };
            }),
      // `edgeMeta` is the model; the `edges` memo below is geometry. Folded
      // through the same helper the canvas uses, so the export and the screen
      // can't disagree. Both ends re-checked so a pruning race can't leave a
      // dangling link.
      edges: simplified
        ? collapseToApplications(edgeMetaRef.current, providerOf).filter(
            (e) => present.has(e.sourceId) && present.has(e.targetId),
          )
        : edgeMetaRef.current
            .filter((e) => present.has(e.consumerId) && present.has(e.interfaceId))
            .map((e) => ({ sourceId: e.consumerId, targetId: e.interfaceId })),
    };
  }, [simplified]);

  useImperativeHandle(ref, () => ({ addApplication, removeApplication, snapshot }), [
    addApplication,
    removeApplication,
    snapshot,
  ]);

  /** What xyflow renders. `nodes` stays the full set: geometry and edges are
   * derived from it, and folding links needs the interfaces the simplified
   * view doesn't draw. Dropping child nodes while keeping their parent is
   * safe; the reverse wouldn't be. */
  const visibleNodes = useMemo(
    () => (simplified ? nodes.filter((n) => n.type !== "interface") : nodes),
    [nodes, simplified],
  );

  const edges = useMemo<Edge[]>(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));

    if (simplified) {
      // Grouped by *unordered* pair so that A → B and B → A bend apart
      // instead of landing on the exact same line.
      const drawnPerPair = new Map<string, number>();
      const result: Edge[] = [];
      const collapsed = collapseToApplications(
        edgeMeta,
        (interfaceId) => byId.get(interfaceId)?.parentId,
      );
      // Counting pass first: an edge needs to know whether it has a twin at
      // the moment it is built, and `drawnPerPair` only fills in as we go.
      const totalPerPair = new Map<string, number>();
      for (const { sourceId, targetId } of collapsed) {
        const pair = [sourceId, targetId].sort().join("|");
        totalPerPair.set(pair, (totalPerPair.get(pair) ?? 0) + 1);
      }
      for (const { sourceId, targetId } of collapsed) {
        const source = byId.get(sourceId);
        const target = byId.get(targetId);
        if (!source || !target) continue;
        const pair = [sourceId, targetId].sort().join("|");
        const rank = drawnPerPair.get(pair) ?? 0;
        drawnPerPair.set(pair, rank + 1);
        const sourceCenter = centerOf(source, byId);
        const targetCenter = centerOf(target, byId);
        const from = trimToBorder(sourceCenter, targetCenter, boxSizeOf(source));
        const to = trimToBorder(targetCenter, sourceCenter, boxSizeOf(target));
        result.push({
          id: `${sourceId}->${targetId}`,
          source: sourceId,
          target: targetId,
          type: "graphEdge",
          data: {
            sx: from.x,
            sy: from.y,
            tx: to.x,
            ty: to.y,
            bend: rank % 2 === 0 ? 1 : -1,
            parallel: (totalPerPair.get(pair) ?? 1) > 1,
          } satisfies GraphEdgeData,
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent)" },
          style: { stroke: "var(--color-accent)" },
        });
      }
      return result;
    }

    const byInterface = new Map<string, DiscoverEdge[]>();
    for (const e of edgeMeta) {
      if (!byInterface.has(e.interfaceId)) byInterface.set(e.interfaceId, []);
      byInterface.get(e.interfaceId)!.push(e);
    }
    const result: Edge[] = [];
    for (const group of byInterface.values()) {
      group.forEach((e, i) => {
        const source = byId.get(e.consumerId);
        const target = byId.get(e.interfaceId);
        if (!source || !target) return;
        const sourceCenter = centerOf(source, byId);
        const targetCenter = centerOf(target, byId);
        const from = trimToBorder(sourceCenter, targetCenter, boxSizeOf(source));
        const to = trimToBorder(targetCenter, sourceCenter, boxSizeOf(target));
        result.push({
          id: e.id,
          source: e.consumerId,
          target: e.interfaceId,
          type: "graphEdge",
          data: {
            sx: from.x,
            sy: from.y,
            tx: to.x,
            ty: to.y,
            bend: i % 2 === 0 ? 1 : -1,
            parallel: group.length > 1,
          } satisfies GraphEdgeData,
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent)" },
          style: { stroke: "var(--color-accent)" },
        });
      });
    }
    return result;
  }, [nodes, edgeMeta, simplified]);

  /** For an Application: `shown` is the number of distinct consumer apps
   * already displayed on the graph (an edge is drawn to them from one of
   * this app's provider interfaces); `total` is the number of distinct
   * consumer apps that could be displayed, across every interface this app
   * provides — shown or not. Requires `appInterfacesCache`/
   * `interfaceFactSheetCache` to already hold this app's data (populated by
   * `ensureAppInterfaces`); `null` means "not fetched yet" — the caller
   * decides whether to trigger a fetch. `total` itself can come back `-1`
   * (unknown) if a provided interface's own factsheet isn't cached yet. */
  const consumerCountsForApplication = useCallback(
    (appId: string): { shown: number; total: number } | null => {
      const cached = appInterfacesCache.current.get(appId);
      if (!cached) return null;
      const shownConsumers = new Set<string>();
      const totalConsumers = new Set<string>();
      let totalKnown = true;
      for (const iface of toInboundInterfaces(cached)) {
        const fs = interfaceFactSheetCache.current.get(iface.id);
        if (!fs) {
          totalKnown = false;
          continue;
        }
        for (const consumer of toInterfaceConsumers(fs).consumers) {
          totalConsumers.add(consumer.id);
          const edgeVisible = edgeMetaRef.current.some(
            (e) => e.interfaceId === iface.id && e.consumerId === consumer.id,
          );
          if (edgeVisible) shownConsumers.add(consumer.id);
        }
      }
      return { shown: shownConsumers.size, total: totalKnown ? totalConsumers.size : -1 };
    },
    [],
  );

  /** Same idea for a single Interface circle — there is only ever one
   * interface involved, so `total` is simply its full consumer list. */
  const consumerCountsForInterface = useCallback(
    (ifaceId: string): { shown: number; total: number } | null => {
      const fs = interfaceFactSheetCache.current.get(ifaceId);
      if (!fs || !fs.relInterfaceToConsumerApplication) return null;
      const consumers = toInterfaceConsumers(fs).consumers;
      const shown = consumers.filter((c) =>
        edgeMetaRef.current.some((e) => e.interfaceId === ifaceId && e.consumerId === c.id),
      ).length;
      return { shown, total: consumers.length };
    },
    [],
  );

  /** For an Application: `shown` is the number of distinct provider apps
   * already displayed on the graph (an interface it consumes, together with
   * that interface's provider, is always revealed as a pair by
   * `handleShowInterfacesOutbound` — so a consumed interface being visible
   * implies its provider is too); `total` is the number of distinct provider
   * apps across every interface this app consumes — shown or not. Unlike
   * `consumerCountsForApplication`, the provider of each consumed interface
   * is already nested in the same cached `ApplicationInterfacesNode`
   * (`toOutboundInterfacesAndProviders`), so there's no partial-data case —
   * `total` is never `-1` once `cached` exists. */
  const providerCountsForApplication = useCallback(
    (appId: string): { shown: number; total: number } | null => {
      const cached = appInterfacesCache.current.get(appId);
      if (!cached) return null;
      const visibleIds = new Set(nodesRef.current.map((n) => n.id));
      const { interfaces, providers } = toOutboundInterfacesAndProviders(cached);
      const shownProviders = new Set<string>();
      const totalProviders = new Set<string>();
      interfaces.forEach((iface, idx) => {
        const providerId = providers[idx].id;
        totalProviders.add(providerId);
        if (visibleIds.has(iface.id)) shownProviders.add(providerId);
      });
      return { shown: shownProviders.size, total: totalProviders.size };
    },
    [],
  );

  /** Same idea for "Show API": `shown` counts this app's own provided
   * interfaces already displayed as circles, `total` counts all of them —
   * no second hop to another FactSheet type, so (like
   * `providerCountsForApplication`) `total` is never `-1` once `cached`
   * exists. */
  const apiCountsForApplication = useCallback(
    (appId: string): { shown: number; total: number } | null => {
      const cached = appInterfacesCache.current.get(appId);
      if (!cached) return null;
      const visibleIds = new Set(nodesRef.current.map((n) => n.id));
      const interfaces = toInboundInterfaces(cached);
      const shown = interfaces.filter((i) => visibleIds.has(i.id)).length;
      return { shown, total: interfaces.length };
    },
    [],
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, n: Node) => {
      event.preventDefault();
      const rect = containerRef.current?.getBoundingClientRect();
      const x = event.clientX - (rect?.left ?? 0);
      const y = event.clientY - (rect?.top ?? 0);

      if (n.type === "application") {
        const cached = appInterfacesCache.current.get(n.id);
        const apiCounts = apiCountsForApplication(n.id);
        const consumerCounts = consumerCountsForApplication(n.id);
        const providerCounts = providerCountsForApplication(n.id);
        setContextMenu({
          nodeId: n.id,
          x,
          y,
          variant: "application",
          apiShown: apiCounts?.shown ?? -1,
          apiTotal: apiCounts?.total ?? -1,
          consumersShown: consumerCounts?.shown ?? -1,
          consumersTotal: consumerCounts?.total ?? -1,
          providersShown: providerCounts?.shown ?? -1,
          providersTotal: providerCounts?.total ?? -1,
        });
        if (!cached) {
          // Not fetched yet — go get it, then refresh the menu in place if
          // it's still open on this same node.
          void ensureAppInterfaces(n.id).then(() => {
            setContextMenu((current) => {
              if (!current || current.nodeId !== n.id || current.variant !== "application") {
                return current;
              }
              const refreshedApiCounts = apiCountsForApplication(n.id);
              const refreshedConsumerCounts = consumerCountsForApplication(n.id);
              const refreshedProviderCounts = providerCountsForApplication(n.id);
              return {
                ...current,
                apiShown: refreshedApiCounts?.shown ?? current.apiShown,
                apiTotal: refreshedApiCounts?.total ?? current.apiTotal,
                consumersShown: refreshedConsumerCounts?.shown ?? current.consumersShown,
                consumersTotal: refreshedConsumerCounts?.total ?? current.consumersTotal,
                providersShown: refreshedProviderCounts?.shown ?? current.providersShown,
                providersTotal: refreshedProviderCounts?.total ?? current.providersTotal,
              };
            });
          });
        }
      } else {
        const consumerCounts = consumerCountsForInterface(n.id);
        setContextMenu({
          nodeId: n.id,
          x,
          y,
          variant: "interface",
          apiShown: 0,
          apiTotal: 0,
          consumersShown: consumerCounts?.shown ?? -1,
          consumersTotal: consumerCounts?.total ?? -1,
          providersShown: 0,
          providersTotal: 0,
        });
        if (!consumerCounts) {
          void fetchInterfaceDependencies(n.id).then((fetched) => {
            if (fetched) cacheInterfaceFactSheet(fetched);
            setContextMenu((current) => {
              if (!current || current.nodeId !== n.id || current.variant !== "interface") {
                return current;
              }
              const refreshedCounts = consumerCountsForInterface(n.id);
              return {
                ...current,
                consumersShown: refreshedCounts?.shown ?? current.consumersShown,
                consumersTotal: refreshedCounts?.total ?? current.consumersTotal,
              };
            });
          });
        }
      }
    },
    [
      apiCountsForApplication,
      consumerCountsForApplication,
      consumerCountsForInterface,
      providerCountsForApplication,
      ensureAppInterfaces,
      cacheInterfaceFactSheet,
    ],
  );

  /** Same DOM-class trace technique as `/depgraph`'s `DependencyGraph.tsx`
   * (`.rf-dim`/`.rf-emph`, toggled directly on React Flow's own elements via
   * its `data-id` convention, not React state) — but pinned by a **click**
   * instead of hover, and cleared by clicking the same node again or
   * clicking empty canvas (`onPaneClick`). Which nodes/edges stay
   * highlighted depends on what was clicked:
   * - an Interface: itself, its provider, its consumers, and the edges to
   *   those consumers.
   * - an Application: itself, every currently-visible interface it's
   *   attached to (as provider or consumer), the consumers of the
   *   interfaces it provides, the providers of the interfaces it consumes,
   *   and every edge among those. */
  const highlightedNodeIdRef = useRef<string | null>(null);

  const clearHighlight = useCallback(() => {
    containerRef.current
      ?.querySelectorAll(".rf-dim, .rf-emph")
      .forEach((el) => el.classList.remove("rf-dim", "rf-emph"));
    highlightedNodeIdRef.current = null;
  }, []);

  const applyHighlight = useCallback((nodeId: string) => {
    const root = containerRef.current;
    if (!root) return;
    const connected = new Set<string>([nodeId]);
    const emphasizedEdgeIds = new Set<string>();

    const node = nodesRef.current.find((n) => n.id === nodeId);
    if (node?.type === "interface") {
      const provider = interfaceProviderRef.current.get(nodeId);
      if (provider) connected.add(provider);
      for (const e of edgeMetaRef.current) {
        if (e.interfaceId === nodeId) {
          connected.add(e.consumerId);
          emphasizedEdgeIds.add(e.id);
        }
      }
    } else {
      const ownedInterfaceIds = new Set(
        [...interfaceProviderRef.current.entries()]
          .filter(([, providerId]) => providerId === nodeId)
          .map(([ifaceId]) => ifaceId),
      );
      for (const ifaceId of ownedInterfaceIds) connected.add(ifaceId);
      for (const e of edgeMetaRef.current) {
        if (ownedInterfaceIds.has(e.interfaceId)) {
          // An interface this app provides: highlight its consumers too.
          connected.add(e.consumerId);
          emphasizedEdgeIds.add(e.id);
        }
        if (e.consumerId === nodeId) {
          // An interface this app consumes: highlight it and its provider.
          connected.add(e.interfaceId);
          const provider = interfaceProviderRef.current.get(e.interfaceId);
          if (provider) connected.add(provider);
          emphasizedEdgeIds.add(e.id);
        }
      }
    }

    root.querySelectorAll<HTMLElement>(".react-flow__node").forEach((el) => {
      const id = el.dataset.id;
      el.classList.toggle("rf-dim", !!id && !connected.has(id));
    });
    root.querySelectorAll<SVGElement>(".react-flow__edge").forEach((el) => {
      const id = el.dataset.id;
      const isEmphasized = !!id && emphasizedEdgeIds.has(id);
      el.classList.toggle("rf-dim", !isEmphasized);
      el.classList.toggle("rf-emph", isEmphasized);
    });
    highlightedNodeIdRef.current = nodeId;
  }, []);

  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      // A click on the info icon stops propagation before it ever reaches
      // here (see `ApplicationNode.tsx`), so this only ever runs for a
      // click on the rectangle/circle itself — closing an open info card is
      // correct in every such case ("click elsewhere", decision).
      closeApplicationInfo();
      if (highlightedNodeIdRef.current === node.id) {
        clearHighlight();
      } else {
        applyHighlight(node.id);
      }
    },
    [applyHighlight, clearHighlight, closeApplicationInfo],
  );

  const handlePaneClick = useCallback(() => {
    clearHighlight();
    closeApplicationInfo();
  }, [clearHighlight, closeApplicationInfo]);

  return (
    <ApplicationInfoContext.Provider value={applicationInfoValue}>
      <div ref={containerRef} className="relative h-full w-full">
        <ReactFlow
          nodes={visibleNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable={false}
          deleteKeyCode={null}
          // xyflow's default floor is 0.5, which clamps `fitView` as soon as
          // the canvas holds a few hundred applications — the seed from a
          // whole unfiltered catalogue never fits on screen at that zoom.
          minZoom={0.02}
          fitView
          fitViewOptions={{ maxZoom: 1 }}
          onInit={(instance) => {
            flowRef.current = instance;
          }}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={onNodeContextMenu}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
        {seeding && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-mono text-muted shadow-lg">
            Loading relations…
          </div>
        )}
        {seedError && (
          <div className="absolute left-1/2 top-3 z-10 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded border border-danger/40 bg-surface px-3 py-2 text-xs text-danger shadow-lg">
            <span className="truncate">Could not load the relations: {seedError}</span>
            <button
              type="button"
              onClick={() => setSeedError(null)}
              className="shrink-0 text-muted hover:text-fg"
            >
              Dismiss
            </button>
          </div>
        )}
        <NodeContextMenu
          target={contextMenu}
          onClose={() => setContextMenu(null)}
          onShowInterfacesInbound={handleShowInterfacesInbound}
          onShowInterfacesOutbound={handleShowInterfacesOutbound}
          onShowDependencies={handleShowDependencies}
          onHide={handleHide}
          simplified={simplified}
        />
      </div>
    </ApplicationInfoContext.Provider>
  );
});

export default DiscoverGraph;
