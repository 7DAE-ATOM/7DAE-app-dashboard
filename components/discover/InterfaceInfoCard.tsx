"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { DataObject } from "@/lib/types";
import GripIcon from "@/components/icons/GripIcon";
import { ResizeHandle, useDragMove, useDragResizeHeight } from "./infoCardGestures";

type Props = {
  name: string | null;
  protocol: string | null;
  dataObjects: DataObject[];
  onClose: () => void;
};

const BODY_DEFAULT_HEIGHT = 200;

function SectionLabel({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <span className="text-[10px] uppercase tracking-[0.08em] text-muted">{children}</span>
  );
}

/**
 * What flows through an interface: the Data Objects it exchanges, each with
 * its name and description.
 *
 * The header carries the **first data object's name** (the interface's own
 * name is only a fallback when it exchanges nothing): the description is what
 * the card exists for, and repeating the interface name above it would push
 * the useful text down. Further data objects follow as their own titled
 * sections.
 *
 * Opened from the info icon at the centre of the interface circle
 * (`InterfaceNode.tsx`), and built on the same gestures as
 * `ApplicationInfoCard` — draggable header, resizable body. Rendered inside
 * the node, so it follows the circle when the provider application is dragged.
 */
export default function InterfaceInfoCard({
  name,
  protocol,
  dataObjects,
  onClose,
}: Readonly<Props>) {
  const body = useDragResizeHeight(BODY_DEFAULT_HEIGHT);
  const move = useDragMove();
  const cardRef = useRef<HTMLDivElement>(null);
  // Same anchoring trick as the application card: pin the top edge at its
  // default position, measured once on mount, so resizing the body extends
  // the card downward instead of pushing it up.
  const [anchorTop, setAnchorTop] = useState<number | null>(null);

  useEffect(() => {
    body.reset();
    move.reset();
    // Only when a different interface's card opens — `reset` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useLayoutEffect(() => {
    if (cardRef.current) setAnchorTop(cardRef.current.offsetTop);
  }, []);

  const title = dataObjects[0]?.name || name || "Interface";

  return (
    <div
      ref={cardRef}
      role="dialog"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      className="nodrag absolute z-20 flex w-72 flex-col gap-2 rounded-card border border-border bg-surface p-3 shadow-lg"
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
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg" title={title}>
          {title}
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

      <div className="overflow-y-auto" style={{ height: body.height }}>
        {dataObjects.length > 0 ? (
          dataObjects.map((dataObject, index) => (
            <div
              key={dataObject.id}
              className={index > 0 ? "mt-3 border-t border-border pt-3" : ""}
            >
              {/* The first name is already in the header; the others need
                  their own title to stay attached to their description. */}
              {index > 0 && (
                <div className="mb-1 truncate text-sm font-semibold text-fg" title={dataObject.name}>
                  {dataObject.name}
                </div>
              )}
              <SectionLabel>Description</SectionLabel>
              {/* Rendered as text, never as markup: LeanIX descriptions can
                  carry formatting of their own. */}
              <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-fg">
                {dataObject.description?.trim() || "—"}
              </p>
            </div>
          ))
        ) : (
          <span className="text-xs text-muted">No data object exchanged</span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 border-t border-border pt-2">
        <SectionLabel>Protocol</SectionLabel>
        <span className="truncate text-right text-xs text-fg" title={protocol ?? undefined}>
          {protocol || "—"}
        </span>
      </div>

      <ResizeHandle onPointerDown={body.onPointerDown} />
    </div>
  );
}
