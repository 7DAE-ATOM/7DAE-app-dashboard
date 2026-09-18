import type {
  ApplicationNode,
  DataObjectEdge,
  DocumentNode,
  RelatedFactSheetEdge,
} from "./atom-api";
import { detectGoogleDocFromUrl, getGoogleDriveEmbedUrl } from "./google-embed";
import type {
  Application,
  BusinessCapability,
  DataObject,
  Person,
} from "./types";

/** Unwraps a `rel...` relation's first edge to its target FactSheet — the
 * model only keeps a single portfolio/manager/architect, so later entries
 * (if any) are ignored. `null` when the relation has no edges, or the target
 * FactSheet has no `externalId` (shouldn't happen for Portfolio/Users, but
 * degrades gracefully rather than throwing). */
function firstRelatedFactSheet(
  rel: { edges: RelatedFactSheetEdge[] } | null,
): { id: string; name: string; externalId: string } | null {
  const factSheet = rel?.edges?.[0]?.node?.factSheet;
  const externalId = factSheet?.externalId?.externalId;
  if (!factSheet || !externalId) return null;
  return { id: factSheet.id, name: factSheet.name ?? "", externalId };
}

function toPerson(factSheet: { name: string; externalId: string }): Person {
  return { name: factSheet.name, email: factSheet.externalId };
}

/** Unlike `firstRelatedFactSheet`, an application can have several Data
 * Objects — every edge with a resolved FactSheet is kept, not just the
 * first. Only `id`/`name` are needed (Open Question: name only), so no
 * `externalId` guard here — a Data Object without one still shows its name. */
function mapDataObjects(rel: { edges: DataObjectEdge[] } | null): DataObject[] {
  return (rel?.edges ?? [])
    .map((e) => e.node.factSheet)
    .filter((fs): fs is NonNullable<typeof fs> => fs !== null)
    .map((fs) => ({ id: fs.id, name: fs.name?.trim() || "—" }));
}

/** Same edge shape and same tolerance as `mapDataObjects` — an application
 * can support several Business Capabilities, and one without a resolved
 * `externalId` still shows its name. */
function mapBusinessCapabilities(
  rel: { edges: DataObjectEdge[] } | null,
): BusinessCapability[] {
  return (rel?.edges ?? [])
    .map((e) => e.node.factSheet)
    .filter((fs): fs is NonNullable<typeof fs> => fs !== null)
    .map((fs) => ({
      id: fs.id,
      name: fs.name?.trim() || "—",
      externalId: fs.externalId?.externalId ?? null,
    }));
}

const DEFAULT_DOC_NAMES: Record<"slides" | "docs" | "sheets", string> = {
  slides: "Présentation",
  docs: "Document",
  sheets: "Feuille de calcul",
};

/** The URL shape decides the kind, not `documentType` — that backend field
 * is a manual category label we don't control and can't rely on (e.g. a
 * Slides deck has been seen tagged `documentType: "video"` in real data).
 * Slides/Docs/Sheets are detected first from the URL; anything left is
 * treated as a Drive file ("video") only if `documentType` says so, or if
 * the URL itself looks like a Drive file link. */
