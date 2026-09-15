import { buildApplicationsQuery } from "./leanix-application-query";
import { buildBusinessCapabilitiesQuery } from "./leanix-business-capability-query";
import {
  buildApplicationInterfacesQuery,
  buildApplicationsInterfacesQuery,
  buildInterfaceDependenciesQuery,
} from "./leanix-interface-query";

export const NEXT_PUBLIC_ATOM_API_BASE_URL =
  process.env.NEXT_PUBLIC_ATOM_API_BASE_URL ??
  "http://localhost:8080/atom-synchronizer-dev";

/** One edge of a `rel...` relation resolved to its target FactSheet. */
export type RelatedFactSheetEdge = {
  node: {
    factSheet: {
      id: string;
      name: string | null;
      externalId?: { externalId: string } | null;
    } | null;
  };
};

/** One entry of `documents.edges[].node` — same shape as the former REST
 * `DocumentRef`, so `toPhotos`/`toLinkedResources` need no filtering changes. */
export type DocumentNode = {
  id: string;
  documentType: string | null;
  name: string | null;
  origin: string | null;
  url: string | null;
};

/** One `Application` FactSheet node from the LeanIX GraphQL schema, trimmed
 * to the fields `Application` (`lib/types.ts`) actually maps today — see
 * `lib/leanix-application-query.ts`. */
export type ApplicationNode = {
  id: string;
  externalId: { externalId: string };
  name: string;
  appCategory: string | null;
  appStatus: string | null;
  description: string | null;
  release: string | null;
  operator: string | null;
  providerType: string | null;
  deptProvider: string[] | null;
  businessCriticality: string | null;
  functionalSuitability: string | null;
  technicalSuitability: string | null;
  kpi_functionalSuitability: string[] | null;
  kpi_maintainability: string[] | null;
  kpi_understandability: string[] | null;
  kpi_security: string[] | null;
  deta06ComplianceLevel: number | null;
  deta06MissingDocs: string[] | null;
  obsoRiskStatus: string | null;
  airbusSite: string[] | null;
  programCategory: string | null;
  partIS: string | null;
  BRDURL: string | null;
  ARDURL: string | null;
  confluenceURL: string | null;
  gDrivePath: string | null;
  completion: { percentage: number } | null;
  lifecycle: { phases: { phase: string; startDate: string }[] } | null;
  documents: { edges: { node: DocumentNode }[] } | null;
  relApplicationToBusinessOwnerUsers: { edges: RelatedFactSheetEdge[] } | null;
  relApplicationToSolutionArchitectUsers: {
    edges: RelatedFactSheetEdge[];
  } | null;
  relApplicationToPortfolio: { edges: RelatedFactSheetEdge[] } | null;
  relApplicationToDataObject: { edges: DataObjectEdge[] } | null;
  relApplicationToBusinessCapability: { edges: DataObjectEdge[] } | null;
};

export type AtomErrorKind = "backend-down" | "unauthorized" | "http-error";

/** Structured diagnostics carried on every AtomApiError so the error screen can
 * show the REAL parameters used (full URL, configured base, auth mode, cause)
 * without anyone having to read server/browser logs. */
export type AtomErrorDetails = {
  kind: AtomErrorKind;
  /** The full URL actually requested (the real value, after env resolution). */
  url: string;
  /** The configured base URL = process.env.NEXT_PUBLIC_ATOM_API_BASE_URL or the
   * hardcoded fallback when the env var was not injected at build time. */
  baseUrl: string;
  /** Whether the env var was set at build time (false → fallback in use). */
  baseUrlFromEnv: boolean;
  /** Whether the page origin matches the API origin (cross-origin → CORS risk). */
  sameOrigin: boolean | null;
  /** The page origin the call was made from (browser only). */
  pageOrigin: string | null;
  /** "bearer-dev" when NEXT_PUBLIC_DEV_JWT was attached, else "none". */
  auth: "bearer-dev" | "none";
  /** HTTP status (0 for network/timeout failures). */
  status: number;
  statusText: string;
  /** Underlying fetch rejection for network failures (name: message). */
  cause?: string;
};

