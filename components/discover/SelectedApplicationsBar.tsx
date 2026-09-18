"use client";

import { useState } from "react";
import ApplicationChip from "@/components/discover/ApplicationChip";
import ZoomIcon from "@/components/icons/ZoomIcon";
import SelectedApplicationsDialog from "@/components/discover/SelectedApplicationsDialog";
import type { Application } from "@/lib/types";

type Props = {
  applications: Application[];
  onRemove: (id: string) => void;
};

/** Adapted verbatim from `/depgraph`'s `SelectedBenchesBar` — a chip list,
 * plus a magnifier opening the same list in a dialog when the compact bar
 * gets too cramped to read.
 *
 * The dialog's open state lives here on purpose: the bar unmounts as soon as
 * the selection is empty, which closes the dialog for free when the last
 * application is removed from inside it. */
export default function SelectedApplicationsBar({ applications, onRemove }: Readonly<Props>) {
  const [open, setOpen] = useState(false);

  if (applications.length === 0) return null;

  return (
    <div className="relative h-10 min-w-[140px] max-w-xl flex-1 basis-52">
      <div className="flex h-full flex-wrap content-start gap-1.5 overflow-y-auto rounded-card border border-border bg-surface p-1.5">
        {applications.map((a) => (
          <ApplicationChip key={a.id} application={a} onRemove={onRemove} />
        ))}
      </div>

      {/* Straddles the bar's top-left corner rather than sitting inside it:
       * anywhere inside would overlap either a chip or the scrollbar. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Agrandir la liste des applications sélectionnées"
        title="Agrandir la liste des applications sélectionnées"
        className="absolute -left-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ZoomIcon size={11} />
      </button>

      {open && (
        <SelectedApplicationsDialog
          applications={applications}
          onRemove={onRemove}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
