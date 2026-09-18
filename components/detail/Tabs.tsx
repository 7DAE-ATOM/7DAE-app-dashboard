"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import clsx from "clsx";

export interface TabItem {
  /** Stable identifier; used for active-tab comparison and as the React key. */
  id: string;
  /** Button label rendered in the tab bar. */
  label: string;
  /** Panel content rendered when this tab is active. */
  content: React.ReactNode;
}

/**
 * Generic tab bar + single active panel, styled after the mono/uppercase
 * label convention used by `Section`. Only one panel is mounted at a time.
 *
 * Currently used on the Application detail page (Identity / Accountability /
 * Compliance / Documentation / In Context); kept generic for reuse there as
 * the remaining tabs get real content.
 */
export default function Tabs({
  items,
  defaultActiveId,
}: {
  items: TabItem[];
  /** id of the tab active on first render. Defaults to `items[0].id`. */
  defaultActiveId?: string;
}) {
  const [activeId, setActiveId] = useState(defaultActiveId ?? items[0]?.id);
  const active = items.find((item) => item.id === activeId);

  const barRef = useRef<HTMLDivElement>(null);
  /** Viewport offset of the tab bar captured just before a switch. */
  const anchorRef = useRef<number | null>(null);

  const selectTab = (id: string) => {
    if (id === activeId) return;
    anchorRef.current = barRef.current?.getBoundingClientRect().top ?? null;
    setActiveId(id);
  };

  /*
   * Switching from a tall panel to a short one shrinks the document, so the
   * browser clamps the scroll position and the whole page jumps upwards —
   * losing the reader's place. Re-anchor the tab bar where it was: as long as
   * the new document is tall enough, nothing appears to move at all.
   *
   * Layout effect, not `useEffect`: it runs after the DOM is updated (so the
   * clamp has already happened and the measurement is accurate) but before
   * paint, so the correction is never visible as a flicker.
   */
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (anchor === null || !barRef.current) return;
    const delta = barRef.current.getBoundingClientRect().top - anchor;
    if (delta !== 0) window.scrollBy(0, delta);
  }, [activeId]);

  /*
   * Reserve the height of the tallest panel seen so far, so the document never
   * shrinks on a switch and the browser has nothing to clamp. This is what
   * makes the position genuinely stable even when the short panel would
   * otherwise fit entirely on screen — the case the anchor above cannot fix,
   * since there is then nothing left to scroll. The cost is empty space under
   * the short panels once a tall one has been opened.
   *
   * The observed element is the inner wrapper, which is never constrained;
   * `minHeight` goes on the outer panel. Measuring the constrained element
   * would read back its own reserved height and the value could never grow.
   */
  const contentRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const measure = () => {
      const height = element.getBoundingClientRect().height;
      setReservedHeight((previous) => (height > previous ? height : previous));
    };
    measure();
    // Panels settle after mount — the In Context diagram replaces a skeleton
    // once `/links` resolves — so a one-off measurement is not enough.
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeId]);

  // Panels grow taller as the window narrows; without this the reservation
  // computed at a small width would strand a large gap at a large one.
  useEffect(() => {
    const reset = () => setReservedHeight(0);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);

  return (
    <div>
      <div ref={barRef} role="tablist" className="flex gap-1 border-b border-border">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(item.id)}
              className={clsx(
                "px-4 py-2 text-xs uppercase tracking-[0.15em] font-mono border-b-2 -mb-px transition-colors",
                isActive
                  ? "text-fg border-accent"
                  : "text-muted border-transparent hover:text-fg",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        className="pt-4"
        style={reservedHeight ? { minHeight: reservedHeight } : undefined}
      >
        <div ref={contentRef}>{active?.content}</div>
      </div>
    </div>
  );
}
