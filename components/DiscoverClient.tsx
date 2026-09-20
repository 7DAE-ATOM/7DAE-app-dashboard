"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useApplications } from "@/lib/useApplications";
import { consumeSeedIds, parseSeedIds } from "@/lib/discoverSeed";
import type { Application, DiscoverApplicationNode } from "@/lib/types";
import ApplicationSearch from "@/components/discover/ApplicationSearch";
import SelectedApplicationsBar from "@/components/discover/SelectedApplicationsBar";
import DiscoverDisplaySettings from "@/components/discover/DiscoverDisplaySettings";
import DiscoverExportMenu, {
  type ExportFormat,
} from "@/components/discover/DiscoverExportMenu";
import DiscoverViewModeToggle from "@/components/discover/DiscoverViewModeToggle";
import DiscoverInfoIconsToggle from "@/components/discover/DiscoverInfoIconsToggle";
import DataObjectColorsSync from "@/components/discover/DataObjectColorsSync";
import DiscoverHighlightPanel from "@/components/discover/DiscoverHighlightPanel";
import DiagramSaveControls from "@/components/discover/DiagramSaveControls";
import type {
  DiscoverGraphHandle,
  PendingDiagramLoad,
} from "@/components/discover/DiscoverGraph";
import {
  deleteDiagramSave,
  downloadDiagramSave,
  listDiagramSaves,
  loadDiagramSave,
  writeDiagramSave,
  type DiscoverDiagramSave,
} from "@/lib/discoverDiagramSaves";
import { toMermaid } from "@/lib/discoverMermaid";
import { downloadBlob, exportDateStamp } from "@/lib/downloadBlob";
import { ImageExportTooLargeError } from "@/lib/discoverImageExport";

const DiscoverGraph = dynamic(() => import("@/components/discover/DiscoverGraph"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2 skeleton-pulse" />,
});

function toDiscoverApplicationNode(app: Application): DiscoverApplicationNode {
  return {
    kind: "application",
    id: app.id,
    externalId: app.externalId,
    name: app.name,
    managerName: app.manager?.name ?? null,
  };
}

/** Same shell as `MapClient`/`InteractionClient`: loading/error handled here,
 * the xyflow canvas lazy-loaded client-side only (needs `window`). */
