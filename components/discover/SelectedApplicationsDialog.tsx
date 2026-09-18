"use client";

import { useEffect, useRef } from "react";
import CloseIcon from "@/components/icons/CloseIcon";
import ApplicationChip from "@/components/discover/ApplicationChip";
import type { Application } from "@/lib/types";

type Props = {
  applications: Application[];
  onRemove: (id: string) => void;
  onClose: () => void;
};

/**
 * Enlarged view of the Discover selection — same chips as the compact
 * toolbar bar, same remove action, just room to breathe. Purely
 * presentational: no fetching, no sorting, no search (see spec
 * `loupe-agrandissement-applications-selectionnees-discover.md`).
 *
 * Overlay/focus/Escape handling mirrors `components/AboutDialog.tsx`.
 */
export default function SelectedApplicationsDialog({
  applications,
  onRemove,
  onClose,
}: Readonly<Props>) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="selected-applications-title"
        className="w-full max-w-2xl rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 id="selected-applications-title" className="text-base font-semibold text-fg">
            Applications sélectionnées ({applications.length})
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-wrap content-start gap-2 overflow-y-auto p-5">
          {applications.map((a) => (
            <ApplicationChip key={a.id} application={a} onRemove={onRemove} size="large" />
          ))}
        </div>
      </div>
    </div>
  );
}
