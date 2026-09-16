"use client";

import { useState } from "react";
import { useSearchParams, notFound } from "next/navigation";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import ApplicationHeader from "@/components/ApplicationHeader";
import Gallery, { type GalleryEmbedOverride } from "@/components/Gallery";
import Tabs, { type TabItem } from "@/components/detail/Tabs";
import IdentityTab from "@/components/detail/IdentityTab";
import AccountabilityTab from "@/components/detail/AccountabilityTab";
import ComplianceTab from "@/components/detail/ComplianceTab";
import DocumentationTab from "@/components/detail/DocumentationTab";
import DataTab from "@/components/detail/DataTab";
import InContextTab from "@/components/detail/InContextTab";
import { getApplicationByExternalId } from "@/lib/applications";
import { SWR_KEY_APPLICATIONS } from "@/lib/useApplications";
import { getCatalogueState } from "@/lib/appFilters";
import type { Application, LinkedResourceRef } from "@/lib/types";

function DetailSkeleton() {
  return (
    <main className="px-4 md:px-8 py-8 max-w-[1400px] mx-auto">
      <div className="h-4 w-24 rounded bg-surface-2 skeleton-pulse mb-6" />
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div className="aspect-[4/3] rounded-card bg-surface-2 skeleton-pulse" />
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded bg-surface-2 skeleton-pulse" />
          <div className="h-4 w-1/2 rounded bg-surface-2 skeleton-pulse" />
          <div className="h-4 w-2/3 rounded bg-surface-2 skeleton-pulse" />
        </div>
      </div>
    </main>
  );
}

export default function ApplicationDetailClient() {
  const searchParams = useSearchParams();
  const externalId = searchParams.get("id") ?? "";
  const { cache } = useSWRConfig();
  const [activeResource, setActiveResource] = useState<LinkedResourceRef | null>(
    null,
  );

  // Cache-first: if the catalogue/map already loaded the list, serve the item
  // from memory (no network). `fallbackData` makes SWR skip the fetch entirely.
  const cachedList = cache.get(SWR_KEY_APPLICATIONS)?.data as
    | Application[]
    | undefined;
  const fallbackData = cachedList?.find((m) => m.externalId === externalId);

  const { data: app, error } = useSWR(
    externalId ? ["application", externalId] : null,
    () => getApplicationByExternalId(externalId),
    { fallbackData },
  );

  if (error) throw error;
  if (!externalId) return notFound();
  if (app === undefined) return <DetailSkeleton />;
  if (app === null) return notFound();

  // Restore the catalogue with its remembered page (filters live in the store
  // and are reapplied on mount). The "Catalogue" menu, by contrast, resets them.
  const backPage = getCatalogueState().page;
  const backHref = backPage > 1 ? `/?page=${backPage}` : "/";

  const resourceOverride: GalleryEmbedOverride = activeResource
    ? {
        name: activeResource.name,
        embedUrl: activeResource.embedUrl,
        rawUrl: activeResource.url,
      }
    : null;

  const tabs: TabItem[] = [
    { id: "identity", label: "Identity", content: <IdentityTab application={app} /> },
    {
      id: "accountability",
      label: "Accountability",
      content: <AccountabilityTab application={app} />,
    },
    {
      id: "compliance",
      label: "Compliance",
      content: <ComplianceTab application={app} />,
    },
    {
      id: "documentation",
      label: "Documentation",
      content: <DocumentationTab application={app} />,
    },
    {
      id: "data",
      label: "DATA",
      content: <DataTab application={app} />,
    },
    {
      id: "in-context",
      label: "In Context",
      content: <InContextTab application={app} />,
    },
  ];

  return (
    <main className="px-4 md:px-8 py-8 max-w-[1400px] mx-auto">
      <Link
        href={backHref}
        className="inline-block text-xs font-mono text-muted hover:text-fg mb-6"
      >
        ← Back to catalog
      </Link>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
        <div className="space-y-6">
          <Gallery
            photos={app.photos}
            name={app.name}
            externalId={app.externalId}
            resources={app.linkedResources}
            activeResourceId={activeResource?.id ?? null}
            onSelectResource={(resource) => setActiveResource(resource)}
            resourceOverride={resourceOverride}
            onPhotoSelect={() => setActiveResource(null)}
          />
          <Tabs items={tabs} />
        </div>
        <div className="space-y-6">
          <ApplicationHeader application={app} />
        </div>
      </div>
    </main>
  );
}