export class AtomApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string,
    public details?: AtomErrorDetails,
  ) {
    super(message ?? `ATOM API error ${status} ${statusText}`);
    this.name = "AtomApiError";
  }
}

/** Did the build actually inject NEXT_PUBLIC_ATOM_API_BASE_URL? When false the
 * fallback above is in use — a very common deploy misconfiguration. */
export const BASE_URL_FROM_ENV = Boolean(
  process.env.NEXT_PUBLIC_ATOM_API_BASE_URL,
);

/** Compares the API origin to the page origin (browser only) to surface
 * cross-origin calls, which break the same-origin gateway-injection model. */
function originInfo(url: string): {
  sameOrigin: boolean | null;
  pageOrigin: string | null;
} {
  if (typeof window === "undefined") {
    return { sameOrigin: null, pageOrigin: null };
  }
  const pageOrigin = window.location.origin;
  try {
    return { sameOrigin: new URL(url).origin === pageOrigin, pageOrigin };
  } catch {
    return { sameOrigin: null, pageOrigin };
  }
}

/** Wall-clock timeout for any single ATOM API call (ms). */
const FETCH_TIMEOUT_MS = 15_000;

async function atomFetch(
  url: string,
  init: RequestInit & { next?: { revalidate?: number } },
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  // Auth header is DEV-ONLY: in production the app is served same-origin behind
  // the AFTER Istio gateway, which injects the user's `Authorization: Bearer`
  // from the session cookies — the SPA adds nothing. In dev there is no gateway,
  // so a test JWT can be supplied via NEXT_PUBLIC_DEV_JWT (.env.local). When
  // unset, no header is added and behaviour is unchanged.
  const devJwt = process.env.NEXT_PUBLIC_DEV_JWT;
  const auth = devJwt ? `Bearer ${devJwt}` : "";
  const { sameOrigin, pageOrigin } = originInfo(url);
  // Shared diagnostics baked into every error so the page can show the REAL
  // parameters (full URL, base, origin, auth) without anyone reading logs.
  const baseDetails = {
    url,
    baseUrl: NEXT_PUBLIC_ATOM_API_BASE_URL,
    baseUrlFromEnv: BASE_URL_FROM_ENV,
    sameOrigin,
    pageOrigin,
    auth: (auth ? "bearer-dev" : "none") as "bearer-dev" | "none",
  };
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        ...init.headers,
        ...(auth ? { Authorization: auth } : {}),
      },
      signal: controller.signal,
    });
  } catch (err) {
    const e = err as { name?: string; message?: string };
    const cause = `${e?.name ?? "Error"}: ${e?.message ?? String(err)}`;
    if (e?.name === "AbortError") {
      throw new AtomApiError(
        0,
        "Timeout",
        // `ATOM_BACKEND_DOWN:` is a machine-readable prefix consumed by
        // `app/error.tsx` to render the dedicated "API unavailable" screen.
        // Keep the prefix stable; the human-readable suffix may change.
        `ATOM_BACKEND_DOWN: timeout after ${FETCH_TIMEOUT_MS}ms at ${url}`,
        { kind: "backend-down", status: 0, statusText: "Timeout", cause, ...baseDetails },
      );
    }
    // A browser fetch that rejects (vs returning a 4xx/5xx) means the request
    // never completed: DNS/connection refused, CORS preflight blocked, or
    // mixed-content (https page → http URL). The `cause` text disambiguates.
    throw new AtomApiError(
      0,
      "Network error",
      `ATOM_BACKEND_DOWN: ${cause} at ${url}`,
      { kind: "backend-down", status: 0, statusText: "Network error", cause, ...baseDetails },
    );
  } finally {
    clearTimeout(timer);
  }
  // 401/403 → dedicated "not authorized" screen. `ATOM_UNAUTHORIZED:` is a
  // machine-readable prefix consumed by `app/error.tsx` (like ATOM_BACKEND_DOWN).
  if (res.status === 401 || res.status === 403) {
    throw new AtomApiError(
      res.status,
      res.statusText,
      `ATOM_UNAUTHORIZED: ${res.status} ${res.statusText} on ${url}`,
      {
        kind: "unauthorized",
        status: res.status,
        statusText: res.statusText,
        ...baseDetails,
      },
    );
  }
  return res;
}

