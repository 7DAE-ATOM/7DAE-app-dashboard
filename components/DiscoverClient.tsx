"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useApplications } from "@/lib/useApplications";
import { parseSeedIds } from "@/lib/discoverSeed";
import type { Application, DiscoverApplicationNode } from "@/lib/types";
import ApplicationSearch from "@/components/discover/ApplicationSearch";
import SelectedApplicationsBar from "@/components/discover/SelectedApplicationsBar";
import DiscoverDisplaySettings from "@/components/discover/DiscoverDisplaySettings";
import type { DiscoverGraphHandle } from "@/components/discover/DiscoverGraph";

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
  const { ids: seedIds, truncated } = useMemo(
    () => parseSeedIds(searchParams.get("ids")),
    [searchParams],
  );
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
  const unresolved = truncated + (loading ? 0 : seedIds.length - seedApplications.length);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

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

  const handleSelect = useCallback((app: Application) => {
    setSelected((current) => (current.some((a) => a.id === app.id) ? current : [...current, app]));
    graphRef.current?.addApplication(toDiscoverApplicationNode(app));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setSelected((current) => current.filter((a) => a.id !== id));
    graphRef.current?.removeApplication(id);
  }, []);

  const selectedIds = useMemo(() => new Set(selected.map((a) => a.id)), [selected]);

  if (error) throw error;

  return (
    <div className="flex h-[calc(100vh-57px)] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-surface p-3">
        <ApplicationSearch applications={applications} excludeIds={selectedIds} onSelect={handleSelect} />
        <SelectedApplicationsBar applications={selected} onRemove={handleRemove} />
        <div className="ml-auto">
          <DiscoverDisplaySettings />
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
            />
            {/* top-14: below the graph's own seed loading/error strip. */}
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