export default function DiscoverClient() {
  const { applications, loading, error } = useApplications();
  const [selected, setSelected] = useState<Application[]>([]);
  const graphRef = useRef<DiscoverGraphHandle>(null);
  const searchParams = useSearchParams();

  const applicationsById = useMemo(
    () => new Map(applications.map((a) => [a.id, a])),
    [applications],
  );

  /** `?ids=` is a **seed**, read once: the selection the catalogue's "Show in
   * Discover" button captured. Later additions/removals deliberately don't
   * rewrite the URL, so the link stays a stable, shareable entry point. */
  /** Two accepted forms: `?ids=` (small selections, a real shareable link)
   * and `?seed=<token>`, which resolves through storage — see
   * `lib/discoverSeed.ts`. `ids` wins when both are present. A token that no
   * longer resolves is reported as expired rather than shown as an empty
   * graph. */
  const { seedIds, seedExpired } = useMemo(() => {
    const fromUrl = parseSeedIds(searchParams.get("ids")).ids;
    if (fromUrl.length > 0) return { seedIds: fromUrl, seedExpired: false };
    const token = searchParams.get("seed");
    if (!token) return { seedIds: [] as string[], seedExpired: false };
    const stored = consumeSeedIds(token);
    return { seedIds: stored ?? [], seedExpired: stored === null };
  }, [searchParams]);
  const seedApplications = useMemo(
    () =>
      loading
        ? []
        : seedIds
            .map((id) => applicationsById.get(id))
            .filter((app): app is Application => !!app),
    [loading, seedIds, applicationsById],
  );
  // Unlike `ApplicationSearch` (which skips applications without an
  // externalId), the seed accepts every resolved application — the graph
  // identifies nodes by technical id.
  const seedNodes = useMemo(
    () => (seedApplications.length > 0 ? seedApplications.map(toDiscoverApplicationNode) : undefined),
    [seedApplications],
  );
  const unresolved = loading ? 0 : seedIds.length - seedApplications.length;
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [expiredDismissed, setExpiredDismissed] = useState(false);

  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || seedApplications.length === 0) return;
    seededRef.current = true;
    setSelected(seedApplications);
  }, [seedApplications]);

  const resolveManagerName = useCallback(
    (applicationId: string) => applicationsById.get(applicationId)?.manager?.name ?? null,
    [applicationsById],
  );
  const resolveApplication = useCallback(
    (applicationId: string) => applicationsById.get(applicationId) ?? null,
    [applicationsById],
  );

  /* ---------------------------------------------------------------- *
   * Named diagrams. Same division of labour as `/depgraph`'s
   * `InteractionClient`: this component owns the active save, the dirty
   * flag and the save list; the canvas is read on demand (`getDiagram`),
   * never pushed up on every drag frame.
   * ---------------------------------------------------------------- */
  const [activeSaveName, setActiveSaveName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pendingLoad, setPendingLoad] = useState<PendingDiagramLoad | null>(null);
  const [saveVersion, setSaveVersion] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);

  // `saveVersion` is a pure refresh trigger — bumped after every write or
  // delete, even though `listDiagramSaves()` doesn't read it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saves = useMemo(() => listDiagramSaves(), [saveVersion]);

  /** Stable on purpose. `DiscoverGraph` is not memoized and these are
   * dependencies of its effects: an inline arrow would get a new identity on
   * every render — including the one right after a save calls `setDirty(false)`
   * — re-fire those effects and flip `dirty` straight back to true. */
  const handleDirty = useCallback(() => setDirty(true), []);

  /** The graph is done with `pendingLoad`, one way or the other. On failure
   * nothing was committed, so the canvas still holds the previous diagram and
   * the active save stays as it was. */
  const handleLoadSettled = useCallback((error: string | null) => {
    setPendingLoad(null);
    if (error) setSaveError(error);
  }, []);

  /** Adding or removing an application makes the canvas something other than
   * what was saved, so it detaches from the active save — as on `/depgraph`. */
  const detachActiveSave = useCallback(() => {
    setActiveSaveName(null);
    setDirty(false);
  }, []);

  const handleSelect = useCallback(
    (app: Application) => {
      setSelected((current) => (current.some((a) => a.id === app.id) ? current : [...current, app]));
      graphRef.current?.addApplication(toDiscoverApplicationNode(app));
      detachActiveSave();
    },
    [detachActiveSave],
  );

  const handleRemove = useCallback(
    (id: string) => {
      setSelected((current) => current.filter((a) => a.id !== id));
      graphRef.current?.removeApplication(id);
      detachActiveSave();
    },
    [detachActiveSave],
  );

  /** "Hide" on a selected node: the graph has already dropped the node and
   * pruned what it anchored, so only the chip is left to remove here. */
  const handleHidden = useCallback(
    (id: string) => {
      setSelected((current) => current.filter((a) => a.id !== id));
      detachActiveSave();
    },
    [detachActiveSave],
  );

  const handleSaveAs = useCallback((name: string) => {
    const content = graphRef.current?.getDiagram();
    if (!content) return;
    const ok = writeDiagramSave(name, {
      version: 1,
      savedAt: new Date().toISOString(),
      ...content,
    });
    if (!ok) {
      setSaveError("Could not save (storage unavailable or full).");
      return;
    }
    setSaveError(null);
    setActiveSaveName(name);
    setDirty(false);
    setSaveVersion((v) => v + 1);
  }, []);

  const handleSave = useCallback(() => {
    if (!activeSaveName) return; // the controls route this to Save as new
    handleSaveAs(activeSaveName);
  }, [activeSaveName, handleSaveAs]);

  const handleLoad = useCallback(
    (name: string) => {
      const save = loadDiagramSave(name);
      if (!save) {
        setSaveError("This diagram could not be read.");
        return;
      }
      // Ids that no longer resolve are dropped, exactly as an unresolvable
      // `?ids=` entry is — but a diagram whose every root has gone would draw
      // an empty canvas, so that is refused instead.
      const applications = save.applications
        .map((a) => applicationsById.get(a.id))
        .filter((app): app is Application => !!app);
      const roots = save.rootIds.filter((id) => applicationsById.has(id));
      if (roots.length === 0) {
        setSaveError("None of this diagram's applications exist in the catalogue anymore.");
        return;
      }
      setSaveError(null);
      // The selection is replaced in memory only. Unlike `/depgraph`, which
      // keeps its selection in the URL, `?ids=`/`?seed=` here is a seed read
      // once — rewriting it would turn a shared link into mutable state and
      // replay the seed on the next reload.
      setSelected(roots.map((id) => applicationsById.get(id)!));
      setPendingLoad({
        content: save,
        applications: applications.map(toDiscoverApplicationNode),
      });
      setActiveSaveName(name);
      setDirty(false);
    },
    [applicationsById],
  );

  const handleDeleteSave = useCallback(
    (name: string) => {
      deleteDiagramSave(name);
      if (activeSaveName === name) detachActiveSave();
      setSaveVersion((v) => v + 1);
    },
    [activeSaveName, detachActiveSave],
  );

  /** Exports the diagram **as it stands**, unsaved changes included. */
  const handleExportActive = useCallback(() => {
    if (!activeSaveName) return;
    const content = graphRef.current?.getDiagram();
    if (!content) return;
    downloadDiagramSave(activeSaveName, {
      version: 1,
      savedAt: new Date().toISOString(),
      ...content,
    });
  }, [activeSaveName]);

  /** Exports a diagram **as stored** — the row action in the Load list. */
  const handleExportSave = useCallback((name: string) => {
    const save = loadDiagramSave(name);
    if (!save) {
      setSaveError("This diagram could not be read.");
      return;
    }
    downloadDiagramSave(name, save);
  }, []);

  const handleImport = useCallback((name: string, data: DiscoverDiagramSave) => {
    if (!writeDiagramSave(name, data)) {
      setSaveError("Could not save (storage unavailable or full).");
      return;
    }
    setSaveError(null);
    setSaveVersion((v) => v + 1);
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((a) => a.id)), [selected]);

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportError(null);
    setExporting(format);
    try {
      if (format === "mermaid") {
        const graph = graphRef.current?.snapshot();
        if (!graph) return;
        const blob = new Blob([toMermaid(graph)], { type: "text/plain;charset=utf-8" });
        downloadBlob(blob, `discover-export-${exportDateStamp()}.mmd`);
        return;
      }
      const blob = await graphRef.current?.exportImage(format);
      if (!blob) return;
      downloadBlob(blob, `discover-export-${exportDateStamp()}.${format}`);
    } catch (e) {
      // A refused PNG is an expected outcome on a huge graph, not a bug: it
      // gets a message that points at the formats which do scale.
      setExportError(
        e instanceof ImageExportTooLargeError
          ? e.message
          : `Export failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setExporting(null);
    }
  }, []);

  if (error) throw error;

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface p-3">
        <ApplicationSearch applications={applications} excludeIds={selectedIds} onSelect={handleSelect} />
        <SelectedApplicationsBar applications={selected} onRemove={handleRemove} />
        <div className="ml-auto flex items-center gap-2">
          <DiscoverViewModeToggle />
          <DiscoverInfoIconsToggle />
          {/* Roots are the graph's only anchors, and anything no longer
              reachable from one is pruned — so "no chip" means "empty
              canvas", and there is nothing to export. */}
          <DiscoverExportMenu
            disabled={selected.length === 0}
            busy={exporting}
            onExport={(format) => void handleExport(format)}
          />
          <DiscoverDisplaySettings />
          {/* Last in the group: the "file" family is added without moving
              any of the landmarks the toolbar already had. */}
          <DiagramSaveControls
            activeSaveName={activeSaveName}
            dirty={dirty}
            saves={saves}
            errorMessage={saveError}
            disableSave={selected.length === 0}
            loading={pendingLoad !== null}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onLoad={handleLoad}
            onDelete={handleDeleteSave}
            onExportActive={handleExportActive}
            onExportSave={handleExportSave}
            onImport={handleImport}
            onImportError={setSaveError}
          />
        </div>
      </div>
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-muted font-mono">Loading applications…</span>
          </div>
        ) : (
          <>
            {/* Always mounted (even with zero nodes) so `graphRef` is ready
             * the instant a first application is selected — a conditional
             * mount would make that very first `addApplication` call a
             * no-op, since the ref wouldn't exist until the next render. */}
            <DiscoverGraph
              ref={graphRef}
              resolveManagerName={resolveManagerName}
              resolveApplication={resolveApplication}
              seed={seedNodes}
              onApplicationHidden={handleHidden}
              pendingLoad={pendingLoad}
              onLoadSettled={handleLoadSettled}
              onDirty={handleDirty}
            />
            {/* Reads the canvas through `lib/discoverCanvasContents.ts` and
                pushes its selection through `graphRef` — no state of its own
                up here, so ticking a box never re-renders the graph. */}
            <DiscoverHighlightPanel
              graphRef={graphRef}
              applicationsById={applicationsById}
            />
            {/* Renders nothing: it publishes the data-object palette, which
                has to survive the panel being folded. */}
            <DataObjectColorsSync />
            {/* top-14: below the graph's own seed loading/error strip. */}
            {seedExpired && !expiredDismissed && (
              <div className="absolute left-1/2 top-14 z-10 flex -translate-x-1/2 items-center gap-3 rounded border border-border bg-surface px-3 py-2 text-xs text-muted shadow-lg">
                <span>This Discover link has expired — reopen it from the catalogue.</span>
                <button
                  type="button"
                  onClick={() => setExpiredDismissed(true)}
                  className="shrink-0 hover:text-fg"
                >
                  Dismiss
                </button>
              </div>
            )}
            {unresolved > 0 && !noticeDismissed && (
              <div className="absolute left-1/2 top-14 z-10 flex -translate-x-1/2 items-center gap-3 rounded border border-border bg-surface px-3 py-2 text-xs text-muted shadow-lg">
                <span>
                  {unresolved} application{unresolved > 1 ? "s" : ""} from this link could not be
                  shown.
                </span>
                <button
                  type="button"
                  onClick={() => setNoticeDismissed(true)}
                  className="shrink-0 hover:text-fg"
                >
                  Dismiss
                </button>
              </div>
            )}
            {exportError && (
              <div className="absolute left-1/2 top-14 z-10 flex -translate-x-1/2 items-center gap-3 rounded border border-border bg-surface px-3 py-2 text-xs text-muted shadow-lg">
                <span>{exportError}</span>
                <button
                  type="button"
                  onClick={() => setExportError(null)}
                  className="shrink-0 hover:text-fg"
                >
                  Dismiss
                </button>
              </div>
            )}
            {selected.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="text-sm text-muted">
                  Search and select an application to start exploring its dependencies.
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
