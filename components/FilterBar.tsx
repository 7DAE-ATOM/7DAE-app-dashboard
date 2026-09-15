"use client";

import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import type {
  ApplicationCategory,
  ApplicationStatus,
  BusinessCapabilityTree,
  BusinessCriticality,
  PhotoFilter,
} from "@/lib/types";
import CapabilityTreeFilter from "@/components/CapabilityTreeFilter";
import ChevronIcon from "@/components/icons/ChevronIcon";
import { PORTFOLIO_NONE } from "@/lib/applications";
import {
  BUSINESS_CRITICALITY_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import clsx from "clsx";

/** Stable reference so a missing `capabilityCounts` doesn't remount the
 * tree on every render. */
const EMPTY_COUNTS: Map<string, number> = new Map();

/** The foldable chapters of the FILTERING block, in render order. */
type SectionKey =
  | "photo"
  | "category"
  | "status"
  | "portfolio"
  | "operator"
  | "criticality"
  | "capabilities";

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
};

type Props = {
  categories: ApplicationCategory[];
  statuses: ApplicationStatus[];
  portfolios: string[];
  businessCriticalities: BusinessCriticality[];
  /** `null` while the hierarchy is loading, or if its crawl failed — the
   * whole section is then omitted rather than shown empty or broken.
   * Omitted entirely by `/map`, which doesn't carry this axis. */
  capabilityTree?: BusinessCapabilityTree | null;
  capabilityCounts?: Map<string, number>;
  /** Remount key for the tree: its expanded/collapsed state is local, so
   * bumping this is what collapses it again when filters are reset. */
  capabilityResetToken?: number;
  /** Optional "ACTIONS" row rendered above every filter chapter. The
   * catalogue passes its Export PDF / Show in Discover buttons here; `/map`
   * passes nothing and gets no row. */
  actions?: ReactNode;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
};

function Toggle<T extends string>({
  options,
  value,
  onChange,
  renderLabel,
  optionClassName,
  cols,
}: {
  options: T[];
  value: T[];
  onChange: (v: T[]) => void;
  renderLabel?: (o: T) => string;
  optionClassName?: (o: T) => string | undefined;
  cols?: number;
}) {
  const containerClass = cols ? "grid gap-1" : "flex flex-wrap gap-1";
  const containerStyle = cols
    ? { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }
    : undefined;
  return (
    <div className={containerClass} style={containerStyle}>
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((v) => v !== o) : [...value, o])
            }
            className={clsx(
              "px-3 py-2 rounded-lg text-xs font-medium border transition-colors truncate",
              active
                ? "bg-accent text-accent-fg border-accent"
                : "bg-surface-2 text-fg border-border hover:border-accent/50",
              optionClassName?.(o)
            )}
          >
            {renderLabel ? renderLabel(o) : o}
          </button>
        );
      })}
    </div>
  );
}

/** Level-1 block title — "ACTIONS" and "FILTERING". Structural label, not a
 * control: it never folds, never takes focus. Only its size sets it apart
 * from the level-2 chapter headings below. */
function BlockTitle({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3
      id={id}
      className="text-sm font-bold uppercase tracking-[0.18em] text-muted mb-2"
    >
      {children}
    </h3>
  );
}

/** Level-2 chapter of the FILTERING block: a rounded card whose foldable
 * header carries the axis name, its active-value count and the triangle.
 *
 * The body is hidden with the native `hidden` attribute rather than dropped
 * from the tree, so folding a chapter keeps whatever local state its content
 * holds — notably the Business Capabilities tree's own expanded nodes. */
