"use client";

import { useEffect, useMemo, useState, type RefObject } from "react";
import clsx from "clsx";
import ChevronIcon from "@/components/icons/ChevronIcon";
import FilterSection from "@/components/FilterSection";
import HierarchyTreeFilter from "@/components/HierarchyTreeFilter";
import type { DiscoverGraphHandle } from "@/components/discover/DiscoverGraph";
import { useCanvasContents } from "@/lib/discoverCanvasContents";
import {
  applicationMatches,
  matchesAxis,
  type AxisHighlightSelection,
} from "@/lib/discoverHighlight";
import {
  setHighlightPanelOpen,
  useHighlightPanelOpen,
} from "@/lib/discoverHighlightPanel";
import {
  setDataObjectLegendEnabled,
  useDataObjectColors,
  useDataObjectLegendEnabled,
} from "@/lib/discoverDataObjectLegend";
import {
  setCapabilityLegendEnabled,
  useCapabilityColors,
  useCapabilityLegendEnabled,
} from "@/lib/discoverCapabilityLegend";
import {
  countApplicationsPerNode,
  coveredCapabilityIds,
} from "@/lib/businessCapabilities";
import { carriedDataObjectIds, countApplicationsPerDataObject } from "@/lib/dataObjects";
import { expandSelection, withAncestors } from "@/lib/hierarchyTree";
import { useBusinessCapabilityTree } from "@/lib/useBusinessCapabilityTree";
import { useDataObjectTree } from "@/lib/useDataObjectTree";
import type { Application } from "@/lib/types";

/** Stable empty map: a fresh `new Map()` per render would remount the tree
 * and lose its expanded nodes — same precaution as `FilterBar`. */
const EMPTY_COUNTS = new Map<string, number>();

type JoinMode = AxisHighlightSelection["join"];

type Props = {
  graphRef: RefObject<DiscoverGraphHandle | null>;
  /** The catalogue, for resolving the ids the graph publishes. Applications
   * revealed by an Interface query are absent from it — see `NOT_IN_CATALOGUE`
   * note in the chapters' copy. */
  applicationsById: Map<string, Application>;
};

/**
 * Reads the graph functionally: tick data objects or business capabilities,
 * and the elements the model links to them stay lit while the rest dims.
 *
 * It highlights, it never filters — removing nodes from a Discover canvas
 * breaks the paths and with them the reading. And it never infers: an
 * application consuming an interface that carries a ticked data object stays
 * dim unless it declares that data object itself. That gap belongs to the
 * LeanIX model, and the canvas is where it becomes visible.
 *
 * Nothing here writes to `lib/appFilters.ts`: this selection is local to the
 * canvas and must not narrow the catalogue or the map.
 *
 * The ticked ids live in this outer component, the trees and the counters in
 * the inner one — which is mounted only while the panel is open. That split is
 * what lets a selection keep dimming the canvas with the panel folded, while a
 * session that never opens it pays nothing, hierarchy crawls included.
 */
export default function DiscoverHighlightPanel({
  graphRef,
  applicationsById,
}: Readonly<Props>) {
  const open = useHighlightPanelOpen();
  const [dataObjectIds, setDataObjectIds] = useState<string[]>([]);
  const [capabilityIds, setCapabilityIds] = useState<string[]>([]);
  const [join, setJoin] = useState<JoinMode>("or");

  const ticked = dataObjectIds.length + capabilityIds.length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setHighlightPanelOpen(true)}
        title="Highlight by data object or business capability"
        aria-label="Open the highlight panel"
        className="glass-panel absolute left-4 top-4 z-10 flex items-center gap-1.5 px-2 py-2 text-muted transition-colors hover:text-fg md:left-6"
      >
        <ChevronIcon />
        {/* The badge is what explains a dimmed canvas while the panel is
            folded — without it the greying out reads as a bug. */}
        {ticked > 0 && (
          <span className="font-mono text-[11px] text-accent">{ticked}</span>
        )}
      </button>
    );
  }

  return (
    <div className="absolute left-4 top-4 z-10 flex max-h-[calc(100%-2rem)] w-[320px] flex-col md:left-6">
      <div className="glass-panel flex min-h-0 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-muted">
            Highlight
          </span>
          {ticked > 0 && (
            <button
              type="button"
              onClick={() => {
                setDataObjectIds([]);
                setCapabilityIds([]);
              }}
              className="text-[10px] font-medium text-muted underline underline-offset-2 hover:text-accent"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setHighlightPanelOpen(false)}
            title="Close the highlight panel"
            aria-label="Close the highlight panel"
            className="ml-auto shrink-0 text-muted hover:text-fg"
          >
            <ChevronIcon className="rotate-180" />
          </button>
        </div>

        <JoinToggle value={join} onChange={setJoin} />

        <HighlightChapters
          graphRef={graphRef}
          applicationsById={applicationsById}
          dataObjectIds={dataObjectIds}
          capabilityIds={capabilityIds}
          join={join}
          onDataObjectIdsChange={setDataObjectIds}
          onCapabilityIdsChange={setCapabilityIds}
        />
      </div>
    </div>
  );
}

