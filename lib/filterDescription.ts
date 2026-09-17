import type { FilterValue } from "@/components/FilterBar";
import { PORTFOLIO_NONE } from "@/lib/applications";
import {
  BUSINESS_CRITICALITY_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";

/** The hierarchical axes' names are passed in rather than derived here: only
 * the caller holds the trees, and the export header must show names, never raw
 * technical ids. A named object rather than positional arguments — two
 * anonymous string arrays in a row would be trivially swapped. */
export function serializeFilters(
  filters: FilterValue,
  names: { capabilities?: string[]; dataObjects?: string[] } = {},
): string {
  const lines: string[] = [];

  if (filters.search.trim()) lines.push(`Search: "${filters.search.trim()}"`);
  if (filters.photo === "with") lines.push("With photo only");
  if (filters.photo === "without") lines.push("Without photo only");
  if (filters.categories.length > 0) {
    lines.push(
      `Category: ${filters.categories.map((c) => CATEGORY_LABELS[c] ?? c).join(", ")}`,
    );
  }
  if (filters.statuses.length > 0) {
    lines.push(
      `Status: ${filters.statuses.map((s) => STATUS_LABELS[s] ?? s).join(", ")}`,
    );
  }
  if (filters.portfolios.length > 0) {
    lines.push(
      `Portfolio: ${filters.portfolios.map((p) => (p === PORTFOLIO_NONE ? "None" : p)).join(", ")}`,
    );
  }
  if (filters.operator.trim()) {
    lines.push(`Operator: "${filters.operator.trim()}"`);
  }
  if (filters.businessCriticalities.length > 0) {
    lines.push(
      `Business Criticality: ${filters.businessCriticalities.map((c) => BUSINESS_CRITICALITY_LABELS[c] ?? c).join(", ")}`,
    );
  }

  if (names.capabilities?.length) {
    lines.push(`Business Capabilities: ${names.capabilities.join(", ")}`);
  }

  if (names.dataObjects?.length) {
    lines.push(`Data Objects: ${names.dataObjects.join(", ")}`);
  }

  return lines.length === 0
    ? "All applications (no filters applied)"
    : lines.join("\n");
}
