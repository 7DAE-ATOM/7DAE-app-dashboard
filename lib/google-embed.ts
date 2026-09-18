export type LinkedResourceKind = "video" | "slides" | "docs" | "sheets";

const FILE_ID_PATTERN = /\/file\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)(?:\/|$)/;

/** Extracts a Google Drive file ID from a share/view/preview URL, independent
 * of host (covers proxied domains like drive.google.com.rproxy.goskope.com),
 * of an optional /u/<n>/ account-selector segment, and of trailing suffix
 * (/view, /preview, ?usp=..., or none). */
export function extractGoogleDriveFileId(url: string): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const match = FILE_ID_PATTERN.exec(pathname);
  return match ? match[1] : null;
}

export function buildGoogleDriveEmbedUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/** Convenience: raw documentRef.url -> canonical embed URL, or null if the
 * URL isn't a recognizable Google Drive file link (caller should fall back
 * to a plain "Open" link in that case). */
export function getGoogleDriveEmbedUrl(url: string): string | null {
  const fileId = extractGoogleDriveFileId(url);
  return fileId ? buildGoogleDriveEmbedUrl(fileId) : null;
}

type DocMatcher = {
  kind: Extract<LinkedResourceKind, "slides" | "docs" | "sheets">;
  pattern: RegExp;
  embed: (id: string) => string;
};

const DOC_MATCHERS: DocMatcher[] = [
  {
    kind: "slides",
    pattern: /\/presentation\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/,
    embed: (id) => `https://docs.google.com/presentation/d/${id}/embed`,
  },
  {
    kind: "docs",
    pattern: /\/document\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/,
    embed: (id) => `https://docs.google.com/document/d/${id}/preview`,
  },
  {
    kind: "sheets",
    pattern: /\/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/,
    embed: (id) => `https://docs.google.com/spreadsheets/d/${id}/preview`,
  },
];

/** Detects a Google Docs/Slides/Sheets link purely from its URL shape —
 * independent of any backend `documentType` label, which we don't control
 * and can't rely on matching a specific convention. Returns null for
 * anything else (including plain Drive file links, handled as "video"). */
export function detectGoogleDocFromUrl(
  url: string,
): { kind: DocMatcher["kind"]; embedUrl: string } | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  for (const { kind, pattern, embed } of DOC_MATCHERS) {
    const match = pattern.exec(pathname);
    if (match) return { kind, embedUrl: embed(match[1]) };
  }
  return null;
}
