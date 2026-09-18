"use client";

import { useState } from "react";
import type { Application } from "@/lib/types";
import Switch from "@/components/Switch";
import {
  AXES,
  kpiPercentage,
  kpiPresentLabels,
  kpiMissingLabels,
  deta06MissingLabels,
  percentSeverity,
  COMPLIANCE_SEVERITY_CLASS,
  type KpiKey,
} from "@/lib/compliance-kpi";

// Fixed viewBox geometry (matches the validated prototype) — no container
// measurement involved, so the radar draws correctly even if Compliance is
// not the active tab on first render.
const CX = 150;
const CY = 150;
const MAX_R = 96;
const N = AXES.length;
const GRID_LEVELS = [20, 40, 60, 80, 100];

function angle(i: number): number {
  return -Math.PI / 2 + i * ((2 * Math.PI) / N);
}

function point(i: number, r: number): { x: number; y: number } {
  const a = angle(i);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function polygonPoints(radiusForIndex: (i: number) => number): string {
  return Array.from({ length: N }, (_, i) => {
    const p = point(i, radiusForIndex(i));
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

function Radar({ percents }: { percents: (number | null)[] }) {
  // Geometric-only fallback: an axis with no determinable percentage pulls
  // the data polygon to the center rather than being invented or omitted.
  const radiusFor = (i: number) => MAX_R * ((percents[i] ?? 0) / 100);

  return (
    <svg viewBox="0 0 300 300" width="100%" height="auto">
      {GRID_LEVELS.map((level) => (
        <polygon
          key={level}
          points={polygonPoints(() => MAX_R * (level / 100))}
          fill="none"
          style={{ stroke: "var(--color-border)" }}
          strokeWidth={level === 100 ? 1.2 : 0.75}
        />
      ))}
      {AXES.map((_, i) => {
        const tip = point(i, MAX_R);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={tip.x.toFixed(1)}
            y2={tip.y.toFixed(1)}
            style={{ stroke: "var(--color-border)" }}
            strokeWidth={0.75}
          />
        );
      })}
      <polygon
        points={polygonPoints(radiusFor)}
        style={{ fill: "var(--color-accent)", stroke: "var(--color-accent)" }}
        fillOpacity={0.22}
        strokeWidth={2}
      />
      {AXES.map((_, i) => {
        const p = point(i, radiusFor(i));
        return (
          <circle
            key={i}
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={3.4}
            style={{ fill: "var(--color-accent)" }}
          />
        );
      })}
      {AXES.map((axis, i) => {
        const lp = point(i, MAX_R + 16);
        const cos = Math.cos(angle(i));
        const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle";
        // Nudged clear of the radar's data polygon at these positions — an
        // approximate character shift at this font size (~5.7px/char).
        const dx =
          axis.key === "kpi_understandability" ? 23
          : axis.key === "kpi_maintainability" ? 45
          : 0;
        const dy = axis.key === "kpi_maintainability" ? -34 : 0;
        return (
          <text
            key={axis.key}
            x={(Number(lp.x) + dx).toFixed(1)}
            y={(Number(lp.y) + dy).toFixed(1)}
            textAnchor={anchor}
            dominantBaseline="central"
            style={{ fill: "var(--color-fg)", fontFamily: "var(--font-mono)", fontSize: "9.5px" }}
          >
            {axis.label}
          </text>
        );
      })}
    </svg>
  );
}

function AxisRow({
  label,
  pct,
  labels,
  mode,
  hidden = false,
}: {
  label: string;
  pct: number | null;
  labels: string[];
  mode: "delivered" | "missing";
  /** Kept in the DOM (reserving its row height) but visually hidden — used
   * for DETA06 in Delivered mode so toggling never changes the table's
   * overall height (no "present" list exists for DETA06 to show instead). */
  hidden?: boolean;
}) {
  const severity = percentSeverity(pct);
  const labelColorVar =
    mode === "delivered" ? "var(--color-success)" : "var(--color-danger)";
  const labelClass = mode === "delivered" ? "text-success bg-success/10" : "text-danger bg-danger/10";
  return (
    <div
      className={`py-2 border-b border-border last:border-0 space-y-1 ${hidden ? "invisible" : ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-[0.1em] font-mono text-muted">
          {label}
        </span>
        <span className={`text-xs font-mono ${COMPLIANCE_SEVERITY_CLASS[severity]}`}>
          {pct === null ? "—" : `${pct}%`}
        </span>
      </div>
      <div className="text-xs">
        {labels.length > 0 ? (
          <div className="flex flex-wrap gap-x-1.5 gap-y-1">
            {labels.map((l) => (
              <span
                key={l}
         className={`rounded-full border px-2 py-0.5 ${labelClass}`}
                style={{ borderColor: labelColorVar }}
              >
                {l}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-fg/90">—</span>
        )}
      </div>
    </div>
  );
}

/**
 * Content of the Compliance tab on the Application detail page: a 5-axis
 * radar (percentage of KPI documents present, hand-computed SVG) plus a
 * detailed list with a Delivered/Missing toggle.
 */
export default function ComplianceTab({
  application,
}: {
  /** Application already fetched by the parent — no data fetching here. */
  application: Application;
}) {
  const [mode, setMode] = useState<"delivered" | "missing">("delivered");

  const percents = AXES.map((axis) =>
    axis.key === "deta06"
      ? application.deta06ComplianceLevel
      : kpiPercentage(axis.key as KpiKey, application[axis.key as KpiKey]),
  );

  // Table order is independent from the radar's axis order (AXES) —
  // Security always sorts first and DETA06 always sorts last here,
  // regardless of where they sit on the radar.
  const tableRank = (key: (typeof AXES)[number]["key"]) =>
    key === "kpi_security" ? 0 : key === "deta06" ? 2 : 1;
  // DETA06 is always present in `rows` (never filtered out) — in Delivered
  // mode it's just marked `hidden`, so its row still reserves its height and
  // toggling the switch never changes the table's overall size.
  const rows = [...AXES]
    .sort((a, b) => tableRank(a.key) - tableRank(b.key))
    .map((axis) => {
      const i = AXES.indexOf(axis);
      if (axis.key === "deta06") {
        return {
          label: axis.label,
          pct: percents[i],
          labels: mode === "missing" ? deta06MissingLabels(application.deta06MissingDocs) : [],
          hidden: mode === "delivered",
        };
      }
      const key = axis.key as KpiKey;
      const raw = application[key];
      const labels =
        mode === "delivered" ? kpiPresentLabels(key, raw) : kpiMissingLabels(key, raw);
      return { label: axis.label, pct: percents[i], labels, hidden: false };
    });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
      <div className="rounded-card border border-border bg-surface p-4">
        <Radar percents={percents} />
      </div>
      <div>
        <div className="flex items-center justify-end gap-2 mb-3">
          <span
            className={`text-xs uppercase tracking-[0.1em] font-mono ${
              mode === "delivered" ? "text-fg" : "text-muted"
            }`}
          >
            Delivered
          </span>
          <Switch
            checked={mode === "missing"}
            onChange={(v) => setMode(v ? "missing" : "delivered")}
            checkedClassName="bg-danger"
            uncheckedClassName="bg-success"
          />
          <span
            className={`text-xs uppercase tracking-[0.1em] font-mono ${
              mode === "missing" ? "text-fg" : "text-muted"
            }`}
          >
            Missing
          </span>
        </div>
        {rows.map((row) => (
          <AxisRow
            key={row.label}
            label={row.label}
            pct={row.pct}
            labels={row.labels}
            mode={mode}
            hidden={row.hidden}
          />
        ))}
      </div>
    </div>
  );
}
