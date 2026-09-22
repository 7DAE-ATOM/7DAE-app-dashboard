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
  toDiagramRelations,
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
import { boundsOf, captureViewport, overlayBoxes } from "@/lib/discoverImageExport";
import { useDiscoverViewMode } from "@/lib/discoverViewMode";
import { useDiscoverDisplaySettings } from "@/lib/discoverDisplaySettings";
import {
  getAllEdgeCurvatures,
  pruneEdgeCurvature,
  setEdgeCurvatures,
  subscribeEdgeCurvatureChange,
} from "@/lib/discoverEdgeCurvature";
import type { DiscoverDiagramSave } from "@/lib/discoverDiagramSaves";
import {
  applicationMatches,
  matchesAxis,
  type AxisHighlightSelection,
} from "@/lib/discoverHighlight";
import {
  publishCanvasContents,
  resetCanvasContents,
  type CanvasContents,
  type CanvasInterface,
} from "@/lib/discoverCanvasContents";

const nodeTypes = { application: ApplicationNodeComponent, interface: InterfaceNodeComponent };
const edgeTypes = { graphEdge: GraphEdge };

export type DiscoverGraphHandle = {
  addApplication: (app: DiscoverApplicationNode) => void;
  removeApplication: (id: string) => void;
  /** What is on the canvas right now, in plain data — the graph's topology
   * lives here, so an exporter has no other way to reach it. Read-only: it
   * moves, refits and selects nothing. */
  snapshot: () => DiscoverGraphSnapshot;
  /** The diagram as a save holds it: ids and layout, nothing from the
   * repository. Distinct from `snapshot()` on purpose — that one serves the
   * exports, follows the view mode and **drops the whole interface layer in
   * the simplified view**, so a diagram saved through it would come back
   * gutted. This one reads the refs and ignores the mode. `null` when the
   * canvas is empty. */
  getDiagram: () => DiscoverDiagramContent | null;
  /** Push the highlight panel's selection, `null` to drop it. Imperative on
   * purpose: painting classes must not cost a React render of the graph.
   * Returns nothing — a match count would go stale the moment a node is added
   * or hidden, and the panel computes its own from the published canvas. */
  setAxisHighlight: (selection: AxisHighlightSelection | null) => void;
  /** Renders the canvas to an image. Read-only like `snapshot`: the capture
   * works on a clone, so the on-screen zoom and pan are untouched. */
  exportImage: (format: "png" | "svg") => Promise<Blob>;
  /** How many displayed applications would have to be queried by
   * `connectVisibleFlows` — everything else is already cached. Synchronous,
   * so the toolbar can decide whether to warn before starting. */
  applicationsToQuery: () => number;
  /** Draws every flow that exists between the applications already on the
   * canvas and isn't drawn yet. Adds interfaces and flows, **never** an
   * application. `incomplete` when the repository didn't return everything
   * asked for, so the caller can say the result may be partial. */
  connectVisibleFlows: () => Promise<{ flows: number; incomplete: boolean }>;
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
  /** A diagram to draw, with its applications already resolved against the
   * catalogue by the parent. Owned by the parent (which owns the Save/Load
   * UI) and handed over as a prop rather than through the imperative handle,
   * for the same reason as `seed`: applying it needs a fetch, and the parent
   * must be able to report the outcome. */
  pendingLoad?: PendingDiagramLoad | null;
  /** The load is over: `null` on success, a message otherwise. The parent
   * clears `pendingLoad` and settles the active-save state on this. */
  onLoadSettled?: (error: string | null) => void;
  /** The diagram drifted from the state that was last saved. Only ever
   * reports the dirty direction — the parent owns the way back to clean
   * (a save, a load, a selection change). */
  onDirty?: () => void;
};

/** What `getDiagram` yields and `pendingLoad` carries: the save's payload
 * minus its envelope (`version`, `savedAt`), which is the storage layer's. */
export type DiscoverDiagramContent = Omit<DiscoverDiagramSave, "version" | "savedAt">;

export type PendingDiagramLoad = {
  content: DiscoverDiagramContent;
  /** Resolved by the parent from the catalogue — ids that no longer resolve
   * are already dropped here, so the graph never has to know about it. */
  applications: DiscoverApplicationNode[];
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
): { sourceId: string; targetId: string; interfaceIds: string[] }[] {
  const byPair = new Map<string, { sourceId: string; targetId: string; interfaceIds: string[] }>();
  const result: { sourceId: string; targetId: string; interfaceIds: string[] }[] = [];
  for (const e of edgeMeta) {
    const targetId = providerOf(e.interfaceId);
    if (!targetId || targetId === e.consumerId) continue;
    const key = `${e.consumerId}|${targetId}`;
    const existing = byPair.get(key);
    if (existing) {
      // Which interfaces a folded flow stands for: the arrow has to carry
      // the union of what they transport (see the `edges` memo).
      if (!existing.interfaceIds.includes(e.interfaceId)) {
        existing.interfaceIds.push(e.interfaceId);
      }
      continue;
    }
    const entry = { sourceId: e.consumerId, targetId, interfaceIds: [e.interfaceId] };
    byPair.set(key, entry);
    result.push(entry);
  }
  return result;
}

/**
 * The DOM id of the edge drawn for `e` — not the same in both views. The
 * complex view draws one edge per relation (`e.id`); the simplified one folds
 * them into `consumer -> provider` (see the `edges` memo, which is the only
 * other place that spells this out). `null` when nothing is drawn at all,
 * which is the self-consumption case `collapseToApplications` skips.
 */
