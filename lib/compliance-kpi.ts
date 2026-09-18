import catalog from "./compliance-kpi-catalog.json";

/** The 4 multi-valued KPI fields whose percentage is a present/possible ratio. */
export type KpiKey =
  | "kpi_functionalSuitability"
  | "kpi_maintainability"
  | "kpi_understandability"
  | "kpi_security";

function valuesFor(key: KpiKey): Record<string, string> {
  return catalog[key].values;
}

/**
 * Ratio of recognized values present in `raw` over the total number of
 * possible values for `key`, rounded to the nearest 5%. An unrecognized raw
 * value is neither counted present nor treated as an error — it just isn't
 * labeled in the present/missing lists either.
 */
export function kpiPercentage(key: KpiKey, raw: string[]): number {
  const values = valuesFor(key);
  const total = Object.keys(values).length;
  if (total === 0) return 0;
  const present = raw.filter((v) => v in values).length;
  return Math.round(((present / total) * 100) / 5) * 5;
}

/** Labels of the recognized values present in `raw` (Delivered mode). */
export function kpiPresentLabels(key: KpiKey, raw: string[]): string[] {
  const values = valuesFor(key);
  return raw.filter((v) => v in values).map((v) => values[v]);
}

/** Labels of the possible values NOT present in `raw` (Missing mode). */
export function kpiMissingLabels(key: KpiKey, raw: string[]): string[] {
  const values = valuesFor(key);
  return Object.keys(values)
    .filter((v) => !raw.includes(v))
    .map((v) => values[v]);
}

/** Labels of `deta06MissingDocs` codes — DETA06 only ever lists missing
 * items (the backend does not provide a "present" list for it). */
export function deta06MissingLabels(raw: string[]): string[] {
  const values = catalog.deta06.values as Record<string, string>;
  return raw.filter((v) => v in values).map((v) => values[v]);
}

export type ComplianceSeverity = "good" | "warn" | "risk" | "unknown";

/** Same thresholds used elsewhere in the app: `>=80` good, `>=50` warn,
 * else risk, `null` (not reported) → unknown. */
export function percentSeverity(pct: number | null): ComplianceSeverity {
  if (pct === null) return "unknown";
  if (pct >= 80) return "good";
  if (pct >= 50) return "warn";
  return "risk";
}

export const COMPLIANCE_SEVERITY_CLASS: Record<ComplianceSeverity, string> = {
  good: "text-success",
  warn: "text-warning",
  risk: "text-danger",
  unknown: "text-muted",
};

/** The 5 radar axes, in display order — DETA06/Maintainability and
 * Security/Understandability were swapped from the natural field order so
 * the two longest labels (Maintainability, Understandability) land on radar
 * positions with enough room for their text, instead of being clipped. */
export const AXES: { key: KpiKey | "deta06"; label: string }[] = [
  { key: "kpi_functionalSuitability", label: catalog.kpi_functionalSuitability.label },
  { key: "deta06", label: catalog.deta06.label },
  { key: "kpi_security", label: catalog.kpi_security.label },
  { key: "kpi_understandability", label: catalog.kpi_understandability.label },
  { key: "kpi_maintainability", label: catalog.kpi_maintainability.label },
];
