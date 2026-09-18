import type { ApplicationLinkDto } from "./atom-api";
import type { ApplicationLink, LinkDirection } from "./types";

const DIRECTIONS: LinkDirection[] = ["inbound", "outbound", "both"];

function toDirection(raw: string | null): LinkDirection {
  const value = raw?.trim().toLowerCase();
  return DIRECTIONS.find((d) => d === value) ?? "unknown";
}

/**
 * Maps the flat `/links` payload to the frontend graph model.
 *
 * No de-duplication and no inbound+outbound merging: the backend already
 * collapses multiple interfaces between the same two applications into a
 * single entry carrying `both`. If a duplicate ever shows up it is rendered
 * twice rather than hidden — surfacing a data anomaly beats masking it.
 *
 * Sorted by name so node placement is stable across reloads; the backend
 * makes no ordering guarantee.
 */
export function toApplicationLinks(
  dtos: ApplicationLinkDto[],
  selfExternalId: string,
): ApplicationLink[] {
  return dtos
    .filter((dto) => dto.application?.externalId !== selfExternalId)
    .map((dto) => ({
      id: dto.application.id,
      externalId: dto.application.externalId,
      name: dto.application.name?.trim() || dto.application.externalId,
      direction: toDirection(dto.direction),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