/** Throws a diagnostics-rich AtomApiError for a non-OK HTTP response. The fetch
 * helpers call this so the error screen gets the URL + status, not a bare code. */
function httpError(res: Response, url: string): never {
  const { sameOrigin, pageOrigin } = originInfo(url);
  throw new AtomApiError(
    res.status,
    res.statusText,
    `ATOM_HTTP_ERROR: ${res.status} ${res.statusText} on ${url}`,
    {
      kind: "http-error",
      url,
      baseUrl: NEXT_PUBLIC_ATOM_API_BASE_URL,
      baseUrlFromEnv: BASE_URL_FROM_ENV,
      sameOrigin,
      pageOrigin,
      auth: process.env.NEXT_PUBLIC_DEV_JWT ? "bearer-dev" : "none",
      status: res.status,
      statusText: res.statusText,
    },
  );
}

/** GraphQL endpoint for LeanIX FactSheet reads (a REST-transported GraphQL
 * query, treated like the other ATOM API calls: same base URL, same auth). */
const GRAPHQL_URL = `${NEXT_PUBLIC_ATOM_API_BASE_URL}/api/leanix/graphql/query`;

/** Throws a diagnostics-rich AtomApiError for a GraphQL response that came
 * back HTTP 200 but carries `errors[]` — a GraphQL error is still an error,
 * regardless of whether `data` is also present (fail-closed: no partial
 * rendering from a response the backend itself flagged as failed). */
function graphQlError(
  res: Response,
  url: string,
  errors: { message: string }[],
): never {
  const { sameOrigin, pageOrigin } = originInfo(url);
  const cause = errors.map((e) => e.message).join("; ");
  throw new AtomApiError(
    res.status,
    res.statusText,
    `ATOM_HTTP_ERROR: GraphQL error(s) on ${url}: ${cause}`,
    {
      kind: "http-error",
      url,
      baseUrl: NEXT_PUBLIC_ATOM_API_BASE_URL,
      baseUrlFromEnv: BASE_URL_FROM_ENV,
      sameOrigin,
      pageOrigin,
      auth: process.env.NEXT_PUBLIC_DEV_JWT ? "bearer-dev" : "none",
      status: res.status,
      statusText: res.statusText,
      cause,
    },
  );
}

type AllFactSheetsResult<N = ApplicationNode> = {
  totalCount: number;
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  edges: { node: N }[];
};

/** Generic GraphQL POST — returns the full `data` object, untyped beyond
 * `T`. Callers know the field(s) they asked for (e.g. `allFactSheets`) and
 * destructure accordingly; this keeps the fetch/timeout/auth/error-mapping
 * logic (`atomFetch`/`httpError`/`graphQlError`) shared across every LeanIX
 * query this app makes, instead of duplicating it per query module. */
async function postGraphQL<T>(query: string): Promise<T> {
  const res = await atomFetch(GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) httpError(res, GRAPHQL_URL);
  const json = (await res.json()) as {
    data?: T;
    errors?: { message: string }[];
  };
  if (json.errors?.length) graphQlError(res, GRAPHQL_URL, json.errors);
  return json.data!;
}

/** Loops over `pageInfo.hasNextPage`/`endCursor` until every page has been
 * fetched — the backend's per-page limit is unknown, so no `first` argument
 * is sent and the loop keeps going until the server says there is no more. */
