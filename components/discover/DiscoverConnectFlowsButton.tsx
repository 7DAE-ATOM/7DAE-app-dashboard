"use client";

import clsx from "clsx";
import ConnectFlowsIcon from "@/components/icons/ConnectFlowsIcon";

/**
 * Draws the flows that exist between the applications already on the canvas
 * and aren't drawn yet.
 *
 * Its neighbours in the toolbar are toggles; this one is an **action**, and
 * that has to show: no `aria-pressed`, no filled state it could stay stuck
 * in. While it works it says so and can't be fired again.
 *
 * Driven by props rather than by a store, unlike the toggles around it: the
 * work happens inside the graph, behind the imperative handle, and only the
 * parent holds that ref.
 */
export default function DiscoverConnectFlowsButton({
  disabled,
  busy,
  onClick,
}: Readonly<{ disabled: boolean; busy: boolean; onClick: () => void }>) {
  const label = "Connect the flows between the applications shown";
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      aria-label={label}
      // Spells out what it will *not* do: "all the relations" could be read as
      // a promise to go looking further afield.
      title={
        busy
          ? "Connecting flows…"
          : `${label} — adds no new application`
      }
      className={clsx(
        "flex h-9 w-9 items-center justify-center rounded border border-border bg-surface transition-colors",
        disabled || busy ? "text-muted opacity-60" : "text-muted hover:text-fg",
      )}
    >
      <ConnectFlowsIcon size={16} className={clsx(busy && "skeleton-pulse")} />
    </button>
  );
}
