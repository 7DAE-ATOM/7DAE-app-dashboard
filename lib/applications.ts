import {
  fetchApplication,
  fetchApplicationLinks,
  fetchApplications,
} from "./atom-api";
import { toApplication } from "./application-adapter";
import { toApplicationLinks } from "./application-links-adapter";
import type {
  Application,
  ApplicationLink,
  ApplicationCategory,
  ApplicationStatus,
  BusinessCriticality,
  PhotoFilter,
} from "./types";

export async function getApplications(): Promise<Application[]> {
  const dtos = await fetchApplications();
  return dtos.map(toApplication);
}

export async function getApplicationByExternalId(
  externalId: string,
): Promise<Application | null> {
  const dto = await fetchApplication(externalId);
  return dto ? toApplication(dto) : null;
}

export async function getApplicationLinks(
  externalId: string,
): Promise<ApplicationLink[]> {
  const dtos = await fetchApplicationLinks(externalId);
  return toApplicationLinks(dtos, externalId);
}

/** Sentinel option in the Portfolio filter that matches Applications with `portfolio === null`. */
export const PORTFOLIO_NONE = "__none__";

export type Filters = {
  search?: string;
  photo?: PhotoFilter;
  categories?: ApplicationCategory[];
  statuses?: ApplicationStatus[];
  portfolios?: string[];
  operator?: string;
  businessCriticalities?: BusinessCriticality[];
  /** Business Capability ids **already expanded to their descendants** by the
   * caller (see `expandSelection`). Deliberately named apart from
   * `FilterValue.businessCapabilityIds`, which holds only what the user
   * actually checked: the two must never be confused, and the different name
   * keeps `FilterValue` structurally assignable to `Filters`. */
  businessCapabilityIdsExpanded?: Set<string>;
};

export function filterApplications(
  list: Application[],
  f: Filters,
): Application[] {
  return list.filter((m) => {
    if (f.photo === "with" && m.photos.length === 0) return false;
    if (f.photo === "without" && m.photos.length > 0) return false;
    if (f.categories?.length && !f.categories.includes(m.category))
      return false;
    if (f.statuses?.length && !f.statuses.includes(m.status)) return false;
    if (
      f.businessCriticalities?.length &&
      !f.businessCriticalities.includes(m.businessCriticality)
    )
      return false;
    if (f.portfolios?.length) {
      if (m.portfolio == null) {
        if (!f.portfolios.includes(PORTFOLIO_NONE)) return false;
      } else if (!f.portfolios.includes(m.portfolio.name)) {
        return false;
      }
    }
    if (f.businessCapabilityIdsExpanded?.size) {
      // Many-to-many, unlike every other axis: an application matches as soon
      // as one of its capabilities falls inside a checked node's subtree.
      if (
        !m.businessCapabilities.some((bc) =>
          f.businessCapabilityIdsExpanded!.has(bc.id),
        )
      ) {
        return false;
      }
    }
    if (f.operator?.trim()) {
      const q = f.operator.trim().toLowerCase();
      if (!(m.operator ?? "").toLowerCase().includes(q)) return false;
    }
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = [
        m.name,
        m.externalId,
        m.description,
        m.manager?.name ?? "",
        m.operator ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function uniqueCategories(list: Application[]): ApplicationCategory[] {
  return Array.from(new Set(list.map((m) => m.category)));
}

export function uniqueStatuses(list: Application[]): ApplicationStatus[] {
  return Array.from(new Set(list.map((m) => m.status)));
}

export function uniqueBusinessCriticalities(
  list: Application[],
): BusinessCriticality[] {
  return Array.from(new Set(list.map((m) => m.businessCriticality)));
}

export function uniquePortfolios(list: Application[]): string[] {
  const names = new Set<string>();
  let hasNone = false;
  for (const m of list) {
    if (m.portfolio) names.add(m.portfolio.name);
    else hasNone = true;
  }
  const sorted = Array.from(names).sort();
  if (hasNone) sorted.push(PORTFOLIO_NONE);
  return sorted;
}
