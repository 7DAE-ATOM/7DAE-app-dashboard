"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { SWR_KEY_APPLICATIONS } from "@/lib/useApplications";
import { SWR_KEY_BUSINESS_CAPABILITIES } from "@/lib/useBusinessCapabilityTree";
import { SWR_KEY_DATA_OBJECTS } from "@/lib/useDataObjectTree";
import RefreshIcon from "@/components/icons/RefreshIcon";

/**
 * Forces a re-fetch of the applications and the Business Capability
 * hierarchy (the data with no automatic
 * revalidation — see `Providers`). Photo caches are left untouched.
 */
export default function RefreshButton() {
  const { mutate } = useSWRConfig();
  const [spinning, setSpinning] = useState(false);

  const onClick = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await Promise.all([
        mutate(SWR_KEY_APPLICATIONS),
        // Otherwise a refresh would leave the catalogue's capability filter
        // sitting on a stale hierarchy.
        mutate(SWR_KEY_BUSINESS_CAPABILITIES),
        mutate(SWR_KEY_DATA_OBJECTS),
      ]);
    } finally {
      setSpinning(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={spinning}
      aria-label="Refresh data"
      title="Refresh data"
      className="inline-flex items-center justify-center w-9 h-9 rounded text-muted hover:text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors disabled:opacity-60"
    >
      <RefreshIcon size={18} className={spinning ? "animate-spin" : undefined} />
    </button>
  );
}
