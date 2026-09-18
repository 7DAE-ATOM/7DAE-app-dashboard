"use client";

import { useMemo, useRef, useState } from "react";
import type { Application } from "@/lib/types";

const MAX_RESULTS = 400;

type Props = {
  applications: Application[];
  excludeIds: Set<string>;
  onSelect: (application: Application) => void;
};

/** Adapted from `/depgraph`'s `BenchCombobox` — same ARIA combobox/listbox
 * mechanics, filtered over the Applications catalogue instead of benches. */
export default function ApplicationSearch({ applications, excludeIds, onSelect }: Readonly<Props>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return applications
      .filter((a) => !!a.externalId && !excludeIds.has(a.id))
      .filter((a) => !q || a.name.toLowerCase().includes(q) || a.externalId.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [applications, excludeIds, query]);

  function select(app: Application) {
    onSelect(app);
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const app = results[activeIndex];
      if (app) select(app);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls="discover-search-listbox"
        placeholder="Search applications…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        className="w-full px-3 py-2 rounded bg-surface border border-border text-fg placeholder:text-muted focus:outline-none focus:border-accent text-sm"
      />
      {open && results.length > 0 && (
        <ul
          id="discover-search-listbox"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-card border border-border bg-surface shadow-lg"
        >
          {results.map((app, i) => (
            <li key={app.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(app)}
                className={`block w-full px-3 py-1.5 text-left text-sm ${
                  i === activeIndex ? "bg-surface-2" : ""
                }`}
              >
                <div className="truncate text-fg">{app.name}</div>
                <div className="truncate text-xs text-muted">{app.externalId}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