async function fetchAllApplicationNodes(
  buildQuery: (after?: string) => string,
): Promise<ApplicationNode[]> {
  const nodes: ApplicationNode[] = [];
  let after: string | undefined;
  do {
    const { allFactSheets: page } = await postGraphQL<{
      allFactSheets: AllFactSheetsResult;
    }>(buildQuery(after));
    // A FactSheet without an externalId can't be routed to (`/application?id=`
    // relies on it) or used as a list/React key — drop it rather than crash
    // the whole catalogue over one malformed LeanIX record.
    nodes.push(
      ...page.edges
        .map((e) => e.node)
        .filter((node) => !!node.externalId?.externalId),
    );
    after = page.pageInfo.hasNextPage
      ? (page.pageInfo.endCursor ?? undefined)
      : undefined;
  } while (after);
  return nodes;
}

export async function fetchApplications(): Promise<ApplicationNode[]> {
  return fetchAllApplicationNodes((after) => buildApplicationsQuery({ after }));
}

export async function fetchApplication(
  externalId: string,
): Promise<ApplicationNode | null> {
  const nodes = await fetchAllApplicationNodes((after) =>
    buildApplicationsQuery({ after, externalId }),
  );
  return nodes[0] ?? null;
}

/** A BusinessCapability FactSheet, as crawled for the catalogue's hierarchy
 * filter. `relToParent` uses the shared multi-target edge shape; the data
 * guarantees a single parent, so only the first edge is ever read. */
export type BusinessCapabilityNode = {
  id: string;
  externalId: { externalId: string } | null;
  name: string | null;
  relToParent: { edges: DataObjectEdge[] } | null;
};

/** Same `hasNextPage`/`endCursor` crawl as `fetchAllApplicationNodes`, with
 * one deliberate difference: nodes are **not** filtered on `externalId`. A
 * Business Capability may legitimately have none (`BusinessCapability
 * .externalId` is nullable) and the tree keys on the technical `id` anyway —
 * dropping those nodes would tear holes in the hierarchy. */
export async function fetchAllBusinessCapabilityNodes(): Promise<BusinessCapabilityNode[]> {
  const nodes: BusinessCapabilityNode[] = [];
  let after: string | undefined;
  do {
    const { allFactSheets: page } = await postGraphQL<{
      allFactSheets: AllFactSheetsResult<BusinessCapabilityNode>;
    }>(buildBusinessCapabilitiesQuery({ after }));
    nodes.push(...page.edges.map((e) => e.node).filter((node) => !!node.id));
    after = page.pageInfo.hasNextPage
      ? (page.pageInfo.endCursor ?? undefined)
      : undefined;
  } while (after);
  return nodes;
}

/** One entry of `GET /api/infos/applications/{externalId}/links`: a neighbouring
 * application plus the direction data flows between it and the queried one.
 * `direction` is deliberately typed loose — the backend vocabulary
 * (`inbound` / `outbound` / `both`) is normalised by the adapter, so an
 * unexpected value degrades gracefully instead of breaking the build. */
export type ApplicationLinkDto = {
  application: { id: string; externalId: string; name: string | null };
  direction: string | null;
};

export async function fetchApplicationLinks(
  externalId: string,
): Promise<ApplicationLinkDto[]> {
  const url = `${NEXT_PUBLIC_ATOM_API_BASE_URL}/api/infos/applications/${encodeURIComponent(externalId)}/links`;
  const res = await atomFetch(url, { next: { revalidate: 60 } });
  // An application with no known interfaces may 404 rather than return [].
  if (res.status === 404) return [];
  if (!res.ok) httpError(res, url);
  return (await res.json()) as ApplicationLinkDto[];
}

/* ---------------------------------------------------------------------- *
 * Discover graph — Application/Interface FactSheet model (distinct from the
 * simplified `/links` REST endpoint above, and from `ApplicationNode`). See
 * `lib/leanix-interface-query.ts` for the query text and
 * `lib/discover-graph-adapter.ts` for the mapping into the neutral graph
 * model consumed by the Discover components.
 * ---------------------------------------------------------------------- */

/** One `rel...` edge that carries `interfacetype`/`frequency` on the edge
 * itself (the Application↔Interface relations), resolved to the related
 * Application FactSheet. */
