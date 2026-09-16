"use client";

import { useCallback, useRef, useState } from "react";

/**
 * The two pointer gestures shared by the Discover identity cards — the
 * application one (`ApplicationInfoCard`) and the interface one
 * (`InterfaceInfoCard`) — plus the small handle that drives the first.
 *
 * Extracted from `ApplicationInfoCard`, where they originally lived, when the
 * interface card needed exactly the same behaviour.
 */

const RESIZABLE_MIN_HEIGHT = 24;
const RESIZABLE_MAX_HEIGHT = 240;

/** Drag-to-resize a section's height via a small handle below it, each drag
 * growing the card itself (unlike a fixed-size box). */
export function useDragResizeHeight(defaultHeight: number) {
  const [height, setHeight] = useState(defaultHeight);
  const dragRef = useRef<{ startClientY: number; startHeight: number } | null>(null);

  const reset = useCallback(() => setHeight(defaultHeight), [defaultHeight]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { startClientY: e.clientY, startHeight: height };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = moveEvent.clientY - dragRef.current.startClientY;
        const proposed = dragRef.current.startHeight + delta;
        setHeight(Math.min(RESIZABLE_MAX_HEIGHT, Math.max(RESIZABLE_MIN_HEIGHT, proposed)));
      };
      const onPointerUp = () => {
        dragRef.current = null;
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [height],
  );

  return { height, onPointerDown, reset };
}

/** Drag-to-move the whole card via its header — an offset applied on top of
 * the card's default anchor position (next to the info icon), reset whenever
 * a different node's card opens. */
export function useDragMove() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const reset = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: offset.x,
        startY: offset.y,
      };

      const onPointerMove = (moveEvent: PointerEvent) => {
        if (!dragRef.current) return;
        setOffset({
          x: dragRef.current.startX + (moveEvent.clientX - dragRef.current.startClientX),
          y: dragRef.current.startY + (moveEvent.clientY - dragRef.current.startClientY),
        });
      };
      const onPointerUp = () => {
        dragRef.current = null;
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
      };
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [offset],
  );

  return { offset, onPointerDown, reset };
}

export function ResizeHandle({
  onPointerDown,
}: Readonly<{ onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void }>) {
  return (
    <div
      className="nodrag -my-0.5 flex h-2.5 cursor-ns-resize items-center justify-center"
      onPointerDown={onPointerDown}
    >
      <div className="h-1 w-8 rounded-full bg-border" />
    </div>
  );
}