function toLinkedResources(node: ApplicationNode): Application["linkedResources"] {
  const documents = (node.documents?.edges ?? []).map((e) => e.node);
  return documents
    .filter((d): d is DocumentNode & { url: string } => !!d && !!d.url)
    .map((d): Application["linkedResources"][number] | null => {
      const detected = detectGoogleDocFromUrl(d.url);
      if (detected) {
        return {
          id: d.id,
          name: d.name?.trim() || DEFAULT_DOC_NAMES[detected.kind],
          url: d.url,
          kind: detected.kind,
          embedUrl: detected.embedUrl,
        };
      }
      const embedUrl = getGoogleDriveEmbedUrl(d.url);
      if (d.documentType?.toLowerCase() === "video" || embedUrl) {
        return {
          id: d.id,
          name: d.name?.trim() || "Vidéo",
          url: d.url,
          kind: "video",
          embedUrl,
        };
      }
      return null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
}

/** Real photos come from `documents` entries with `documentType: "photo"`
 * AND `origin: "LX_STORAGE_SERVICE"` (both required — confirmed backend
 * convention, distinct from the video/Slides/Sheets documents which share
 * `documentType: "video"` / `origin: "CUSTOM_LINK"`), streamed via the ATOM
 * resource API (`usePhoto`, `POST /api/infos/resource`) rather than embedded.
 * The "SELECTED" name convention picks the cover; when no photo is marked,
 * `coverPhoto` stays null (no fallback to the first photo) so the UI keeps
 * showing the generated per-application cover as the main image — real,
 * non-selected photos are still available as extra thumbnails, just never
 * chosen automatically as the cover. */
function toPhotos(
  node: ApplicationNode,
): Pick<Application, "coverPhoto" | "photos"> {
  const documents = (node.documents?.edges ?? []).map((e) => e.node);
  const photos: Application["photos"] = documents
    .filter(
      (d): d is DocumentNode & { url: string } =>
        !!d &&
        d.documentType?.toLowerCase() === "photo" &&
        d.origin === "LX_STORAGE_SERVICE" &&
        !!d.url,
    )
    .map((d) => ({
      resourceId: d.id,
      resourceUri: d.url,
      alt: d.name ?? undefined,
      kind: d.name?.toUpperCase().includes("SELECTED") ? "selected" : "other",
      is360: /3D/i.test(d.name ?? ""),
    }));

  const selected = photos.find((p) => p.kind === "selected") ?? null;
  const coverPhoto = selected
    ? { id: selected.resourceId, uri: selected.resourceUri }
    : null;

  return { coverPhoto, photos };
}

/** GraphQL already reports each lifecycle phase keyed by the same names
 * (`plan`/`phaseIn`/`active`/`phaseOut`/`endOfLife`) `ApplicationLifecycle`
 * uses — no flat `lifeCycle_*` fields to reassemble. Unrecognized phase
 * values are skipped rather than breaking the build. */
const LIFECYCLE_KEYS = new Set<keyof Application["lifecycle"]>([
  "plan",
  "phaseIn",
  "active",
  "phaseOut",
  "endOfLife",
]);

function toLifecycle(node: ApplicationNode): Application["lifecycle"] {
  const lifecycle: Application["lifecycle"] = {};
  for (const { phase, startDate } of node.lifecycle?.phases ?? []) {
    if (LIFECYCLE_KEYS.has(phase as keyof Application["lifecycle"])) {
      lifecycle[phase as keyof Application["lifecycle"]] = startDate;
    }
  }
  return lifecycle;
}

export function toApplication(node: ApplicationNode): Application {
  const manager = firstRelatedFactSheet(node.relApplicationToBusinessOwnerUsers);
  const solutionArchitect = firstRelatedFactSheet(
    node.relApplicationToSolutionArchitectUsers,
  );
  const portfolio = firstRelatedFactSheet(node.relApplicationToPortfolio);

  return {
    id: node.id,
    // Falls back to the internal id if externalId is missing — should
    // already be filtered out upstream (`fetchAllApplicationNodes`), but
    // this keeps `toApplication` itself crash-proof regardless.
    externalId: node.externalId?.externalId ?? node.id,
    name: node.name,
    category: (node.appCategory as Application["category"]) ?? "notDefined",
    status: (node.appStatus as Application["status"]) ?? "NA",
    description: node.description ?? "",
    lifecycle: toLifecycle(node),
    version: node.release?.trim() || null,
    portfolio: portfolio ? { id: portfolio.id, name: portfolio.name } : null,
    operator: node.operator?.trim() || null,
    providerType: (node.providerType as Application["providerType"]) ?? "NA",
    deptProviders: node.deptProvider ?? [],
    manager: manager ? toPerson(manager) : null,
    // No GraphQL relation for delegate managers today — kept on the
    // `Application` type but always empty (the PDF export was updated to
    // stop rendering it).
    managerDelegates: [],
    solutionArchitect: solutionArchitect ? toPerson(solutionArchitect) : null,
    completion: node.completion?.percentage ?? 0,
    businessCriticality:
      (node.businessCriticality as Application["businessCriticality"]) ?? "NA",
    airbusSite: (node.airbusSite ?? []).join(", ") || null,
    // Kept alongside the joined string rather than replacing it: the
    // Identity tab renders `airbusSite` directly, and the map needs the
    // values individually to count applications per site.
    airbusSites: node.airbusSite ?? [],
    functionalSuitability: node.functionalSuitability?.trim() || null,
    technicalSuitability: node.technicalSuitability?.trim() || null,
    kpi_functionalSuitability: node.kpi_functionalSuitability ?? [],
    kpi_maintainability: node.kpi_maintainability ?? [],
    kpi_understandability: node.kpi_understandability ?? [],
    kpi_security: node.kpi_security ?? [],
    deta06ComplianceLevel: node.deta06ComplianceLevel ?? null,
    deta06MissingDocs: node.deta06MissingDocs ?? [],
    programCategory: node.programCategory?.trim() || null,
    partIS: node.partIS?.trim() || null,
    obsoRiskStatus: node.obsoRiskStatus?.trim() || null,
    BRDURL: node.BRDURL?.trim() || null,
    ARDURL: node.ARDURL?.trim() || null,
    confluenceURL: node.confluenceURL?.trim() || null,
    gDrivePath: node.gDrivePath?.trim() || null,
    ...toPhotos(node),
    linkedResources: toLinkedResources(node),
    dataObjects: mapDataObjects(node.relApplicationToDataObject),
    businessCapabilities: mapBusinessCapabilities(
      node.relApplicationToBusinessCapability,
    ),
  };
}
