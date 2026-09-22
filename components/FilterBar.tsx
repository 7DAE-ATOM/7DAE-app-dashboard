"use client";

import { useId, useMemo, type ReactNode } from "react";
import type {
  Application,
  ApplicationCategory,
  ApplicationStatus,
  BusinessCapabilityTree,
  BusinessCriticality,
  DataObjectTree,
  PhotoFilter,
} from "@/lib/types";
import ApplicationVisibilityList from "@/components/ApplicationVisibilityList";
import FilterSection from "@/components/FilterSection";
import HierarchyTreeFilter from "@/components/HierarchyTreeFilter";
import { PORTFOLIO_NONE } from "@/lib/applications";
import { countActiveFilters } from "@/lib/appFilters";
import {
  BUSINESS_CRITICALITY_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import {
  toggleFilterSection,
  useOpenFilterSections,
  type SectionKey,
} from "@/lib/filterSectionState";
import clsx from "clsx";

/** Stable reference so a missing `capabilityCounts` doesn't remount the
 * tree on every render. */
const EMPTY_COUNTS: Map<string, number> = new Map();

const STATUS_ORDER: ApplicationStatus[] = [
  "active",
  "developmentPhase",
  "planPhase",
  "inactive",
  "NA",
];

// Tri-state sliding switch, left → right. The knob is green for "with"/"all"
// and red for "without" (see the requested toggle.gif visual).
const PHOTO_STATES: { value: PhotoFilter; label: string; tone: "on" | "off" }[] =
  [
    { value: "with", label: "With photo", tone: "on" },
    { value: "all", label: "All", tone: "on" },
    { value: "without", label: "Without photo", tone: "off" },
  ];

export type FilterValue = {
  search: string;
  photo: PhotoFilter;
  categories: ApplicationCategory[];
  statuses: ApplicationStatus[];
  portfolios: string[];
  operator: string;
  businessCriticalities: BusinessCriticality[];
  /** Checked Business Capability nodes, by technical id. Only what the user
   * ticked — the expansion to descendants happens at filtering time. */
  businessCapabilityIds: string[];
  /** Checked Data Object nodes, same convention as the capabilities above. */
  dataObjectIds: string[];
  /** Applications hidden **by hand**, by technical id — the last, finest
   * filter. Exclusions and not selections on purpose: an application newly
   * admitted by the other axes must arrive visible, where a list of retained
   * ids would hide it (see `ApplicationVisibilityList`). */
  excludedIds: string[];
};

type Props = {
  categories: ApplicationCategory[];
  statuses: ApplicationStatus[];
  portfolios: string[];
  businessCriticalities: BusinessCriticality[];
  /** `null` while the hierarchy is loading, or if its crawl failed — the
   * whole section is then omitted rather than shown empty or broken. */
  capabilityTree?: BusinessCapabilityTree | null;
  capabilityCounts?: Map<string, number>;
  /** Remount key for the tree: its expanded/collapsed state is local, so
   * bumping this is what collapses it again when filters are reset. */
  capabilityResetToken?: number;
  /** Same contract as the capability trio above, for the Data Objects axis.
   * The reset token is shared: one reset collapses both trees. */
  dataObjectTree?: DataObjectTree | null;
  dataObjectCounts?: Map<string, number>;
  /** What every other axis lets through, **before** the hand-picked
   * exclusions — the rows of the Applications chapter. Absent, the chapter is
   * not rendered at all. */
  selectableApplications?: Application[];
  /** Optional "ACTIONS" row rendered above every filter chapter — the Export
   * PDF / Show in Discover buttons, passed by both pages. Left out, no row
   * is rendered at all. */
  actions?: ReactNode;
  /** How many applications are visible under the given hypothetical filter.
   * Each option shows its own facet count — this axis narrowed to that single
   * option, the other axes as currently set. Left out, no count is shown. */
  previewCount?: (next: FilterValue) => number;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  /** Empties every axis at once — the "Clear All" link next to FILTERING.
   * Kept as a prop so the panel stays driven by its parent, like `onChange`. */
  onClear: () => void;
};

function Toggle<T extends string>({
  options,
  value,
  onChange,
  renderLabel,
  optionClassName,
  cols,
  previewCount,
}: {
  options: T[];
  value: T[];
  onChange: (v: T[]) => void;
  renderLabel?: (o: T) => string;
  optionClassName?: (o: T) => string | undefined;
  cols?: number;
  /** How many applications remain if this chapter held exactly `nextValues`,
   * every other axis unchanged. Bound per chapter by the caller; absent → no
   * counts shown. */
  previewCount?: (nextValues: T[]) => number;
}) {
  const containerClass = cols ? "grid gap-1" : "flex flex-wrap gap-1";
  const containerStyle = cols
    ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
    : undefined;
  // Facet counts: each option is measured with *itself alone* on this axis,
  // the other axes kept as they are. So ticking a second option of the same
  // chapter leaves every count here untouched — only a filter set in another
  // chapter moves them. Counting the toggled selection instead (what a click
  // would yield) made an option's own number jump to the unfiltered total as
  // soon as it was selected, which read as noise.
  //
  // One filtering pass per option, recomputed when the options or the
  // selection change — a linear scan over a few hundred applications, so the
  // whole chapter costs less than a render of the cards behind it.
  const preview = useMemo(() => {
    if (!previewCount) return null;
    return new Map(options.map((o) => [o, previewCount([o])]));
  }, [options, previewCount]);
  return (
    <div className={containerClass} style={containerStyle}>
      {options.map((o) => {
        const active = value.includes(o);
        // What a click sends back: OR inside the chapter. The number next to
        // the label is *not* this set — see the facet comment above.
        const toggled = active ? value.filter((v) => v !== o) : [...value, o];
        const count = preview?.get(o) ?? null;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(toggled)}
            className={clsx(
              "relative px-3 py-2 rounded-lg text-[11px] font-medium border transition-colors",
              active
                ? "bg-accent text-accent-fg border-accent"
                : "bg-surface-2 text-fg border-border hover:border-accent/50",
              optionClassName?.(o)
            )}
          >
            {/* Wrapped, not truncated. In the 340px panel a two-column chapter
              * leaves about a hundred pixels of text per chip — less than
              * "Development Phase" needs, and portfolio names have no length
              * limit at all. Truncating hid the difference between two labels
              * sharing a prefix, with no tooltip to recover it. Grid items
              * stretch, so a chip that takes two lines simply makes its row
              * taller and its neighbour follows.
              *
              * `break-words` is what saves a long unbroken name; the count
              * stays out of the flow, so it never moves. */}
            <span
              className={clsx(
                "block break-words leading-tight",
                previewCount && "pr-6",
              )}
            >
              {renderLabel ? renderLabel(o) : o}
            </span>
            {count !== null && (
              <span
                className={clsx(
                  "absolute right-2 top-1/2 -translate-y-1/2 text-[10px] tabular-nums",
                  active ? "text-accent-fg/80" : "text-muted",
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Level-1 block title — "ACTIONS" and "FILTERING". Structural label, not a
 * control: it never folds, never takes focus. Only its size sets it apart
 * from the level-2 chapter headings below. */
/** Level-1 block title (ACTIONS, FILTERING), with an optional control
 * aligned to its right — where FILTERING puts its "Clear All" link. */
function BlockTitle({
  id,
  action,
  children,
}: {
  id: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <h3
        id={id}
        className="text-sm font-bold uppercase tracking-[0.18em] text-muted"
      >
        {children}
      </h3>
      {action && <span className="ml-auto">{action}</span>}
    </div>
  );
}

/** Empties one axis, shown in that axis's section header only while it holds
 * a selection — an always-visible link on an untouched axis would read as an
 * action that does nothing. Distinct from the panel's "Clear All", which
 * empties every axis at once. */
function ClearAxisButton({ onClear }: { onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="shrink-0 text-[10px] font-medium normal-case tracking-normal text-muted underline underline-offset-2 hover:text-accent"
    >
      Clear
    </button>
  );
}

export default function FilterBar({
  categories,
  statuses,
  portfolios,
  businessCriticalities,
  capabilityTree = null,
  capabilityCounts,
  capabilityResetToken = 0,
  dataObjectTree = null,
  dataObjectCounts,
  selectableApplications,
  actions,
  previewCount,
  value,
  onChange,
  onClear,
}: Props) {
  // The desktop panel and the mobile sheet both mount a FilterBar, so the
  // block ids have to be unique per instance.
  const panelId = useId();
  // Folded by default, unfolded chapters restored from local storage. Shared
  // by every mounted panel (desktop column, mobile sheet, /map), and left
  // alone by a filter reset: emptying the filters isn't a display change.
  const openSections = useOpenFilterSections();
  // What each chapter contributes to the filter, shown on its header so a
  // folded chapter can't narrow the catalogue unnoticed.
  const counts = useMemo<Record<SectionKey, number>>(
    () => ({
      photo: value.photo !== "all" ? 1 : 0,
      category: value.categories.length,
      status: value.statuses.length,
      portfolio: value.portfolios.length,
      operator: value.operator ? 1 : 0,
      criticality: value.businessCriticalities.length,
      capabilities: value.businessCapabilityIds.length,
      dataObjects: value.dataObjectIds.length,
      // Only the exclusions that bear on the current result: one that no
      // longer matches anything has nothing to report.
      applications: (selectableApplications ?? []).filter((a) =>
        value.excludedIds.includes(a.id),
      ).length,
    }),
    [value, selectableApplications],
  );
  const photoIndex = Math.max(
    0,
    PHOTO_STATES.findIndex((s) => s.value === value.photo),
  );
  const currentPhoto = PHOTO_STATES[photoIndex];
  const sortedStatuses = useMemo(
    () =>
      [...statuses].sort(
        (a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b),
      ),
    [statuses],
  );
  return (
    <div className="space-y-6">
      {actions && (
        <section aria-labelledby={`${panelId}-actions`}>
          <BlockTitle id={`${panelId}-actions`}>Actions</BlockTitle>
          {actions}
        </section>
      )}
      <section aria-labelledby={`${panelId}-filtering`}>
        <BlockTitle
          id={`${panelId}-filtering`}
          action={
            // Nothing to clear, nothing to show.
            countActiveFilters(value) > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="text-[11px] font-medium text-muted hover:text-accent underline underline-offset-2"
              >
                Clear All
              </button>
            ) : undefined
          }
        >
          Filtering
        </BlockTitle>
        {/* Full width: each chapter carries its own card, so the hierarchy
            reads from the block title and the framing, not from an indent. */}
        <div className="space-y-3">
          <input
            type="search"
            placeholder="Search applications, references, managers…"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <FilterSection
            label="Photo"
            count={counts.photo}
            open={openSections.has("photo")}
            onToggle={() => toggleFilterSection("photo")}
          >
            <div className="flex items-center gap-2.5">
              <div
                role="radiogroup"
                aria-label="Photo filter"
                className="relative inline-flex h-[26px] w-16 shrink-0 rounded-full bg-[#00205B] p-[3px] shadow-inner"
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-[3px] left-[3px] z-20 h-5 w-5 rounded-full shadow transition-transform duration-200 ease-out"
                  style={{
                    transform: `translateX(${photoIndex * 19}px)`,
                    backgroundColor: "var(--color-bg)",
                  }}
                />
                {PHOTO_STATES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="radio"
                    aria-checked={value.photo === s.value}
                    aria-label={s.label}
                    title={s.label}
                    onClick={() => onChange({ ...value, photo: s.value })}
                    className="relative z-10 flex-1 rounded-full bg-transparent focus:outline-none"
                  />
                ))}
              </div>
              <span className="text-xs font-medium text-fg">
                {currentPhoto.label}
              </span>
            </div>
          </FilterSection>
          <FilterSection
            label="Category"
            count={counts.category}
            open={openSections.has("category")}
            onToggle={() => toggleFilterSection("category")}
          >
            <Toggle
              options={categories}
              value={value.categories}
              onChange={(v) => onChange({ ...value, categories: v })}
              previewCount={
                previewCount && ((v) => previewCount({ ...value, categories: v }))
              }
              renderLabel={(c) => CATEGORY_LABELS[c]}
              cols={2}
            />
          </FilterSection>
          <FilterSection
            label="Status"
            count={counts.status}
            open={openSections.has("status")}
            onToggle={() => toggleFilterSection("status")}
          >
            <Toggle
              options={sortedStatuses}
              value={value.statuses}
              onChange={(v) => onChange({ ...value, statuses: v })}
              previewCount={
                previewCount && ((v) => previewCount({ ...value, statuses: v }))
              }
              renderLabel={(s) => STATUS_LABELS[s]}
              cols={2}
            />
          </FilterSection>
          <FilterSection
            label="Portfolio"
            count={counts.portfolio}
            open={openSections.has("portfolio")}
            onToggle={() => toggleFilterSection("portfolio")}
          >
            <Toggle
              options={portfolios}
              value={value.portfolios}
              onChange={(v) => onChange({ ...value, portfolios: v })}
              previewCount={
                previewCount && ((v) => previewCount({ ...value, portfolios: v }))
              }
              renderLabel={(p) => (p === PORTFOLIO_NONE ? "None" : p)}
              cols={2}
            />
          </FilterSection>
          <FilterSection
            label="Operator"
            count={counts.operator}
            open={openSections.has("operator")}
            onToggle={() => toggleFilterSection("operator")}
          >
            <input
              type="search"
              placeholder="Search by operator code…"
              value={value.operator}
              onChange={(e) => onChange({ ...value, operator: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-fg placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </FilterSection>
          <FilterSection
            label="Business Criticality"
            count={counts.criticality}
            open={openSections.has("criticality")}
            onToggle={() => toggleFilterSection("criticality")}
          >
            <Toggle
              options={businessCriticalities}
              value={value.businessCriticalities}
              onChange={(v) => onChange({ ...value, businessCriticalities: v })}
              previewCount={
                previewCount && ((v) => previewCount({ ...value, businessCriticalities: v }))
              }
              renderLabel={(c) => BUSINESS_CRITICALITY_LABELS[c]}
              cols={2}
            />
          </FilterSection>
          {capabilityTree && (
            <FilterSection
              label="Business Capabilities"
              count={counts.capabilities}
              open={openSections.has("capabilities")}
              onToggle={() => toggleFilterSection("capabilities")}
              action={
                value.businessCapabilityIds.length > 0 ? (
                  <ClearAxisButton
                    onClear={() => onChange({ ...value, businessCapabilityIds: [] })}
                  />
                ) : undefined
              }
            >
              <HierarchyTreeFilter
                key={capabilityResetToken}
                tree={capabilityTree}
                searchPlaceholder="Search capabilities…"
                emptyLabel="No capability matches."
                counts={capabilityCounts ?? EMPTY_COUNTS}
                value={value.businessCapabilityIds}
                onChange={(v) =>
                  onChange({ ...value, businessCapabilityIds: v })
                }
              />
            </FilterSection>
          )}
          {dataObjectTree && (
            <FilterSection
              label="Data Objects"
              count={counts.dataObjects}
              open={openSections.has("dataObjects")}
              onToggle={() => toggleFilterSection("dataObjects")}
              action={
                value.dataObjectIds.length > 0 ? (
                  <ClearAxisButton
                    onClear={() => onChange({ ...value, dataObjectIds: [] })}
                  />
                ) : undefined
              }
            >
              <HierarchyTreeFilter
                key={capabilityResetToken}
                tree={dataObjectTree}
                searchPlaceholder="Search data objects…"
                emptyLabel="No data object matches."
                counts={dataObjectCounts ?? EMPTY_COUNTS}
                value={value.dataObjectIds}
                onChange={(v) => onChange({ ...value, dataObjectIds: v })}
              />
            </FilterSection>
          )}
          {/* Last on purpose: it works on what all the others have already
              let through. Its badge counts the applications hidden **among
              those** — an exclusion that no longer matches the current result
              has nothing to report. */}
          {selectableApplications && (
            <FilterSection
              label="Applications"
              count={counts.applications}
              open={openSections.has("applications")}
              onToggle={() => toggleFilterSection("applications")}
              action={
                value.excludedIds.length > 0 ? (
                  <ClearAxisButton onClear={() => onChange({ ...value, excludedIds: [] })} />
                ) : undefined
              }
            >
              <ApplicationVisibilityList
                applications={selectableApplications}
                excludedIds={value.excludedIds}
                onChange={(v) => onChange({ ...value, excludedIds: v })}
              />
            </FilterSection>
          )}
        </div>
      </section>
    </div>
  );
}