function Section({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = useId();
  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className={clsx(
          "flex w-full items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-accent",
          // No gap under the header once the card is folded down to its title.
          open && "mb-3",
        )}
      >
        <span className="truncate">{label}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2">
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
        </span>
      </button>
      <div id={bodyId} hidden={!open}>
        {children}
      </div>
    </div>
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
  actions,
  value,
  onChange,
}: Props) {
  // The desktop panel and the mobile sheet both mount a FilterBar, so the
  // block ids have to be unique per instance.
  const panelId = useId();
  const [search, setSearch] = useState(value.search);
  const [operatorSearch, setOperatorSearch] = useState(value.operator);
  // Empty = everything unfolded, which is the first-render state: no storage
  // read, so the panel never shows itself open and then folds.
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());
  // Same token that remounts the capability tree: resetting the filters
  // unfolds every chapter too.
  useEffect(() => setCollapsed(new Set()), [capabilityResetToken]);
  const toggleSection = (key: SectionKey) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
    }),
    [value],
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
        <BlockTitle id={`${panelId}-filtering`}>Filtering</BlockTitle>
        {/* Full width: each chapter carries its own card, so the hierarchy
            reads from the block title and the framing, not from an indent. */}
        <div className="space-y-3">
          <input
            type="search"
            placeholder="Search applications, references, managers…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onChange({ ...value, search: e.target.value });
            }}
            className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-fg placeholder:text-muted focus:outline-none focus:border-accent"
          />
          <Section
            label="Photo"
            count={counts.photo}
            open={!collapsed.has("photo")}
            onToggle={() => toggleSection("photo")}
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
          </Section>
          <Section
            label="Category"
            count={counts.category}
            open={!collapsed.has("category")}
            onToggle={() => toggleSection("category")}
          >
            <Toggle
              options={categories}
              value={value.categories}
              onChange={(v) => onChange({ ...value, categories: v })}
              renderLabel={(c) => CATEGORY_LABELS[c]}
              cols={2}
            />
          </Section>
          <Section
            label="Status"
            count={counts.status}
            open={!collapsed.has("status")}
            onToggle={() => toggleSection("status")}
          >
            <Toggle
              options={sortedStatuses}
              value={value.statuses}
              onChange={(v) => onChange({ ...value, statuses: v })}
              renderLabel={(s) => STATUS_LABELS[s]}
              cols={2}
            />
          </Section>
          <Section
            label="Portfolio"
            count={counts.portfolio}
            open={!collapsed.has("portfolio")}
            onToggle={() => toggleSection("portfolio")}
          >
            <Toggle
              options={portfolios}
              value={value.portfolios}
              onChange={(v) => onChange({ ...value, portfolios: v })}
              renderLabel={(p) => (p === PORTFOLIO_NONE ? "None" : p)}
              cols={2}
            />
          </Section>
          <Section
            label="Operator"
            count={counts.operator}
            open={!collapsed.has("operator")}
            onToggle={() => toggleSection("operator")}
          >
            <input
              type="search"
              placeholder="Search by operator code…"
              value={operatorSearch}
              onChange={(e) => {
                setOperatorSearch(e.target.value);
                onChange({ ...value, operator: e.target.value });
              }}
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-fg placeholder:text-muted focus:outline-none focus:border-accent"
            />
          </Section>
          <Section
            label="Business Criticality"
            count={counts.criticality}
            open={!collapsed.has("criticality")}
            onToggle={() => toggleSection("criticality")}
          >
            <Toggle
              options={businessCriticalities}
              value={value.businessCriticalities}
              onChange={(v) => onChange({ ...value, businessCriticalities: v })}
              renderLabel={(c) => BUSINESS_CRITICALITY_LABELS[c]}
              cols={2}
            />
          </Section>
          {capabilityTree && (
            <Section
              label="Business Capabilities"
              count={counts.capabilities}
              open={!collapsed.has("capabilities")}
              onToggle={() => toggleSection("capabilities")}
            >
              <CapabilityTreeFilter
                key={capabilityResetToken}
                tree={capabilityTree}
                counts={capabilityCounts ?? EMPTY_COUNTS}
                value={value.businessCapabilityIds}
                onChange={(v) =>
                  onChange({ ...value, businessCapabilityIds: v })
                }
              />
            </Section>
          )}
        </div>
      </section>
    </div>
  );
}