function edgeDomId(
  e: DiscoverEdge,
  simplified: boolean,
  providerOf: (interfaceId: string) => string | undefined,
): string | null {
  if (!simplified) return e.id;
  const providerId = providerOf(e.interfaceId);
  if (!providerId || providerId === e.consumerId) return null;
  return `${e.consumerId}->${providerId}`;
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
  {
    resolveManagerName,
    resolveApplication,
    seed,
    onApplicationHidden,
    pendingLoad,
    onLoadSettled,
    onDirty,
  },
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
  // Identity cards are **pinned**: as many as the user opens stay open, and
  // only their own cross closes them. Hence one set per kind rather than a
  // single piece of state — comparing several nodes side by side is the whole
  // point of opening more than one.
  const [openApplicationIds, setOpenApplicationIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [openInterfaceIds, setOpenInterfaceIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const { showInfoIcons, boxWidth } = useDiscoverDisplaySettings();
  /** Read by callbacks that must not be rebuilt on every tick of the Box
   * width slider — `makeApplicationNode`'s per-node `onResize` closure above
   * all, whose identity is baked into every application node's data. */
  const boxWidthRef = useRef(boxWidth);
  boxWidthRef.current = boxWidth;
  const containerRef = useRef<HTMLDivElement>(null);
  /** Captured via `onInit` instead of `useReactFlow()` so the component
   * doesn't have to be split around a `ReactFlowProvider` just to re-fit the
   * view after the batch seed lands (the `fitView` prop is mount-only). */
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const closeAllInfo = useCallback(() => {
    setOpenApplicationIds((current) => (current.size === 0 ? current : new Set()));
    setOpenInterfaceIds((current) => (current.size === 0 ? current : new Set()));
  }, []);

  /** Add/remove one id, keeping the reference stable when nothing changes so
   * the context value doesn't churn. */
  function toggleIn(current: ReadonlySet<string>, id: string): ReadonlySet<string> {
    const next = new Set(current);
    if (!next.delete(id)) next.add(id);
    return next;
  }

  const toggleApplicationInfo = useCallback(
    (id: string) => setOpenApplicationIds((current) => toggleIn(current, id)),
    [],
  );
  const toggleInterfaceInfo = useCallback(
    (id: string) => setOpenInterfaceIds((current) => toggleIn(current, id)),
    [],
  );
  const closeApplicationCard = useCallback((id: string) => {
    setOpenApplicationIds((current) =>
      current.has(id) ? toggleIn(current, id) : current,
    );
  }, []);
  const closeInterfaceCard = useCallback((id: string) => {
    setOpenInterfaceIds((current) => (current.has(id) ? toggleIn(current, id) : current));
  }, []);

  const applicationInfoValue = useMemo(
    () => ({
      openApplicationIds,
      openInterfaceIds,
      toggle: toggleApplicationInfo,
      toggleInterface: toggleInterfaceInfo,
      closeApplication: closeApplicationCard,
      closeInterface: closeInterfaceCard,
      resolveApplication,
    }),
    [
      openApplicationIds,
      openInterfaceIds,
      toggleApplicationInfo,
      toggleInterfaceInfo,
      closeApplicationCard,
      closeInterfaceCard,
      resolveApplication,
    ],
  );

  const anyInfoOpen = openApplicationIds.size > 0 || openInterfaceIds.size > 0;

  /** Escape stays the one bulk dismissal. A card is otherwise closed only by
   * its own cross — clicking the canvas, a node, or another info icon leaves
   * every open card exactly where it is. */
  useEffect(() => {
    if (!anyInfoOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAllInfo();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anyInfoOpen, closeAllInfo]);

  // Hiding the info icons disables the feature, it doesn't merely hide it: the
  // nodes stop rendering the cards on their own, but without this the ids would
  // linger and the cards would pop back the moment the icons return.
  useEffect(() => {
    if (!showInfoIcons) closeAllInfo();
  }, [showInfoIcons, closeAllInfo]);

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

  /** Both async writers of the whole canvas — the batch seed and a diagram
   * load — commit with *replacing* updaters. Whichever was requested last
   * must win, or a seed resolving after a load would silently overwrite it
   * (and leak its roots into `rootIdsRef`, which it fills additively). Each
   * takes a generation on entry and drops its results if the number moved. */
  const contentGenRef = useRef(0);
  /** Set as soon as a load is requested: the seed is the catalogue's opening
   * proposal, and an explicitly loaded diagram outranks it for good. */
  const loadRequestedRef = useRef(false);
  /** Distinguishes a programmatic reset (initial layout, load) from a user
   * edit, for the parent's "unsaved changes" indicator. Same device as
   * `/depgraph`'s `DependencyGraph`. */
  const isBaselineUpdateRef = useRef(false);

  const cacheInterfaceFactSheet = useCallback((fs: InterfaceFactSheet) => {
    interfaceFactSheetCache.current.set(
      fs.id,
      mergeInterfaceFactSheet(interfaceFactSheetCache.current.get(fs.id), fs),
    );
  }, []);

  /** Files one application's interfaces away, both its own entry and every
   * interface fact sheet the response carried. Single- and multi-application
   * queries share the same GraphQL text, so an entry cached here from one is
   * interchangeable with an entry from the other — which is what lets the
   * batch fetches below skip whatever a context menu has already loaded. */
  const cacheApplicationInterfaces = useCallback(
    (data: ApplicationInterfacesNode) => {
      appInterfacesCache.current.set(data.id, data);
      for (const edge of data.relProviderApplicationToInterface?.edges ?? []) {
        if (edge.node.factSheet) cacheInterfaceFactSheet(edge.node.factSheet);
      }
      for (const edge of data.relConsumerApplicationToInterface?.edges ?? []) {
        if (edge.node.factSheet) cacheInterfaceFactSheet(edge.node.factSheet);
      }
    },
    [cacheInterfaceFactSheet],
  );

  const ensureAppInterfaces = useCallback(
    async (appId: string): Promise<ApplicationInterfacesNode | null> => {
      const cached = appInterfacesCache.current.get(appId);
      if (cached) return cached;
      const data = await fetchApplicationInterfaces(appId);
      if (!data) return null;
      cacheApplicationInterfaces(data);
      return data;
    },
    [cacheApplicationInterfaces],
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
        const oldWidth = (node.data as ApplicationNodeData).width ?? boxWidthRef.current;
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
              // Pinned from here on: a width chosen by hand outranks the slider.
              data: { ...n.data, width: newWidth, widthPinned: true },
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

  /** Applies the Box width slider to every rectangle the user hasn't resized
   * by hand.
   *
   * The floor is the same one `handleResizeApplication` applies to a
   * right-edge drag: a box never shrinks past the centre of an interface
   * circle it carries, which would leave the circle hanging outside its own
   * provider. So in the Interfaces view a loaded box can stay wider than the
   * slider says — deliberately.
   *
   * Only the right border moves (the node's own position is untouched), so
   * unlike the left-edge drag there is nothing to compensate on the child
   * circles — but a circle parked on the *right* border would end up floating
   * inside a widened box, so every circle of a resized box is re-snapped onto
   * the new perimeter with the same projection `onNodesChange` applies to a
   * drag. Doing it here rather than waiting for xyflow's measurement echo
   * avoids a visible one-frame jump. As with a manual drag, a circle near a
   * corner may land on the adjacent side.
   *
   * `isBaselineUpdateRef` because this is a display preference, not an edit:
   * without it, moving the slider would flag a freshly loaded diagram as
   * having unsaved changes. It is set only when something actually changes,
   * so a no-op run never swallows the flag for a later genuine edit.
   *
   * Depends on `nodes` as well as the slider so the per-box floor is
   * re-evaluated when circles are revealed or hidden, and reads `nodesRef`
   * (synced on every render) so the flag is raised outside the state updater,
   * which React may call twice. The early return makes the extra passes
   * free — and it converges: the projection can only move a circle's centre
   * to a value the new width already accommodates. */
  useEffect(() => {
    const half = INTERFACE_NODE_SIZE / 2;
    const current = nodesRef.current;

    const floorByApp = new Map<string, number>();
    for (const n of current) {
      if (n.type !== "interface") continue;
      const providerId = n.parentId ?? interfaceProviderRef.current.get(n.id);
      if (!providerId) continue;
      floorByApp.set(providerId, Math.max(floorByApp.get(providerId) ?? 0, n.position.x + half));
    }

    const resized = new Map<string, number>();
    for (const n of current) {
      if (n.type !== "application") continue;
      const data = n.data as unknown as ApplicationNodeData;
      if (data.widthPinned) continue;
      const width = Math.max(boxWidth, MIN_APP_NODE_WIDTH, floorByApp.get(n.id) ?? 0);
      if (data.width !== width) resized.set(n.id, width);
    }
    if (resized.size === 0) return;

    const next = current.map((n) => {
      if (n.type === "application") {
        const width = resized.get(n.id);
        return width === undefined ? n : { ...n, data: { ...n.data, width } };
      }
      if (n.type !== "interface") return n;
      const providerId = n.parentId ?? interfaceProviderRef.current.get(n.id);
      const width = providerId ? resized.get(providerId) : undefined;
      if (width === undefined) return n;
      const center = { x: n.position.x + half, y: n.position.y + half };
      const projected = projectPointToRectanglePerimeter(center, width, APP_NODE_HEIGHT);
      const position = { x: projected.x - half, y: projected.y - half };
      return position.x === n.position.x && position.y === n.position.y ? n : { ...n, position };
    });

    isBaselineUpdateRef.current = true;
    setNodes(next);
  }, [boxWidth, nodes, setNodes]);

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
        // Follows the Box width slider until the user drags a handle.
        width: boxWidthRef.current,
        widthPinned: false,
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
      data: {
        name: iface.name,
        protocol: iface.protocol,
        externalId: iface.externalId,
        dataObjects: iface.dataObjects,
      } satisfies InterfaceNodeData,
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

      // An interface can be discovered twice — first as provided, later as
      // consumed (or the reverse) — and only one of the two responses may
      // carry its data objects. Node data is frozen at creation, so refresh
      // what the newcomer knows better before deciding there is nothing to do.
      const incoming = new Map(newInterfaces.map((i) => [i.id, i]));
      const refreshed = current.map((n) => {
        if (n.type !== "interface") return n;
        const fresh = incoming.get(n.id);
        if (!fresh) return n;
        const data = n.data as unknown as InterfaceNodeData;
        const gainsDataObjects =
          fresh.dataObjects.length > 0 && (data.dataObjects?.length ?? 0) === 0;
        const gainsExternalId = !data.externalId && !!fresh.externalId;
        if (!gainsDataObjects && !gainsExternalId) return n;
        return {
          ...n,
          data: {
            ...data,
            dataObjects: gainsDataObjects ? fresh.dataObjects : data.dataObjects,
            externalId: gainsExternalId ? fresh.externalId : data.externalId,
          } satisfies InterfaceNodeData,
        };
      });

      if (toAdd.length === 0) return refreshed;

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
      return [...refreshed, ...newNodes];
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
        const position = placeNewApplicationNode(
          anchor,
          "right",
          boxesOf(current),
          boxWidthRef.current,
        );
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
    // An explicitly loaded diagram outranks the catalogue's opening proposal,
    // permanently: re-seeding over it would be a second, unasked-for reset.
    if (loadRequestedRef.current) return;
    const ids = seed.map((app) => app.id);
    const signature = ids.join(",");
    if (seededRef.current === signature) return;
    seededRef.current = signature;
    const generation = ++contentGenRef.current;
    const superseded = () => contentGenRef.current !== generation;
    let cancelled = false;
    let committed = false;

    const run = async () => {
      const selectedIds = new Set(ids);
      setSeeding(true);
      try {
        const fetched = await fetchApplicationsInterfaces(ids);
        if (cancelled) return;

        // So the context menus opened on a seeded node don't re-fetch what we
        // already hold.
        for (const node of fetched) cacheApplicationInterfaces(node);

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
          boxWidthRef.current,
        );
        if (cancelled || superseded()) return;

        for (const id of ids) rootIdsRef.current.add(id);
        isBaselineUpdateRef.current = true;
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
        if (cancelled || superseded()) return;
        setSeedError(e instanceof Error ? e.message : String(e));
        // The rectangles still belong on screen — only their relations
        // failed to load; fall back to the edgeless packing.
        const packed = await layoutRootApplications(ids, [], boxWidthRef.current).catch(
          () => new Map<string, { x: number; y: number }>(),
        );
        if (cancelled || superseded()) return;
        for (const id of ids) rootIdsRef.current.add(id);
        isBaselineUpdateRef.current = true;
        setNodes(
          seed.map((app) => makeApplicationNode(app, packed.get(app.id) ?? { x: 0, y: 0 }, true)),
        );
        committed = true;
        requestAnimationFrame(() => flowRef.current?.fitView({ maxZoom: 1 }));
      } finally {
        // `superseded()`: a load took over and owns the spinner now.
        if (!cancelled && !superseded()) setSeeding(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (!committed) seededRef.current = null;
    };
  }, [seed, makeApplicationNode, placeProviderInterfaces, cacheApplicationInterfaces]);

  /**
   * Draws a saved diagram, replacing whatever is on the canvas.
   *
   * Mirrors the seed effect above — same fetch, same cache priming, same
   * cancellation shape — with three differences that matter:
   *
   * - positions come from the save, so there is no ELK pass at all;
   * - `toDiagramRelations`, not `toInternalRelations`: the latter drops any
   *   interface without a consumer in the set, which is a legitimate diagram
   *   (that is exactly what *Show inbound interfaces* produces). What was on
   *   screen is decided by the saved ids, below, and by nothing else;
   * - the three geometry refs are **reset**, not merged. `interfaceSlotRef` is
   *   never pruned and `interfaceProviderRef` isn't pruned by
   *   `removeApplication`, so a load would otherwise inherit the previous
   *   diagram's slot assignments and anchor a circle to a rectangle that is
   *   no longer there.
   */
  useEffect(() => {
    if (!pendingLoad) return;
    const { content, applications } = pendingLoad;
    loadRequestedRef.current = true;
    const generation = ++contentGenRef.current;
    const superseded = () => contentGenRef.current !== generation;
    let cancelled = false;

    const run = async () => {
      setSeeding(true);
      setSeedError(null);
      closeAllInfo();
      try {
        const applicationIds = applications.map((app) => app.id);
        const fetched = await fetchApplicationsInterfaces(applicationIds);
        if (cancelled || superseded()) return;

        for (const node of fetched) cacheApplicationInterfaces(node);

        const { interfaces, edges } = toDiagramRelations(fetched);
        const interfaceById = new Map(interfaces.map((iface) => [iface.id, iface]));
        const edgeById = new Map(edges.map((edge) => [edge.id, edge]));

        // Saved ids are the authority on what was on screen; the fetch only
        // supplies their content. An id LeanIX no longer returns — the call
        // guarantees no completeness — simply drops out.
        const savedApplicationIds = new Set(applicationIds);
        const restoredInterfaces = content.interfaces.filter(
          (saved) =>
            interfaceById.has(saved.id) && savedApplicationIds.has(saved.providerId),
        );
        const restoredInterfaceIds = new Set(restoredInterfaces.map((i) => i.id));
        const restoredEdges = content.edges
          .map((saved) => edgeById.get(`${saved.consumerId}::${saved.interfaceId}`))
          .filter((edge): edge is DiscoverEdge => !!edge)
          .filter(
            (edge) =>
              savedApplicationIds.has(edge.consumerId) &&
              restoredInterfaceIds.has(edge.interfaceId),
          );

        rootIdsRef.current = new Set(content.rootIds.filter((id) => savedApplicationIds.has(id)));
        interfaceProviderRef.current = new Map(
          restoredInterfaces.map((saved) => [saved.id, saved.providerId]),
        );
        interfaceSlotRef.current = new Map(
          restoredInterfaces.map((saved) => [saved.id, saved.slot]),
        );

        // Before committing nodes and edges: an edge not yet mounted has no
        // listener, and reads its override on first render. The baseline flag
        // is raised first so restoring the bows isn't mistaken for the user
        // bending them — it stays raised until the nodes effect consumes it.
        isBaselineUpdateRef.current = true;
        setEdgeCurvatures(content.curvature);

        const widthById = new Map(
          content.applications.map((saved) => [saved.id, saved.width]),
        );
        const positionById = new Map(
          content.applications.map((saved) => [saved.id, { x: saved.x, y: saved.y }]),
        );

        setNodes(() => {
          const appNodes = applications.map((app) => {
            // Rebuilt rather than deserialised: `data.onResize` is a closure
            // over this render's handler and cannot survive a JSON round trip.
            const node = makeApplicationNode(
              app,
              positionById.get(app.id) ?? { x: 0, y: 0 },
              rootIdsRef.current.has(app.id),
            );
            // A saved width only ever means "the user resized this one", so
            // it comes back pinned; the rest follow the Box width slider.
            const width = widthById.get(app.id);
            return width === undefined
              ? node
              : { ...node, data: { ...node.data, width, widthPinned: true } };
          });
          const circles = restoredInterfaces.map((saved) =>
            makeInterfaceNode(
              interfaceById.get(saved.id)!,
              { x: saved.x, y: saved.y },
              saved.providerId,
            ),
          );
          return [...appNodes, ...circles];
        });
        setEdgeMeta(restoredEdges);
        requestAnimationFrame(() => flowRef.current?.fitView({ maxZoom: 1 }));
        onLoadSettled?.(null);
      } catch (e) {
        if (cancelled || superseded()) return;
        // Nothing was committed, so the canvas still holds the previous
        // diagram — the parent keeps its active save and shows the message.
        onLoadSettled?.(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled && !superseded()) setSeeding(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
    // `onLoadSettled` is deliberately out: the parent recreates nothing, but
    // an unstable callback would re-run a whole load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingLoad, makeApplicationNode, cacheApplicationInterfaces, closeAllInfo]);

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

    // Drop the manual curvature of every edge that just disappeared, so that
    // removing an application and adding it back does not resurrect the bends
    // its edges used to carry. Pruning on the `edges` memo instead would also
    // fire when switching view mode — and wipe the other view's adjustments,
    // which are meant to survive a round trip.
    const survivingEdgeIds = new Set(
      edgeMetaRef.current
        .filter((e) => visited.has(e.consumerId) && visited.has(e.interfaceId))
        .map((e) => e.id),
    );
    pruneEdgeCurvature((edgeId) => {
      if (survivingEdgeIds.has(edgeId)) return true;
      // Simplified view ids are `${sourceId}->${targetId}`.
      const [source, target] = edgeId.split("->");
      return target !== undefined && visited.has(source) && visited.has(target);
    });
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
          const position = placeNewApplicationNode(
            cursor,
            "left",
            boxesOf(next),
            boxWidthRef.current,
          );
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
          const position = placeNewApplicationNode(
            ifaceAnchor(),
            "left",
            boxesOf(next),
            boxWidthRef.current,
          );
          next = [...next, makeApplicationNode(provider, position, false)];
          existingIds.add(provider.id);
          interfaceProviderRef.current.set(ifaceId, provider.id);
        }
        const missingConsumers = consumers.filter((c) => !existingIds.has(c.id));
        if (missingConsumers.length === 0) return next;
        let cursor = ifaceAnchor();
        const added: Node[] = [];
        for (const c of missingConsumers) {
          const position = placeNewApplicationNode(
            cursor,
            "right",
            boxesOf([...next, ...added]),
            boxWidthRef.current,
          );
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
      // The interfaces this application provides, **from the model** rather
      // than from what happens to be on screen. Walking the visible ones was
      // the whole bug: the consumers hang off these interfaces, so with none
      // revealed the loop ran empty and the click did nothing — with no way
      // out at all in the simplified view, where "Show API" is hidden. And in
      // the complex view the circles aren't optional either: a flow there is
      // drawn *to a circle*, so without it a consumer couldn't be connected.
      // Cached after the first call, so a second click asks for nothing.
      const data = await ensureAppInterfaces(nodeId);
      const provided = data ? toInboundInterfaces(data) : [];
      // Skips whatever is already there, so replaying the command adds
      // nothing.
      if (provided.length > 0) {
        setNodes((current) => placeProviderInterfaces(current, nodeId, provided));
      }

      const visibleIds = new Set(nodesRef.current.map((n) => n.id));
      const attached = new Set<string>();
      // Built from `provided`, never from the nodes: `setNodes` above hasn't
      // landed yet, so reading the canvas here would reproduce the very bug
      // this fixes, one pass late. When the query failed, `provided` is empty
      // and the visible providers below are all we can fall back on.
      for (const iface of provided) attached.add(iface.id);
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
    [ensureAppInterfaces, placeProviderInterfaces, revealInterfaceDependencies],
  );

  /** Application rectangles currently on the canvas whose interfaces haven't
   * been loaded yet — what the "connect" action below would actually have to
   * ask LeanIX for. The toolbar reads it *before* deciding whether to warn:
   * counting the rectangles instead would raise the warning on an ordinary
   * working diagram, and a warning that always shows stops protecting. */
  const applicationsToQuery = useCallback((): number => {
    let count = 0;
    for (const node of nodesRef.current) {
      if (node.type !== "application") continue;
      if (!appInterfacesCache.current.has(node.id)) count += 1;
    }
    return count;
  }, []);

  /**
   * Draws every flow that exists **between the applications already on the
   * canvas** and isn't drawn yet.
   *
   * A diagram is built by successive additions, and nothing makes the links
   * between two applications that arrived separately appear: they can sit
   * side by side, exchanging data, with no line between them. This closes the
   * graph on itself.
   *
   * It adds interfaces and flows, never an application — a structural
   * guarantee rather than a rule to enforce, since `toInternalRelations`
   * returns nothing else. That is what makes the action predictable before
   * the click and free to replay: the result is bounded by what is already on
   * screen. Reaching further is the context menu's job, application by
   * application, with counters that announce what a click will bring in.
   */
  const connectVisibleFlows = useCallback(async (): Promise<{
    flows: number;
    incomplete: boolean;
  }> => {
    const appIds = nodesRef.current
      .filter((n) => n.type === "application")
      .map((n) => n.id);
    if (appIds.length < 2) return { flows: 0, incomplete: false };

    const missing = appIds.filter((id) => !appInterfacesCache.current.has(id));
    let incomplete = false;
    if (missing.length > 0) {
      // Chunked and parallel inside (`fetchApplicationsInterfaces`), so a
      // hundred applications is a handful of requests, not a hundred.
      const fetched = await fetchApplicationsInterfaces(missing);
      for (const node of fetched) cacheApplicationInterfaces(node);
      incomplete = fetched.length < missing.length;
    }

    const datas = appIds
      .map((id) => appInterfacesCache.current.get(id))
      .filter((d): d is ApplicationInterfacesNode => !!d);

    // The same function that builds the catalogue-seeded graph: interfaces
    // whose provider is in the set *and* which have a consumer in the set,
    // deduplicated, with their edges. It reads the **provider** side, so a
    // link A → B is found in B's data — which is why a failed query shows up
    // as a missing link rather than an error, hence `incomplete`.
    const { interfaces, edges } = toInternalRelations(datas, new Set(appIds));

    // Counted here, against the ref, and never inside the updater below:
    // StrictMode invokes updaters twice, which would double the tally.
    const known = new Set(edgeMetaRef.current.map((e) => e.id));
    const fresh = edges.filter((e) => !known.has(e.id));

    if (interfaces.length > 0) {
      const byProvider = new Map<string, DiscoverInterfaceNode[]>();
      for (const iface of interfaces) {
        const list = byProvider.get(iface.providerId);
        if (list) list.push(iface);
        else byProvider.set(iface.providerId, [iface]);
      }
      // One write for the whole canvas: looping `setNodes` per application
      // would make the graph flicker and re-render React Flow each time.
      setNodes((current) => {
        let next = current;
        for (const [providerId, ifaces] of byProvider) {
          next = placeProviderInterfaces(next, providerId, ifaces);
        }
        return next;
      });
    }
    if (fresh.length > 0) {
      setEdgeMeta((current) => [...current, ...fresh]);
    }

    return { flows: fresh.length, incomplete };
  }, [cacheApplicationInterfaces, placeProviderInterfaces]);

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

  /** Reads refs only, like `snapshot`, and deliberately ignores `simplified`:
   * a diagram saved from the Simple view must come back whole. */
  const getDiagram = useCallback((): DiscoverDiagramContent | null => {
    const current = nodesRef.current;
    if (current.length === 0) return null;
    const applicationIds = new Set(
      current.filter((n) => n.type === "application").map((n) => n.id),
    );
    const interfaceIds = new Set(current.filter((n) => n.type === "interface").map((n) => n.id));
    return {
      rootIds: [...rootIdsRef.current].filter((id) => applicationIds.has(id)),
      applications: current
        .filter((n) => n.type === "application")
        .map((n) => {
          const width = (n.data as unknown as ApplicationNodeData).width;
          return {
            id: n.id,
            x: n.position.x,
            y: n.position.y,
            // Only when the user actually resized the box — the others
            // follow whatever Box width the reader has set.
            ...((n.data as unknown as ApplicationNodeData).widthPinned && width !== undefined
              ? { width }
              : {}),
          };
        }),
      interfaces: current
        .filter((n) => n.type === "interface")
        .map((n) => ({
          id: n.id,
          // `parentId` over `interfaceProviderRef`: the ref can hold stale
          // entries (it isn't pruned by `removeApplication`), the parent link
          // is what xyflow actually draws.
          providerId: n.parentId ?? interfaceProviderRef.current.get(n.id) ?? "",
          slot: interfaceSlotRef.current.get(n.id) ?? 0,
          // Relative to the provider — see `makeInterfaceNode`.
          x: n.position.x,
          y: n.position.y,
        }))
        .filter((i) => i.providerId !== ""),
      // Both ends re-checked, so a pruning race can't save a dangling link.
      edges: edgeMetaRef.current
        .filter((e) => applicationIds.has(e.consumerId) && interfaceIds.has(e.interfaceId))
        .map((e) => ({ consumerId: e.consumerId, interfaceId: e.interfaceId })),
      curvature: getAllEdgeCurvatures(),
    };
  }, []);

  /** Any change to the canvas that wasn't one of the baseline resets above
   * means the diagram has drifted from the active save. The parent owns the
   * way back to clean, so this only ever reports the dirty direction. The
   * `length === 0` guard skips the very first mount. */
  useEffect(() => {
    if (nodes.length === 0 && edgeMeta.length === 0) return;
    if (isBaselineUpdateRef.current) {
      isBaselineUpdateRef.current = false;
      return;
    }
    onDirty?.();
  }, [nodes, edgeMeta, onDirty]);

  /** Curvature lives in a module store, so a handle drag reaches neither
   * `nodes` nor `edgeMeta` — without this, bending a link would never mark
   * the diagram as modified. A load restores curvature under the baseline
   * flag, which this honours the same way. */
  useEffect(
    () =>
      subscribeEdgeCurvatureChange(() => {
        if (isBaselineUpdateRef.current) return;
        onDirty?.();
      }),
    [onDirty],
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
                externalId: data.externalId,
                dataObjects: data.dataObjects,
                providerId: interfaceProviderRef.current.get(n.id) ?? n.parentId ?? "",
              };
            }),
      // `edgeMeta` is the model; the `edges` memo below is geometry. Folded
      // through the same helper the canvas uses, so the export and the screen
      // can't disagree. Both ends re-checked so a pruning race can't leave a
      // dangling link.
      edges: simplified
        ? collapseToApplications(edgeMetaRef.current, providerOf)
            .filter((e) => present.has(e.sourceId) && present.has(e.targetId))
            // The folded interfaces are geometry for the canvas, not part of
            // the exported topology.
            .map(({ sourceId, targetId }) => ({ sourceId, targetId }))
        : edgeMetaRef.current
            .filter((e) => present.has(e.consumerId) && present.has(e.interfaceId))
            .map((e) => ({ sourceId: e.consumerId, targetId: e.interfaceId })),
    };
  }, [simplified]);

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

    /** What an interface transports, ready to be hung on an arrow. Already
     * loaded with the graph — nothing is fetched for this. Sorted by name so
     * the dots come out in the same order on every arrow that carries the
     * same data. */
    const dataObjectsOf = (interfaceIds: string[]) => {
      const byDataObject = new Map<string, { id: string; name: string }>();
      for (const interfaceId of interfaceIds) {
        const data = byId.get(interfaceId)?.data as unknown as InterfaceNodeData | undefined;
        for (const o of data?.dataObjects ?? []) {
          if (!byDataObject.has(o.id)) byDataObject.set(o.id, { id: o.id, name: o.name });
        }
      }
      return [...byDataObject.values()].sort((a, b) => a.name.localeCompare(b.name));
    };

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
      for (const { sourceId, targetId, interfaceIds } of collapsed) {
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
            // The union of what every folded interface carries — the only
            // reading consistent with what this arrow stands for on screen.
            dataObjects: dataObjectsOf(interfaceIds),
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
            // What the targeted interface transports. Two consumers of the
            // same interface therefore carry the same dots — the same data
            // flowing twice, not a duplicate to fix.
            dataObjects: dataObjectsOf([e.interfaceId]),
          } satisfies GraphEdgeData,
          markerEnd: { type: MarkerType.ArrowClosed, color: "var(--color-accent)" },
          style: { stroke: "var(--color-accent)" },
        });
      });
    }
    return result;
  }, [nodes, edgeMeta, simplified]);

  // Mirrors of what is actually drawn, for the highlight callbacks below:
  // they must stay reference-stable (they are wired to xyflow handlers and to
  // the imperative handle), so they read refs rather than close over state.
  const visibleNodesRef = useRef(visibleNodes);
  visibleNodesRef.current = visibleNodes;
  const simplifiedRef = useRef(simplified);
  simplifiedRef.current = simplified;

  /**
   * Which elements are on the canvas — deliberately *not* where they are.
   *
   * `onNodesChange` rewrites `nodes` on every frame of a drag, so an effect
   * keyed on `nodes` would sweep the whole DOM per frame. Keyed on this
   * signature it only runs when something appeared or disappeared, which is
   * also exactly when the highlight and the counters need to be recomputed.
   */
  const membershipKey = useMemo(
    () =>
      `${simplified}|${visibleNodes.map((n) => n.id).join(",")}|${edges
        .map((e) => e.id)
        .join(",")}`,
    [visibleNodes, edges, simplified],
  );

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
   *   and every edge among those.
   *
   * Two sources now write these classes — this click, and the highlight
   * panel's selection — so they share a single owner, `renderHighlight`
   * below. Anything that paints outside it will be erased by the next
   * repaint. */
  const highlightedNodeIdRef = useRef<string | null>(null);
  /** The highlight panel's selection, pushed through `setAxisHighlight`. */
  const axisSelectionRef = useRef<AxisHighlightSelection | null>(null);

  /** Nodes by id, plus the provider lookup resolved the same way the `edges`
   * memo does it (`byId.get(id)?.parentId`) rather than through
   * `interfaceProviderRef`: the two can disagree, and what matters here is
   * matching the ids xyflow actually put in the DOM. Built once per repaint —
   * a linear scan per edge would be quadratic on a large canvas. */
  const readNodes = useCallback(() => {
    const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
    const providerOf = (interfaceId: string) =>
      (byId.get(interfaceId)?.parentId ??
        interfaceProviderRef.current.get(interfaceId)) as string | undefined;
    return { byId, providerOf };
  }, []);

  /** What a click pins: the node itself and its immediate neighbourhood —
   * see the doc block above for the exact rule per node type. */
  const computeClickSets = useCallback(
    (nodeId: string) => {
      const nodeIds = new Set<string>([nodeId]);
      const edgeIds = new Set<string>();
      const simplified = simplifiedRef.current;
      const { byId, providerOf } = readNodes();
      const addEdge = (e: DiscoverEdge) => {
        const domId = edgeDomId(e, simplified, providerOf);
        if (domId) edgeIds.add(domId);
      };

      const node = byId.get(nodeId);
      if (node?.type === "interface") {
        const provider = interfaceProviderRef.current.get(nodeId);
        if (provider) nodeIds.add(provider);
        for (const e of edgeMetaRef.current) {
          if (e.interfaceId === nodeId) {
            nodeIds.add(e.consumerId);
            addEdge(e);
          }
        }
      } else {
        const ownedInterfaceIds = new Set(
          [...interfaceProviderRef.current.entries()]
            .filter(([, providerId]) => providerId === nodeId)
            .map(([ifaceId]) => ifaceId),
        );
        for (const ifaceId of ownedInterfaceIds) nodeIds.add(ifaceId);
        for (const e of edgeMetaRef.current) {
          if (ownedInterfaceIds.has(e.interfaceId)) {
            // An interface this app provides: highlight its consumers too.
            nodeIds.add(e.consumerId);
            addEdge(e);
          }
          if (e.consumerId === nodeId) {
            // An interface this app consumes: highlight it and its provider.
            nodeIds.add(e.interfaceId);
            const provider = interfaceProviderRef.current.get(e.interfaceId);
            if (provider) nodeIds.add(provider);
            addEdge(e);
          }
        }
      }
      return { nodeIds, edgeIds };
    },
    [readNodes],
  );

  /**
   * What the panel's selection lights: strictly what the model links to a
   * ticked value, plus the flows that reach a lit interface. Nothing is added
   * by neighbourhood — an application consuming an interface that carries a
   * ticked data object stays dimmed unless it declares that data object
   * itself. That gap is the model's, and the canvas shows it as such.
   */
  const computeAxisSets = useCallback(
    (selection: AxisHighlightSelection) => {
      const { dataObjects, capabilities, join } = selection;
      const nodeIds = new Set<string>();
      const edgeIds = new Set<string>();
      const { byId, providerOf } = readNodes();

      for (const node of visibleNodesRef.current) {
        if (node.type === "interface") {
          // Only the Data Object axis applies to a flow: an interface carries
          // no business capability, so a capability selection never lights one.
          const data = node.data as unknown as InterfaceNodeData;
          const own = new Set((data.dataObjects ?? []).map((o) => o.id));
          if (matchesAxis(own, dataObjects, join)) nodeIds.add(node.id);
          continue;
        }
        // An application the catalogue doesn't know (revealed by an Interface
        // query) has neither axis, so it can never be lit.
        const app = resolveApplication(node.id);
        if (!app) continue;
        const lit = applicationMatches(
          app.dataObjects.map((o) => o.id),
          app.businessCapabilities.map((c) => c.id),
          selection,
        );
        if (lit) nodeIds.add(node.id);
      }

      const simplified = simplifiedRef.current;
      for (const e of edgeMetaRef.current) {
        const domId = edgeDomId(e, simplified, providerOf);
        if (!domId) continue;
        // The flow is lit by the interface it carries, never by its endpoints:
        // the arrow is what shows the data moving, even between two
        // applications that don't declare it.
        if (simplified) {
          const iface = byId.get(e.interfaceId);
          const data = iface?.data as unknown as InterfaceNodeData | undefined;
          const own = new Set((data?.dataObjects ?? []).map((o) => o.id));
          if (matchesAxis(own, dataObjects, join)) edgeIds.add(domId);
        } else if (nodeIds.has(e.interfaceId)) {
          edgeIds.add(domId);
        }
      }

      return { nodeIds, edgeIds };
    },
    [readNodes, resolveApplication],
  );

  /**
   * The one place that writes `.rf-dim` / `.rf-emph`. A pinned click wins
   * while it lasts — it is a deliberate, transient gesture — and dropping it
   * hands the canvas back to the panel's highlight instead of relighting
   * everything.
   */
  const renderHighlight = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;

    // A pin whose node has left the canvas — hidden, pruned, or an interface
    // the simplified view stopped drawing — would keep the panel's highlight
    // out forever, since it can no longer be clicked again.
    const pinned = highlightedNodeIdRef.current;
    if (pinned && !visibleNodesRef.current.some((n) => n.id === pinned)) {
      highlightedNodeIdRef.current = null;
    }

    const sets = highlightedNodeIdRef.current
      ? computeClickSets(highlightedNodeIdRef.current)
      : axisSelectionRef.current
        ? computeAxisSets(axisSelectionRef.current)
        : null;

    if (!sets) {
      root
        .querySelectorAll(".rf-dim, .rf-emph")
        .forEach((el) => el.classList.remove("rf-dim", "rf-emph"));
      return;
    }

    root.querySelectorAll<HTMLElement>(".react-flow__node").forEach((el) => {
      const id = el.dataset.id;
      el.classList.toggle("rf-dim", !!id && !sets.nodeIds.has(id));
    });
    root.querySelectorAll<SVGElement>(".react-flow__edge").forEach((el) => {
      const id = el.dataset.id;
      const isEmphasized = !!id && sets.edgeIds.has(id);
      el.classList.toggle("rf-dim", !isEmphasized);
      el.classList.toggle("rf-emph", isEmphasized);
    });
  }, [computeAxisSets, computeClickSets]);

  const setAxisHighlight = useCallback(
    (selection: AxisHighlightSelection | null) => {
      axisSelectionRef.current = selection;
      renderHighlight();
    },
    [renderHighlight],
  );

  /**
   * Repaint whenever the canvas gains or loses an element.
   *
   * Deferred by one frame on purpose: xyflow does not render from the `nodes`
   * prop, it copies it into its own store from an effect of its own
   * (`StoreUpdater`), so a node added in this commit is *not* in the DOM yet
   * when this effect runs. Same reason the two `fitView` calls in the seed
   * effect are wrapped in a frame.
   */
  useEffect(() => {
    const frame = requestAnimationFrame(renderHighlight);
    return () => cancelAnimationFrame(frame);
  }, [membershipKey, renderHighlight]);

  /** Drop the cards of nodes that have left the canvas. Without this a hidden
   * node's id would sit in the set and its card would pop back if the node
   * were ever added again — the same trap the `showInfoIcons` effect guards
   * against. Compared against `nodes`, not `visibleNodes`: an interface the
   * simplified view stopped drawing is still there, and its card is meant to
   * return with it. */
  useEffect(() => {
    const prune = (current: ReadonlySet<string>) => {
      const kept = [...current].filter((id) =>
        nodesRef.current.some((n) => n.id === id),
      );
      return kept.length === current.size ? current : new Set(kept);
    };
    setOpenApplicationIds(prune);
    setOpenInterfaceIds(prune);
  }, [membershipKey]);

  /** xyflow rewrites a node's `className` when `dragging` flips, which wipes
   * whatever we put there. Repainting on drop is what keeps a dimmed
   * rectangle dimmed after the user has moved it. */
  const handleNodeDragStop = useCallback(() => {
    renderHighlight();
  }, [renderHighlight]);

  /** Only the highlight pin moves here. Open identity cards are left alone:
   * they are pinned, and clicking around the canvas to compare them must not
   * dismiss them. */
  const handleNodeClick = useCallback(
    (_: unknown, node: Node) => {
      highlightedNodeIdRef.current =
        highlightedNodeIdRef.current === node.id ? null : node.id;
      renderHighlight();
    },
    [renderHighlight],
  );

  const handlePaneClick = useCallback(() => {
    highlightedNodeIdRef.current = null;
    renderHighlight();
  }, [renderHighlight]);

  /**
   * What the canvas holds, for the highlight panel's counters.
   *
   * Keyed on `nodes` identity rather than on `membershipKey`, because an
   * interface's `dataObjects` are filled in *after* the circle appears
   * (`placeProviderInterfaces`) — a change the membership signature cannot
   * see. The payload is rebuilt per frame during a drag, but the signature
   * below is what decides whether anyone is told about it.
   */
  const canvasContents = useMemo<CanvasContents>(() => {
    const applicationIds: string[] = [];
    const interfaces: CanvasInterface[] = [];
    for (const node of nodes) {
      if (node.type === "application") {
        applicationIds.push(node.id);
      } else if (node.type === "interface") {
        const data = node.data as unknown as InterfaceNodeData;
        interfaces.push({
          id: node.id,
          dataObjectIds: (data.dataObjects ?? []).map((o) => o.id),
        });
      }
    }
    return { applicationIds, interfaces };
  }, [nodes]);

  const contentsKey = useMemo(
    () =>
      `${canvasContents.applicationIds.join(",")}|${canvasContents.interfaces
        .map((i) => `${i.id}:${i.dataObjectIds.join("+")}`)
        .join(",")}`,
    [canvasContents],
  );
  const canvasContentsRef = useRef(canvasContents);
  canvasContentsRef.current = canvasContents;

  useEffect(() => {
    publishCanvasContents(canvasContentsRef.current);
  }, [contentsKey]);

  // A canvas must not outlive its graph — and StrictMode's double mount would
  // otherwise leave the first pass's content published.
  useEffect(() => resetCanvasContents, []);

  // Declared here, after `setAxisHighlight` exists: the handle is assembled
  // from callbacks defined throughout this component.
  /** Reads refs only, so it never has to be rebuilt. `visibleNodes` and not
   * `nodes`: the simplified view must not frame — nor capture — the interface
   * circles it doesn't draw. */
  const exportImage = useCallback(async (format: "png" | "svg"): Promise<Blob> => {
    const viewport = containerRef.current?.querySelector<HTMLElement>(
      ".react-flow__viewport",
    );
    if (!viewport) throw new Error("The diagram is not ready yet.");
    // `boxesOf` resolves child positions: interface circles are xyflow child
    // nodes whose `position` is relative to their provider, so their raw
    // coordinates would frame the picture wrong. Open detail cards are added
    // on top — they are draggable, so nothing in the node geometry knows how
    // far out they reach.
    const zoom = flowRef.current?.getViewport().zoom ?? 1;
    const bounds = boundsOf([
      ...boxesOf(visibleNodesRef.current),
      ...overlayBoxes(viewport, zoom),
    ]);
    if (!bounds) throw new Error("There is nothing on the diagram to export.");
    return captureViewport(viewport, bounds, format);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      addApplication,
      removeApplication,
      snapshot,
      getDiagram,
      setAxisHighlight,
      exportImage,
      applicationsToQuery,
      connectVisibleFlows,
    }),
    [
      addApplication,
      removeApplication,
      snapshot,
      getDiagram,
      setAxisHighlight,
      exportImage,
      applicationsToQuery,
      connectVisibleFlows,
    ],
  );

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
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={handlePaneClick}
          onNodeContextMenu={onNodeContextMenu}
        >
          <Background />
          {/* Bottom-right: the highlight panel and its folded tab own the
              left edge, and the default bottom-left would sit under them. */}
          <Controls showInteractive={false} position="bottom-right" />
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
