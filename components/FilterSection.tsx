"use client";

import clsx from "clsx";
import { useId, type ReactNode } from "react";
import ChevronIcon from "@/components/icons/ChevronIcon";

/** Level-2 chapter of a filter block: a rounded card whose foldable header
 * carries the axis name, its active-value count and the triangle.
 *
 * The body is hidden with the native `hidden` attribute rather than dropped
 * from the tree, so folding a chapter keeps whatever local state its content
 * holds — notably `HierarchyTreeFilter`'s own expanded nodes and search text.
 *
 * It lives in its own file rather than inside `FilterBar` because Discover's
 * highlight panel renders the same chapters: importing it from `FilterBar`
 * would pull that whole module — every flat axis, every catalogue label —
 * into the `/discover` bundle for forty lines of markup. Nothing here knows
 * which panel it is rendering; `open`/`onToggle` are the caller's business. */
export default function FilterSection({
  label,
  count,
  open,
  onToggle,
  action,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  /** Sits between the label and the count — the per-axis "Clear" link on the
   * two hierarchical axes. A sibling of the toggle button, never a child:
   * nesting a button inside a button is invalid markup. */
  action?: ReactNode;
  children: ReactNode;
}) {
  const bodyId = useId();
  const headerClass =
    "flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-accent";
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className={clsx("flex w-full items-center gap-2", open && "mb-3")}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className={clsx(headerClass, "min-w-0 flex-1")}
        >
          <span className="truncate">{label}</span>
        </button>
        {action}
        {/* Pointer-only twin of the button above: it toggles the same section,
            so it is kept out of the tab order and hidden from assistive tech
            rather than announced twice. */}
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-hidden="true"
          className={clsx(headerClass, "shrink-0")}
        >
          {count > 0 && (
            <span className="font-mono text-[11px] normal-case tracking-normal">
              {count}
            </span>
          )}
          {/* Points up while open, down while folded. */}
          <ChevronIcon
            className={clsx(
              "transition-transform",
              open ? "-rotate-90" : "rotate-90",
            )}
          />
        </button>
      </div>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
  );
}
