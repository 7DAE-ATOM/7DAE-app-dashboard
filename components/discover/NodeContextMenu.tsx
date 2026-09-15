"use client";

import { useEffect, useRef } from "react";

export type DiscoverContextMenuTarget = {
  nodeId: string;
  x: number;
  y: number;
  variant: "application" | "interface";
  /** Interfaces provided by this Application already displayed as circles
   * ("Show API"). Always `0` on the Interface variant (no such action there). */
  apiShown: number;
  apiTotal: number;
  /** Distinct consumer apps already displayed on the graph (edge drawn). */
  consumersShown: number;
  /** Distinct consumer apps that could be displayed in total, across every
   * interface this node is attached to (shown or not) — "Show Consumers" is
   * disabled once `consumersShown` reaches this number. */
  consumersTotal: number;
  /** Same pair as `consumersShown`/`consumersTotal`, but for provider apps of
   * the interfaces this Application consumes ("Show providers"). Always `0`
   * on the Interface variant (no such action there). */
  providersShown: number;
  providersTotal: number;
  canHide: boolean;
};

type Props = {
  target: DiscoverContextMenuTarget | null;
  onClose: () => void;
  onShowInterfacesInbound: (nodeId: string) => void;
  onShowInterfacesOutbound: (nodeId: string) => void;
  onShowDependencies: (nodeId: string) => void;
  onHide: (nodeId: string) => void;
};

function formatCount(n: number): string {
  return n < 0 ? "…" : String(n);
}

function MenuItem({
  label,
  count,
  countTooltip,
  secondaryCount,
  secondaryCountTooltip,
  disabled: disabledOverride,
  onClick,
}: Readonly<{
  label: string;
  count: number;
  countTooltip: string;
  secondaryCount?: number;
  secondaryCountTooltip?: string;
  /** Overrides the default `count === 0` disabling rule — needed for "Show
   * Consumers", where `count` (shown) being 0 doesn't mean there's nothing
   * left to reveal. */
  disabled?: boolean;
  onClick: () => void;
}>) {
  // `count === -1` means "not fetched yet" — stays enabled (clicking is what
  // triggers the fetch) and shows "…" instead of a number.
  const disabled = disabledOverride ?? count === 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm ${
        disabled ? "opacity-60 cursor-default" : "hover:bg-surface-2"
      }`}
    >
      <span className="text-fg">{label}</span>
      <span className="text-xs text-muted">
        {secondaryCount === undefined ? (
          <span title={countTooltip}>{formatCount(count)}</span>
        ) : (
          <>
            <span title={countTooltip}>{formatCount(count)}</span>
            {" / "}
            <span title={secondaryCountTooltip}>{formatCount(secondaryCount)}</span>
          </>
        )}
      </span>
    </button>
  );
}

/** Adapted from `/depgraph`'s `NodeContextMenu` — same popover/positioning
 * and Escape/outside-click dismissal, with the Application/Interface action
 * vocabulary from the Discover spec instead of bench relation kinds. */
export default function NodeContextMenu({
  target,
  onClose,
  onShowInterfacesInbound,
  onShowInterfacesOutbound,
  onShowDependencies,
  onHide,
}: Readonly<Props>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // Capture phase: React Flow's own node/pane handlers call
    // `stopPropagation()` on mousedown (for drag/pan) during the bubble
    // phase, which would otherwise swallow left-clicks on the canvas before
    // this listener ever saw them. Capture runs before that, so both left-
    // and right-clicks anywhere outside the menu close it.
    document.addEventListener("mousedown", onMouseDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onMouseDown, true);
    };
  }, [target, onClose]);

  if (!target) return null;

  return (
    <div
      ref={ref}
      role="menu"
      className="absolute z-20 min-w-[220px] overflow-hidden rounded-card border border-border bg-surface py-1 shadow-lg"
      style={{ left: target.x, top: target.y }}
    >
      {target.variant === "application" ? (
        <>
          <MenuItem
            label="Show API"
            count={target.apiShown}
            countTooltip="Interfaces provided by this application currently displayed on the graph"
            secondaryCount={target.apiTotal}
            secondaryCountTooltip="Total interfaces provided by this application that can be displayed"
            disabled={target.apiTotal !== -1 && target.apiShown >= target.apiTotal}
            onClick={() => onShowInterfacesInbound(target.nodeId)}
          />
          <MenuItem
            label="Show Consumers"
            count={target.consumersShown}
            countTooltip="Consumer applications currently displayed on the graph"
            secondaryCount={target.consumersTotal}
            secondaryCountTooltip="Total consumer applications that can be displayed"
            disabled={target.consumersTotal !== -1 && target.consumersShown >= target.consumersTotal}
            onClick={() => onShowDependencies(target.nodeId)}
          />
          <MenuItem
            label="Show providers"
            count={target.providersShown}
            countTooltip="Provider applications currently displayed on the graph"
            secondaryCount={target.providersTotal}
            secondaryCountTooltip="Total provider applications that can be displayed"
            disabled={target.providersTotal !== -1 && target.providersShown >= target.providersTotal}
            onClick={() => onShowInterfacesOutbound(target.nodeId)}
          />
        </>
      ) : (
        <MenuItem
          label="Show Consumers"
          count={target.consumersShown}
          countTooltip="Consumer applications currently displayed on the graph"
          secondaryCount={target.consumersTotal}
          secondaryCountTooltip="Total consumer applications that can be displayed"
          disabled={target.consumersTotal !== -1 && target.consumersShown >= target.consumersTotal}
          onClick={() => onShowDependencies(target.nodeId)}
        />
      )}
      <div className="my-1 border-t border-border" />
      <button
        type="button"
        disabled={!target.canHide}
        onClick={() => onHide(target.nodeId)}
        className={`w-full px-3 py-1.5 text-left text-sm text-danger ${
          target.canHide ? "hover:bg-surface-2" : "opacity-60 cursor-default"
        }`}
      >
        Hide
      </button>
    </div>
  );
}