/** Same segmented control as the Simple/Complex toggle in the toolbar — the
 * page already has an idiom for "two exclusive drawing modes". */
function JoinToggle({
  value,
  onChange,
}: {
  value: JoinMode;
  onChange: (next: JoinMode) => void;
}) {
  const modes: { value: JoinMode; label: string; hint: string }[] = [
    {
      value: "or",
      label: "Any",
      hint: "Any — an element is highlighted when it carries at least one of the ticked values.",
    },
    {
      value: "and",
      label: "All",
      hint: "All — an element is highlighted only when it carries every ticked value of a chapter.",
    },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="How ticked values combine"
      title="How ticked values combine"
      className="flex items-center gap-1 rounded bg-surface-2 p-0.5"
    >
      {modes.map((m) => {
        const active = m.value === value;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={m.hint}
            onClick={() => onChange(m.value)}
            className={clsx(
              "flex-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
              active ? "bg-accent text-accent-fg" : "text-muted hover:text-fg",
            )}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Mounted only while the panel is open: it is what loads the two hierarchies
 * and recomputes the counters, and neither should cost anything to a session
 * that never unfolds the panel.
 *
 * Folding it does **not** drop the highlight: the selection lives above, and
 * the graph holds the last pushed value on its own.
 */
function HighlightChapters({
  graphRef,
  applicationsById,
  dataObjectIds,
  capabilityIds,
  join,
  onDataObjectIdsChange,
  onCapabilityIdsChange,
}: {
  graphRef: RefObject<DiscoverGraphHandle | null>;
  applicationsById: Map<string, Application>;
  dataObjectIds: string[];
  capabilityIds: string[];
  join: JoinMode;
  onDataObjectIdsChange: (ids: string[]) => void;
  onCapabilityIdsChange: (ids: string[]) => void;
}) {
  const { tree: dataObjectTree, isLoading: loadingDataObjects } = useDataObjectTree();
  const { tree: capabilityTree, isLoading: loadingCapabilities } =
    useBusinessCapabilityTree();
  const contents = useCanvasContents();
  const legendOn = useDataObjectLegendEnabled();
  const colors = useDataObjectColors();
  const legendCapabilitiesOn = useCapabilityLegendEnabled();
  const capabilityColors = useCapabilityColors();

  /** The rectangles on the canvas, resolved against the catalogue. An
   * application revealed by an Interface query is not in there, so it is
   * neither counted nor ever lit. */
  const displayedApplications = useMemo(
    () =>
      contents.applicationIds
        .map((id) => applicationsById.get(id))
        .filter((app): app is Application => !!app),
    [contents, applicationsById],
  );

  const dataObjectCounts = useMemo(
    () =>
      dataObjectTree
        ? countApplicationsPerDataObject(dataObjectTree, displayedApplications)
        : EMPTY_COUNTS,
    [dataObjectTree, displayedApplications],
  );
  /** What a visible interface actually carries — the criterion the legend
   * runs on. Not the counters above: those count the applications that
   * *declare* a data object, which is a different set (see
   * `carriedDataObjectIds`). */
  const carried = useMemo(
    () => (legendOn ? carriedDataObjectIds(dataObjectTree, contents.interfaces) : null),
    [legendOn, dataObjectTree, contents],
  );

  /** Kept ancestors are what stops the restricted tree from collapsing into a
   * flat list; they carry nothing themselves, so they get no dot — which the
   * `carried`-only map below expresses without a rule of its own. */
  const restrictTo = useMemo(
    () => (carried ? withAncestors(dataObjectTree, carried) : null),
    [carried, dataObjectTree],
  );

  const dots = useMemo(() => {
    if (!carried || !colors) return undefined;
    const map = new Map<string, string>();
    for (const id of carried) {
      const color = colors.get(id);
      if (color) map.set(id, color);
    }
    return map;
  }, [carried, colors]);

  const capabilityCounts = useMemo(
    () =>
      capabilityTree
        ? countApplicationsPerNode(capabilityTree, displayedApplications)
        : EMPTY_COUNTS,
    [capabilityTree, displayedApplications],
  );

  /**
   * Unlike the Data Object axis, the criterion here **is** the counter already
   * on screen: it counts the applications of the diagram linked to a node,
   * which is exactly what the checkbox asks for. And since it is rolled up
   * from the leaves, "count is not zero" already contains every ancestor of a
   * kept node — so the paths stay walkable without `withAncestors`.
   */
  const capabilityRestrictTo = useMemo(() => {
    if (!legendCapabilitiesOn || !capabilityTree) return null;
    const kept = new Set<string>();
    for (const [id, count] of capabilityCounts) if (count > 0) kept.add(id);
    return kept;
  }, [legendCapabilitiesOn, capabilityTree, capabilityCounts]);

  /** Only a **direct** link earns a colour. A parent that shows up through the
   * roll-up alone stays bare — colouring it would put a capability on an
   * application's pie that the application does not declare. */
  const capabilityDots = useMemo(() => {
    if (!legendCapabilitiesOn || !capabilityColors) return undefined;
    const map = new Map<string, string>();
    for (const id of coveredCapabilityIds(capabilityTree, displayedApplications)) {
      const color = capabilityColors.get(id);
      if (color) map.set(id, color);
    }
    return map;
  }, [legendCapabilitiesOn, capabilityColors, capabilityTree, displayedApplications]);

  // One expanded set per ticked node, never one flat set — see
  // `AxisHighlightSelection`.
  const selection = useMemo<AxisHighlightSelection | null>(() => {
    const dataObjects = dataObjectIds.map((id) => expandSelection(dataObjectTree, [id]));
    const capabilities = capabilityIds.map((id) => expandSelection(capabilityTree, [id]));
    if (dataObjects.length === 0 && capabilities.length === 0) return null;
    return { dataObjects, capabilities, join };
  }, [dataObjectIds, capabilityIds, dataObjectTree, capabilityTree, join]);

  useEffect(() => {
    // `graphRef.current` is null on the very first render — the graph is
    // code-split behind `dynamic(ssr:false)`. Nothing is lost: it repaints
    // from its own effect as soon as it mounts, and this runs again on the
    // next canvas change.
    graphRef.current?.setAxisHighlight(selection);
  }, [graphRef, selection]);

  /** Computed here rather than returned by `setAxisHighlight`: a count handed
   * back at push time would go stale the moment a node is added or hidden,
   * and this message has to follow the canvas. */
  const matched = useMemo(() => {
    if (!selection) return true;
    const lit = displayedApplications.some((app) =>
      applicationMatches(
        app.dataObjects.map((o) => o.id),
        app.businessCapabilities.map((c) => c.id),
        selection,
      ),
    );
    if (lit) return true;
    return contents.interfaces.some((i) =>
      matchesAxis(new Set(i.dataObjectIds), selection.dataObjects, selection.join),
    );
  }, [selection, displayedApplications, contents]);

  return (
    <>
      {!matched && (
        <p className="text-xs text-muted">
          Nothing on the canvas matches this selection.
        </p>
      )}

      <Chapter
        label="Data Object"
        loading={loadingDataObjects}
        hasTree={!!dataObjectTree}
        count={dataObjectIds.length}
        onClear={() => onDataObjectIdsChange([])}
      >
        {/* Says *interfaces*, not applications, on purpose: ticking it makes
            data objects with a non-zero application count disappear, and
            without the wording that reads as a bug. */}
        <label className="mb-2 flex cursor-pointer items-start gap-1.5 text-[11px] text-fg">
          <input
            type="checkbox"
            checked={legendOn}
            onChange={(e) => setDataObjectLegendEnabled(e.target.checked)}
            className="mt-0.5 shrink-0 accent-[var(--color-accent)]"
          />
          <span>
            Only what flows on the diagram
            <span className="block text-muted">
              Keeps the data objects carried by a visible interface, and colours
              them on the flows.
            </span>
          </span>
        </label>

        {dataObjectTree && carried?.size === 0 && (
          <p className="text-xs text-muted">No data object flows on this diagram.</p>
        )}
        {dataObjectTree && carried?.size !== 0 && (
          <HierarchyTreeFilter
            tree={dataObjectTree}
            searchPlaceholder="Search data objects…"
            emptyLabel="No data object matches."
            counts={dataObjectCounts}
            value={dataObjectIds}
            onChange={onDataObjectIdsChange}
            restrictTo={restrictTo}
            dots={dots}
          />
        )}
      </Chapter>

      <Chapter
        label="Business Capabilities"
        loading={loadingCapabilities}
        hasTree={!!capabilityTree}
        count={capabilityIds.length}
        onClear={() => onCapabilityIdsChange([])}
      >
        {/* Names applications, where the Data Object one names interfaces —
            the two axes are restricted on different links, and the labels are
            what keeps that readable. */}
        <label className="mb-2 flex cursor-pointer items-start gap-1.5 text-[11px] text-fg">
          <input
            type="checkbox"
            checked={legendCapabilitiesOn}
            onChange={(e) => setCapabilityLegendEnabled(e.target.checked)}
            className="mt-0.5 shrink-0 accent-[var(--color-accent)]"
          />
          <span>
            Only what the diagram covers
            <span className="block text-muted">
              Keeps the capabilities carried by a visible application, and
              colours them on the rectangles.
            </span>
          </span>
        </label>

        {capabilityTree && capabilityRestrictTo?.size === 0 && (
          <p className="text-xs text-muted">No capability is covered on this diagram.</p>
        )}
        {capabilityTree && capabilityRestrictTo?.size !== 0 && (
          <HierarchyTreeFilter
            tree={capabilityTree}
            searchPlaceholder="Search capabilities…"
            emptyLabel="No capability matches."
            counts={capabilityCounts}
            value={capabilityIds}
            onChange={onCapabilityIdsChange}
            restrictTo={capabilityRestrictTo}
            dots={capabilityDots}
          />
        )}
      </Chapter>
    </>
  );
}

/**
 * One chapter, unfolded by default — unlike the catalogue's, this panel exists
 * only to be used, and arriving on two folded titles would hide its point.
 *
 * Its loading and error states are its own: unlike the catalogue and the map,
 * `/discover` does not load the hierarchies, so a direct visit pays for the
 * crawl here. A failed crawl must cost this chapter and nothing else.
 */
function Chapter({
  label,
  loading,
  hasTree,
  count,
  onClear,
  children,
}: {
  label: string;
  loading: boolean;
  hasTree: boolean;
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  // Folded on open, like the catalogue's filter chapters: the panel shows
  // which axes exist before it shows two long trees.
  const [open, setOpen] = useState(false);
  return (
    <FilterSection
      label={label}
      count={count}
      open={open}
      onToggle={() => setOpen((v) => !v)}
      action={
        count > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-[10px] font-medium normal-case tracking-normal text-muted underline underline-offset-2 hover:text-accent"
          >
            Clear
          </button>
        ) : undefined
      }
    >
      {/* The unit is spelled out: ticking a data object also lights interfaces
          and flows, which this number does not count. Applications outside the
          catalogue are counted nowhere. */}
      <p className="mb-2 text-[10px] text-muted">
        Counts are applications on the diagram.
      </p>
      {loading && <p className="text-xs text-muted">Loading…</p>}
      {!loading && !hasTree && (
        <p className="text-xs text-muted">This hierarchy could not be loaded.</p>
      )}
      {children}
    </FilterSection>
  );
}
