"use client";

/***********************************************************
 * DropdownMenu — UI primitive: a panel anchored under a trigger.
 *
 *              [trigger]
 *   ┌───────────────────────┐   ← align="end": right edges line up
 *   │ children — free       │
 *   │ content, read or act  │
 *   └───────────────────────┘
 *
 * File structure:
 *
 *   1. IMPORTS — React hooks, usePathname, clsx.
 *   2. TYPES — DropdownChangeReason, DropdownAlign, DropdownMenuProps.
 *   3. CONSTANTS — ALIGN_CLASS, and `closeCurrent`, the module-level handle
 *      that keeps a single menu open at a time.
 *   4. COMPONENT FUNCTION —
 *      a. State & refs — the wrapper, the trigger, the latest onOpenChange.
 *      b. Effects — while open: take over from any other open menu, listen
 *         for Escape and for a pointer press outside; on a route change,
 *         ask to close.
 *      c. JSX return — the trigger button, then (only when open) the panel.
 *
 * COPIED VERBATIM from 7DAE-atom-cockpit (`components/ui/DropdownMenu.tsx`),
 * whose spec is `_specification/services/07-primitives-ui.md` §4.7 there.
 * Keep the two in step: the profile menu must behave identically in every
 * ATOM application. It borrows the conventions of a modal and deliberately
 * drops the rest:
 *
 *   - THE CALLER OWNS `open`. The primitive only
 *     ASKS, through `onOpenChange(next, reason)`; `reason` tells the four
 *     paths apart without re-implementing any of them.
 *   - NOTHING IS MOUNTED WHEN CLOSED: no panel, no global listener.
 *   - A CLICK INSIDE NEVER CLOSES IT, so text (an email address) can be
 *     selected and copied. "Outside" is a `contains` test on the wrapper,
 *     which holds the trigger too — so a click on the trigger is a toggle,
 *     not an outside press followed by a re-open.
 *   - ESCAPE RETURNS FOCUS TO THE TRIGGER; a keyboard user is never dropped
 *     at the top of the page.
 *   - ONE MENU AT A TIME: opening one asks the previous one to close.
 *   - A ROUTE CHANGE CLOSES IT: a panel left open over a new page reads as
 *     leftover state.
 *
 * What it is NOT, on purpose: not a modal (no overlay, no scroll lock, no
 * focus placed inside — the page stays usable), and not an ARIA `menu` —
 * its first client shows read-only information, not a list of commands, so
 * it is a non-modal `dialog`. Arrow-key navigation, items and sub-menus wait
 * for their first real use.
 *
 * The trigger's look is fixed here, identical to the other banner icon
 * buttons (About, theme toggle): a primitive takes no free style.
 *
 * Used on: components/UserMenu.tsx
 ***********************************************************/

import { useEffect, useId, useRef } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";

/***********************************************************
 * Types
 ***********************************************************/

/** Why the menu asks to change state. */
export type DropdownChangeReason = "trigger" | "escape" | "outside" | "route";

/** Which edge of the trigger the panel lines up with. */
export type DropdownAlign = "start" | "end";

interface DropdownMenuProps {
  /** Whether the panel is shown. Owned by the caller. */
  open: boolean;
  /** Asked by every path. The caller decides. */
  onOpenChange: (next: boolean, reason: DropdownChangeReason) => void;
  /** Accessible name of the trigger — the icon alone says nothing. */
  label: string;
  /** Content of the trigger button, usually an icon. */
  icon: React.ReactNode;
  /** Accessible name of the panel. Defaults to `label`. */
  panelLabel?: string;
  /** Defaults to "end": most triggers sit at the right of a bar. */
  align?: DropdownAlign;
  /** The panel's content. Padded by the caller. */
  children: React.ReactNode;
}

/***********************************************************
 * Constants
 ***********************************************************/

const ALIGN_CLASS: Record<DropdownAlign, string> = {
  start: "left-0",
  end: "right-0",
};

/**
 * Close request of the menu currently open, if any. Module-level on
 * purpose: two independent callers must still never show two panels.
 */
let closeCurrent: (() => void) | null = null;

export default function DropdownMenu({
  open,
  onOpenChange,
  label,
  icon,
  panelLabel,
  align = "end",
  children,
}: DropdownMenuProps) {
  /***********************************************************
   * State & refs
   ***********************************************************/

  const panelId = useId();
  const pathname = usePathname();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The latest callback, read by the listeners — same reason as in Dialog:
  // an inline arrow must not re-run the open effect on every render.
  const onChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onChangeRef.current = onOpenChange;
  });

  /***********************************************************
   * Effects — everything that exists only while open
   ***********************************************************/

  useEffect(() => {
    if (!open) return;

    const close = () => onChangeRef.current(false, "outside");
    if (closeCurrent && closeCurrent !== close) closeCurrent();
    closeCurrent = close;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onChangeRef.current(false, "escape");
      triggerRef.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      if (closeCurrent === close) closeCurrent = null;
    };
  }, [open]);

  // A new page closes the panel. Only on an actual CHANGE of path: the
  // first run of this effect is the mount, not a navigation.
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    onChangeRef.current(false, "route");
  }, [pathname]);

  /***********************************************************
   * Render
   ***********************************************************/

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(!open, "trigger")}
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex items-center justify-center w-9 h-9 rounded text-muted hover:text-fg hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
      >
        {icon}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={panelLabel ?? label}
          className={clsx(
            "absolute top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] break-words rounded-lg border border-border bg-surface text-fg shadow-xl",
            ALIGN_CLASS[align],
          )}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}