export type InterfaceRelatedApplicationEdge = {
  node: {
    interfacetype: string | null;
    frequency: string | null;
    factSheet: {
      id: string;
      name: string | null;
      externalId?: { externalId: string } | null;
    } | null;
  };
};

/** One edge of a multi-target FactSheet relation — used for
 * `relInterfaceToDataObject` (on an Interface), `relApplicationToDataObject`
 * and `relApplicationToBusinessCapability` (on an Application). Same shape in
 * every case: the target FactSheet with `id`, `name` and an optional
 * `externalId`. */
export type DataObjectEdge = {
  node: {
    factSheet: {
      id: string;
      name: string | null;
      externalId?: { externalId: string } | null;
    } | null;
  };
};

/** An Interface FactSheet as returned nested inside an Application query, or
 * directly via `buildInterfaceDependenciesQuery`. Whichever side the query
 * came from, the opposite relation may be absent (`null`) rather than
 * fetched — callers merge partial results across both query shapes. */
export type InterfaceNode = {
  id: string;
  externalId: { externalId: string } | null;
  name: string | null;
  protocol: string | null;
  relInterfaceToConsumerApplication: {
    edges: InterfaceRelatedApplicationEdge[];
  } | null;
  relInterfaceToProviderApplication: { edges: RelatedFactSheetEdge[] } | null;
  relInterfaceToDataObject: { edges: DataObjectEdge[] } | null;
};

/** An Application FactSheet as returned by `buildApplicationInterfacesQuery`
 * — both directions (provider / consumer) in one round-trip. */
export type ApplicationInterfacesNode = {
  id: string;
  externalId: { externalId: string } | null;
  name: string;
  relProviderApplicationToInterface: {
    edges: { node: { factSheet: InterfaceNode | null } }[];
  } | null;
  relConsumerApplicationToInterface: {
    edges: ConsumedInterfaceEdge[];
  } | null;
};

/** Same edge shape as `InterfaceRelatedApplicationEdge`, but the edge's
 * `factSheet` is the Interface itself (not an Application) — named
 * distinctly so the two are never accidentally interchanged. */
type ConsumedInterfaceEdge = {
  node: {
    interfacetype: string | null;
    frequency: string | null;
    factSheet: InterfaceNode | null;
  };
};

export async function fetchApplicationInterfaces(
  id: string,
): Promise<ApplicationInterfacesNode | null> {
  const { allFactSheets } = await postGraphQL<{
    allFactSheets: { edges: { node: ApplicationInterfacesNode }[] };
  }>(buildApplicationInterfacesQuery(id));
  return allFactSheets.edges[0]?.node ?? null;
}

/** Batched form of `fetchApplicationInterfaces`, for the catalogue-seeded
 * graph. Chunked so a 100-application seed stays a handful of parallel
 * POSTs (and keeps each query text reasonable) instead of 100 serial ones,
 * each carrying `atomFetch`'s 15 s timeout. Applications LeanIX doesn't
 * return are simply absent from the result. */
const APPLICATION_INTERFACES_CHUNK_SIZE = 25;

export async function fetchApplicationsInterfaces(
  ids: string[],
): Promise<ApplicationInterfacesNode[]> {
  if (ids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += APPLICATION_INTERFACES_CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + APPLICATION_INTERFACES_CHUNK_SIZE));
  }
  const pages = await Promise.all(
    chunks.map((chunk) =>
      postGraphQL<{ allFactSheets: { edges: { node: ApplicationInterfacesNode }[] } }>(
        buildApplicationsInterfacesQuery(chunk),
      ),
    ),
  );
  return pages.flatMap(({ allFactSheets }) => allFactSheets.edges.map((e) => e.node));
}

export async function fetchInterfaceDependencies(
  id: string,
): Promise<InterfaceNode | null> {
  const { allFactSheets } = await postGraphQL<{
    allFactSheets: { edges: { node: InterfaceNode }[] };
  }>(buildInterfaceDependenciesQuery(id));
  return allFactSheets.edges[0]?.node ?? null;
}
