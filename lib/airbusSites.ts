import type { Application } from "@/lib/types";

/**
 * The Airbus sites an application can be declared on, and how to recognise
 * them in the data.
 *
 * `airbusSite` is FREE TEXT in LeanIX, not a controlled enumeration: `tjn` is
 * an abbreviation of Tianjin and `bengalore` a loose spelling of Bengaluru.
 * Matching is therefore by normalised alias, never by equality — and anything
 * that fails to match is REPORTED rather than dropped. That last point is the
 * whole safety property here: a new site opens, nobody updates this table, and
 * a map that silently ignored the value would keep showing a credible, wrong
 * total forever.
 */

export type AirbusSite = {
  readonly id: string;
  readonly label: string;
  readonly country: string;
  readonly lat: number;
  readonly lng: number;
  /** Normalised strings that resolve to this site. Add to this list rather
   *  than "fixing" the data upstream — the app displays what LeanIX holds. */
  readonly aliases: readonly string[];
  readonly inEurope: boolean;
  /**
   * Display offset, in EUROPE-panel canvas units, applied when drawing the
   * bubble — with a leader line back to the true position.
   *
   * Only Bremen carries one, and it is not a preference: Hamburg and Bremen
   * are 110 km apart, which is 36 canvas units on the inset and 7 on the world
   * map, while a legible bubble needs a radius of ~50. No European framing can
   * separate them, so the bubble is moved and the lie is declared by the
   * leader line.
   */
  readonly insetOffset?: readonly [number, number];
};

export const AIRBUS_SITES: readonly AirbusSite[] = [
  {
    id: "toulouse",
    label: "Toulouse",
    country: "France",
    lat: 43.63,
    lng: 1.37,
    aliases: ["toulouse", "tls", "blagnac", "toulouse-blagnac"],
    inEurope: true,
  },
  {
    id: "filton",
    label: "Filton",
    country: "United Kingdom",
    lat: 51.51,
    lng: -2.58,
    aliases: ["filton", "fil", "bristol"],
    inEurope: true,
  },
  {
    id: "hamburg",
    label: "Hamburg",
    country: "Germany",
    lat: 53.53,
    lng: 9.84,
    aliases: ["hambourg", "hamburg", "hmb", "ham", "finkenwerder"],
    inEurope: true,
  },
  {
    id: "bremen",
    label: "Bremen",
    country: "Germany",
    lat: 53.05,
    lng: 8.79,
    aliases: ["bremen", "breme", "bre"],
    inEurope: true,
    insetOffset: [-160, 130],
  },
  {
    id: "getafe",
    label: "Getafe",
    country: "Spain",
    lat: 40.3,
    lng: -3.72,
    aliases: ["getafe", "get", "madrid"],
    inEurope: true,
  },
  {
    id: "bengaluru",
    label: "Bengaluru",
    country: "India",
    lat: 12.97,
    lng: 77.59,
    aliases: ["bengalore", "bengaluru", "bangalore", "blr"],
    inEurope: false,
  },
  {
    id: "mirabel",
    label: "Mirabel",
    country: "Canada",
    lat: 45.68,
    lng: -74.03,
    aliases: ["mirabel", "mir"],
    inEurope: false,
  },
  {
    id: "mobile",
    label: "Mobile",
    country: "United States",
    lat: 30.69,
    lng: -88.04,
    aliases: ["mobile", "mob"],
    inEurope: false,
  },
  {
    id: "tianjin",
    label: "Tianjin",
    country: "China",
    lat: 39.13,
    lng: 117.2,
    aliases: ["tjn", "tianjin"],
    inEurope: false,
  },
];

/** Values meaning "every site". Not a place, and deliberately not plotted —
 *  see `classifyApplication`. */
const ALL_SITES_ALIASES = new Set(["all", "all sites", "tous", "tous les sites"]);

/** Lowercase, strip accents, collapse whitespace. Enough for free text typed
 *  by different people in different tools; anything cleverer would start
 *  guessing. */
function normalise(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_-]+/g, " ")
    .trim();
}

const BY_ALIAS = new Map<string, AirbusSite>();
for (const site of AIRBUS_SITES) {
  for (const alias of site.aliases) BY_ALIAS.set(normalise(alias), site);
}

export function resolveSite(raw: string): AirbusSite | null {
  return BY_ALIAS.get(normalise(raw)) ?? null;
}

export function isAllSitesValue(raw: string): boolean {
  return ALL_SITES_ALIASES.has(normalise(raw));
}

export function getSite(id: string): AirbusSite | null {
  return AIRBUS_SITES.find((s) => s.id === id) ?? null;
}

/**
 * Which bucket an application belongs to. Exactly ONE per application, by
 * priority, so that the four counts reconcile exactly with the filtered total
 * — that reconciliation is what makes the "unlocated" notice trustworthy.
 *
 * `located` wins over `all`: an application declared on `all` AND `toulouse`
 * is a Toulouse application; the catch-all adds nothing.
 */
export type SiteClass = "located" | "all-sites" | "unknown" | "none";

export type Classification = {
  readonly kind: SiteClass;
  /** Sites resolved for this application; empty unless `kind` is `located`. */
  readonly sites: readonly AirbusSite[];
  /** Raw values that resolved to nothing. Collected EVEN when the application
   *  is located through another value — an unrecognised site must surface even
   *  when it changes no total. */
  readonly unknownValues: readonly string[];
};

export function classifyApplication(application: Application): Classification {
  const sites: AirbusSite[] = [];
  const unknownValues: string[] = [];
  let sawAll = false;

  for (const raw of application.airbusSites) {
    const value = raw.trim();
    if (!value) continue;
    if (isAllSitesValue(value)) {
      sawAll = true;
      continue;
    }
    const site = resolveSite(value);
    if (site) {
      if (!sites.includes(site)) sites.push(site);
    } else {
      unknownValues.push(value);
    }
  }

  if (sites.length > 0) return { kind: "located", sites, unknownValues };
  if (sawAll) return { kind: "all-sites", sites: [], unknownValues };
  if (unknownValues.length > 0) return { kind: "unknown", sites: [], unknownValues };
  return { kind: "none", sites: [], unknownValues };
}
