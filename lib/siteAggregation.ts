import type { Application } from "@/lib/types";
import {
  AIRBUS_SITES,
  classifyApplication,
  type AirbusSite,
} from "@/lib/airbusSites";

/**
 * Groups the currently visible applications by Airbus site, for the map.
 *
 * Two properties matter more than the counts themselves:
 *
 *  - **Reconciliation.** located + allSites + unknown + none === the filtered
 *    total. Without it the "unlocated" notice is decoration; with it, it is a
 *    check anyone can run by eye against the filter panel's own count.
 *  - **Europe is de-duplicated, never summed.** An application declared on
 *    both Toulouse and Hamburg is ONE European application. The world map's
 *    aggregate bubble therefore does not equal the sum of the five inset
 *    bubbles, and the UI has to say so.
 */

export type SiteBucket = {
  readonly site: AirbusSite;
  readonly applications: readonly Application[];
};

export type SiteAggregation = {
  /** Sites carrying at least one application, in table order. */
  readonly buckets: readonly SiteBucket[];
  /** De-duplicated union of the European buckets. NOT the sum. */
  readonly europe: readonly Application[];
  /** Declared on every site: excluded from the bubbles unless `includeAllSites`. */
  readonly allSites: readonly Application[];
  /** Carry a site value that matches nothing in the table. */
  readonly unknown: readonly Application[];
  /** Carry no site value at all. */
  readonly none: readonly Application[];
  /** Distinct unrecognised raw values, with how many applications use each.
   *  Collected across every application, including located ones. */
  readonly unknownValues: ReadonlyMap<string, number>;
  /** Applications falling in exactly one of the four classes, COUNTED, not
   *  derived by subtraction — a derived figure would make the reconciliation
   *  true by construction and therefore blind. */
  readonly classCounts: {
    readonly located: number;
    readonly allSites: number;
    readonly unknown: number;
    readonly none: number;
  };
  /** Largest bubble drawn anywhere, used to scale every radius on one shared
   *  scale so two identical discs never mean two different numbers. */
  readonly maxCount: number;
};

const byName = (a: Application, b: Application) => a.name.localeCompare(b.name);

export function aggregateBySite(
  applications: readonly Application[],
  includeAllSites: boolean,
): SiteAggregation {
  const perSite = new Map<string, Application[]>();
  const allSites: Application[] = [];
  const unknown: Application[] = [];
  const none: Application[] = [];
  const unknownValues = new Map<string, number>();
  let locatedCount = 0;

  for (const application of applications) {
    const { kind, sites, unknownValues: unresolved } = classifyApplication(application);
    for (const value of unresolved) {
      unknownValues.set(value, (unknownValues.get(value) ?? 0) + 1);
    }

    if (kind === "located") {
      locatedCount += 1;
      for (const site of sites) {
        const bucket = perSite.get(site.id);
        if (bucket) bucket.push(application);
        else perSite.set(site.id, [application]);
      }
    } else if (kind === "all-sites") {
      allSites.push(application);
    } else if (kind === "unknown") {
      unknown.push(application);
    } else {
      none.push(application);
    }
  }

  // Re-integrating `all` means adding those applications to EVERY site — which
  // is the literal reading, and also why it is off by default: the same
  // constant on every bubble flattens exactly the differences the map exists
  // to show.
  if (includeAllSites && allSites.length > 0) {
    for (const site of AIRBUS_SITES) {
      const bucket = perSite.get(site.id);
      if (bucket) bucket.push(...allSites);
      else perSite.set(site.id, [...allSites]);
    }
  }

  const buckets: SiteBucket[] = [];
  for (const site of AIRBUS_SITES) {
    const bucket = perSite.get(site.id);
    if (bucket && bucket.length > 0) {
      buckets.push({ site, applications: [...bucket].sort(byName) });
    }
  }

  // A Set, not a sum: an application on Toulouse and Hamburg is one European
  // application. This is the single reason the world bubble and the inset
  // bubbles do not add up, and it is intended.
  const europeById = new Map<string, Application>();
  for (const { site, applications: list } of buckets) {
    if (!site.inEurope) continue;
    for (const application of list) europeById.set(application.id, application);
  }
  const europe = [...europeById.values()].sort(byName);

  const maxCount = Math.max(
    europe.length,
    ...buckets.map((b) => b.applications.length),
    0,
  );

  return {
    buckets,
    europe,
    allSites,
    unknown,
    none,
    unknownValues,
    classCounts: {
      located: locatedCount,
      allSites: allSites.length,
      unknown: unknown.length,
      none: none.length,
    },
    maxCount,
  };
}
