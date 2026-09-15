export type ApplicationCategory =
  | "ivbot"
  | "END_USER_TOOL"
  | "component"
  | "official"
  | "not1v"
  | "notDefined";

export type ApplicationStatus =
  | "active"
  | "developmentPhase"
  | "inactive"
  | "planPhase"
  | "NA";

export type BusinessCriticality =
  | "missionCritical"
  | "businessCritical"
  | "businessOperational"
  | "administrativeService"
  | "NA";

export type ProviderType = "airbus" | "external" | "NA";

/** Tri-state photo filter: any Application / only with ≥1 photo / only without photos. */
export type PhotoFilter = "all" | "with" | "without";

/**
 * A photo attached to an application.
 *
 * - `resourceId` / `resourceUri` are passed directly to the ATOM backend
 *   `POST /api/infos/resource` from the browser (CORS enabled).
 * - `kind` reflects the `SELECTED` naming convention from the backend.
 * - `is360` is true when the document name ends with `3D.<ext>` — equirectangular panoramas.
 */
export type Photo = {
  resourceId: string;
  resourceUri: string;
  alt?: string;
  kind?: "selected" | "other";
  is360?: boolean;
};

export type CoverPhoto = { id: string; uri: string };

export type LinkedResourceKind = "video" | "slides" | "docs" | "sheets";

/** A video (documentRefs entries with documentType === "video") or a Google
 * Docs/Slides/Sheets document (detected from the URL shape, independent of
 * documentType) attached to an application, embeddable via Google's own
 * preview/embed iframes. `embedUrl` is null when the file ID couldn't be
 * extracted from `url` — callers fall back to a plain "Open" link. */
export type LinkedResourceRef = {
  id: string;
  name: string;
  url: string;
  kind: LinkedResourceKind;
  embedUrl: string | null;
};

export type Person = {
  name: string;
  email: string;
};

export type ApplicationLifecycle = {
  phaseIn?: string;
  active?: string;
  phaseOut?: string;
  endOfLife?: string;
  plan?: string;
};

export type DataObject = {
  id: string;
  name: string;
};

/** A Business Capability FactSheet linked to an application via
 * `relApplicationToBusinessCapability`. `externalId` is nullable: the
 * `... on BusinessCapability` fragment may not resolve one. */
export type BusinessCapability = {
  id: string;
  name: string;
  externalId: string | null;
};

/** One node of the Business Capability hierarchy, rebuilt client-side from
 * the flat `relToParent` crawl (`lib/businessCapabilities.ts`). Distinct from
 * `BusinessCapability` above, which is the *link* carried by an application
 * and knows nothing of the tree. */
export type BusinessCapabilityTreeNode = {
  id: string;
  name: string;
  externalId: string | null;
  /** `null` for a root — including a node whose parent is missing from the
   * crawl, which is promoted to a root rather than dropped. */
  parentId: string | null;
  children: BusinessCapabilityTreeNode[];
};

/** The hierarchy as consumed by the filter: the roots to render, plus a flat
 * index for subtree/descendant lookups without walking from the top. */
export type BusinessCapabilityTree = {
  roots: BusinessCapabilityTreeNode[];
  byId: Map<string, BusinessCapabilityTreeNode>;
};

export type Application = {
  id: string;
  externalId: string;
  name: string;
  category: ApplicationCategory;
  status: ApplicationStatus;
  description: string;
  lifecycle: ApplicationLifecycle;
  version: string | null;
  portfolio: { id: string; name: string } | null;
  operator: string | null;
  providerType: ProviderType;
  deptProviders: string[];
  manager: Person | null;
  managerDelegates: Person[];
  solutionArchitect: Person | null;
  completion: number;
  businessCriticality: BusinessCriticality;
  airbusSite: string | null;
  functionalSuitability: string | null;
  technicalSuitability: string | null;
  kpi_functionalSuitability: string[];
  kpi_maintainability: string[];
  kpi_understandability: string[];
  kpi_security: string[];
  deta06ComplianceLevel: number | null;
  deta06MissingDocs: string[];
  programCategory: string | null;
  partIS: string | null;
  obsoRiskStatus: string | null;
  BRDURL: string | null;
  ARDURL: string | null;
  confluenceURL: string | null;
  gDrivePath: string | null;
  coverPhoto: CoverPhoto | null;
  photos: Photo[];
  linkedResources: LinkedResourceRef[];
  dataObjects: DataObject[];
  businessCapabilities: BusinessCapability[];
};

/** Direction of data flow between an application and one of its neighbours,
 * as reported by `GET /api/infos/applications/{externalId}/links`.
 * `both` is sent explicitly by the backend — it is never inferred here.
 * `unknown` covers any value the backend adds later. */
export type LinkDirection = "inbound" | "outbound" | "both" | "unknown";

/** A neighbouring application in the interface graph. Unrelated to
 * `LinkedResourceRef`, which models Google Docs/videos attached to a fiche. */
export type ApplicationLink = {
  id: string;
  externalId: string;
  name: string;
  direction: LinkDirection;
};

/* ---------------------------------------------------------------------- *
 * Discover graph — neutral node/edge model. Independent of the LeanIX
 * GraphQL response shape (`lib/atom-api.ts`'s `ApplicationInterfacesNode` /
 * `InterfaceNode`); `lib/discover-graph-adapter.ts` produces these from that
 * shape. All identification is by technical `id` (never `externalId`,
 * absent on Interface and sometimes on Application).
 * ---------------------------------------------------------------------- */

export type DiscoverApplicationNode = {
  kind: "application";
  /** Technical id — the graph's node id and the only key used for lookups. */
  id: string;
  externalId: string | null;
  name: string;
  /** Resolved from the already-loaded `Application[]` catalogue, not from
   * the Interface GraphQL queries (which don't carry it) — `null` when the
   * application isn't in that catalogue or has no manager set. */
  managerName: string | null;
};

export type DiscoverInterfaceNode = {
  kind: "interface";
  id: string;
  name: string | null;
  protocol: string | null;
  /** Technical id of the provider Application — always known once an
   * Interface node exists, since it anchors the circle's position. */
  providerId: string;
};

export type DiscoverGraphNode = DiscoverApplicationNode | DiscoverInterfaceNode;

/** Always drawn from the consuming Application to the consumed Interface. */
export type DiscoverEdge = {
  id: string;
  consumerId: string;
  interfaceId: string;
  interfacetype: string | null;
  frequency: string | null;
};
