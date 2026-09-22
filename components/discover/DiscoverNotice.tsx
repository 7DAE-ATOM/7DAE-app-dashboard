"use client";

import type { ReactNode } from "react";

/**
 * The transient strip Discover uses to say something happened: an expired
 * link, applications a link couldn't resolve, a failed export, the result of
 * an action.
 *
 * Extracted once `DiscoverClient` held four copies of the same markup. Its
 * position is part of the contract — `top-14` sits it just under the graph's
 * own loading strip, so two notices never land on top of each other.
 */
export default function DiscoverNotice({
  children,
  onDismiss,
}: Readonly<{ children: ReactNode; onDismiss: () => void }>) {
  return (
    <div className="absolute left-1/2 top-14 z-10 flex -translate-x-1/2 items-center gap-3 rounded border border-border bg-surface px-3 py-2 text-xs text-muted shadow-lg">
      <span>{children}</span>
      <button type="button" onClick={onDismiss} className="shrink-0 hover:text-fg">
        Dismiss
      </button>
    </div>
  );
}
