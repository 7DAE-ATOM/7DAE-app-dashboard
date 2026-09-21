"use client";

import { useState } from "react";
import type { Application } from "@/lib/types";

type Props = {
  /** What the other filters let through — **including** the unticked ones.
   * Feeding this the displayed list instead would make an unticked row vanish
   * from the list, and nothing could ever tick it back on. */
  applications: Application[];
  /** Technical ids hidden by hand. */
  excludedIds: string[];
  onChange: (excludedIds: string[]) => void;
};

/**
 * The last and finest filter: one checkbox per application that every other
 * axis has already let through.
 *
 * The coarse axes describe families — category, status, portfolio, capability
 * — and never exceptions, while a useful selection almost always ends in
 * "those, except those two". This is where that last word is said.
 *
 * Native checkboxes rather than the chip-style `Toggle` the other chapters
 * use: this list can hold hundreds of rows, where chips become unreadable.
 * Same shape as `BenchVisibilityList` in the LTM dashboard, which solved the
 * same problem.
 */
export default function ApplicationVisibilityList({
  applications,
  excludedIds,
  onChange,
}: Readonly<Props>) {
  const [search, setSearch] = useState("");
  const excluded = new Set(excludedIds);

  const q = search.trim().toLowerCase();
  const rows = q
    ? applications.filter((a) => a.name.toLowerCase().includes(q))
    : applications;

  const hiddenHere = applications.filter((a) => excluded.has(a.id)).length;
  const shownHere = applications.length - hiddenHere;

  function toggle(id: string) {
    onChange(
      excluded.has(id) ? excludedIds.filter((x) => x !== id) : [...excludedIds, id],
    );
  }

  /* Both act on the rows **currently listed**, so a search narrows them too.
     The list this is modelled on acts on the whole set instead; after typing
     three letters, "Deselect all" over everything is a destructive surprise,
     and acting on the subset is the very gesture the search just prepared. */
  function selectAll() {
    const shown = new Set(rows.map((a) => a.id));
    onChange(excludedIds.filter((id) => !shown.has(id)));
  }

  function deselectAll() {
    const next = new Set(excludedIds);
    for (const a of rows) next.add(a.id);
    onChange([...next]);
  }

  const hiddenInRows = rows.filter((a) => excluded.has(a.id)).length;

  if (applications.length === 0) {
    return <p className="py-1 text-xs text-muted">No application matches the other filters.</p>;
  }

  return (
    <div>
      <p className="mb-1.5 font-mono text-[11px] text-muted">
        {shownHere} of {applications.length} displayed
      </p>
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search applications…"
        className="mb-1.5 w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-fg placeholder:text-muted focus:border-accent focus:outline-none"
      />
      <div className="mb-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={selectAll}
          disabled={hiddenInRows === 0}
          className="text-[10px] font-medium text-accent hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={deselectAll}
          disabled={rows.length === 0 || hiddenInRows === rows.length}
          className="text-[10px] font-medium text-accent hover:underline disabled:cursor-default disabled:text-muted disabled:no-underline"
        >
          Deselect all
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="py-1 text-xs text-muted">No application matches.</p>
      ) : (
        <ul className="max-h-[240px] overflow-y-auto pr-1">
          {rows.map((application) => (
            <li key={application.id}>
              <label className="flex cursor-pointer items-center gap-1.5 py-0.5">
                <input
                  type="checkbox"
                  checked={!excluded.has(application.id)}
                  onChange={() => toggle(application.id)}
                  className="shrink-0 accent-[var(--color-accent)]"
                />
                {/* The External ID belongs in the tooltip, not on the row:
                    two similar names are told apart on demand, and the line
                    stays readable. */}
                <span
                  className="truncate text-xs text-fg"
                  title={
                    application.externalId
                      ? `${application.name} — ${application.externalId}`
                      : application.name
                  }
                >
                  {application.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
