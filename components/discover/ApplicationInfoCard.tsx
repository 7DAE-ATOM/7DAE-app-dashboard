"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Application } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/labels";
import GripIcon from "@/components/icons/GripIcon";
import { ResizeHandle, useDragMove, useDragResizeHeight } from "./infoCardGestures";

type Props = {
  application: Application | null;
  onClose: () => void;
};

const DATA_OBJECTS_DEFAULT_HEIGHT = 48;
const DESCRIPTION_DEFAULT_HEIGHT = 64;

function Field({ label, value }: Readonly<{ label: string; value: string | null }>) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-[0.08em] text-muted shrink-0">{label}</span>
      <span className="truncate text-xs text-fg text-right" title={value ?? undefined}>
        {value || "—"}
      </span>
    </div>
  );
}

/** Lightweight identity card shown to the right of an Application
 * rectangle's info icon (`ApplicationNode.tsx`). Data Objects and
 * Description are both user-resizable (drag handle below each), growing the
 * card itself rather than paginating. Never propagates its clicks to the
 * rectangle (no link highlight, no context menu). */
export default function ApplicationInfoCard({ application, onClose }: Readonly<Props>) {
  const dataObjects = useDragResizeHeight(DATA_OBJECTS_DEFAULT_HEIGHT);
  const description = useDragResizeHeight(DESCRIPTION_DEFAULT_HEIGHT);
  const move = useDragMove();
  const cardRef = useRef<HTMLDivElement>(null);
  // Pins the card's top edge in place at its default (un-resized) position,
  // measured once on mount — the card fully remounts each time it opens
  // (`{infoOpen && <ApplicationInfoCard .../>}` in `ApplicationNode.tsx`),
  // so this always reflects the default heights. Without it, growing a
  // section (which sits below a `bottom: 0`-anchored card) would push the
  // card upward instead of extending it downward.
  const [anchorTop, setAnchorTop] = useState<number | null>(null);

  useEffect(() => {
    dataObjects.reset();
    description.reset();
    move.reset();
    // Reset only when a different application's card opens, not on every
    // render — `reset` is stable per `defaultHeight` (see the hook).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application?.id]);

  useLayoutEffect(() => {
    if (cardRef.current) setAnchorTop(cardRef.current.offsetTop);
  }, []);

  return (
    <div
      ref={cardRef}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className="nodrag absolute z-20 flex w-64 flex-col gap-1.5 rounded-card border border-border bg-surface p-3 shadow-lg"
      style={{
        left: "calc(100% + 8px)",
        top: anchorTop ?? undefined,
        bottom: anchorTop === null ? 0 : undefined,
        transform: `translate(${move.offset.x}px, ${move.offset.y}px)`,
      }}
    >
      <div
        className="-mx-3 -mt-3 flex cursor-grab items-center gap-1.5 rounded-t-card border-b border-border bg-surface-2 px-3 py-1.5 active:cursor-grabbing"
        onPointerDown={move.onPointerDown}
      >
        <GripIcon size={12} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg" title={application?.name}>
          {application?.name || "—"}
        </span>
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Close"
          className="shrink-0 text-muted hover:text-fg"
        >
          ✕
        </button>
      </div>

      <Field label="External Ref" value={application?.externalId ?? null} />
      <Field
        label="Category"
        value={application ? CATEGORY_LABELS[application.category] : null}
      />
      <Field label="Portfolio" value={application?.portfolio?.name ?? null} />
      <Field label="Operator" value={application?.operator ?? null} />

      <div className="mt-1 flex flex-col gap-1 border-t border-border pt-1.5">
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted">Data Objects</span>
        <div className="overflow-y-auto text-xs text-fg" style={{ height: dataObjects.height }}>
          {application && (application.dataObjects ?? []).length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {(application?.dataObjects ?? []).map((dataObject) => (
                <li key={dataObject.id} className="truncate" title={dataObject.name}>
                  {dataObject.name}
                </li>
              ))}
            </ul>
          ) : (
            <span>—</span>
          )}
        </div>
        <ResizeHandle onPointerDown={dataObjects.onPointerDown} />
      </div>

      <div className="mt-1 flex flex-col gap-1 border-t border-border pt-1.5">
        <span className="text-[10px] uppercase tracking-[0.08em] text-muted">Description</span>
        <p className="overflow-y-auto text-xs text-fg" style={{ height: description.height }}>
          {application?.description || "—"}
        </p>
        <ResizeHandle onPointerDown={description.onPointerDown} />
      </div>
    </div>
  );
}
