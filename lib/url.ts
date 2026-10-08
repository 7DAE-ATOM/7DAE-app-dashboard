/** Whether `value` is a non-empty, well-formed URL — used to decide whether
 * a document link should render as clickable or as plain/disabled text. */
export function isValidUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_HREF ?? "";

/** URL of an application's detail page, **for a plain `<a href>`** or a link
 * written into an export — anything `next/link` does not build. `next/link`
 * prefixes the gateway context (`/atom-app-dashboard`, val and prod builds)
 * on its own; a raw anchor does not, and its bare `/application?id=…` lands
 * outside the app. So never pass this to `next/link`: the prefix would be
 * doubled. Empty prefix in dev. Trailing slash per `trailingSlash: true`, so
 * nginx serves the page instead of answering with a redirect first. */
export function applicationHref(externalId: string): string {
  return `${BASE_PATH}/application/?id=${encodeURIComponent(externalId)}`;
}
