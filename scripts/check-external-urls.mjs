/**
 * Fails the build when the deliverable would contact a third party.
 *
 * The app ships as a static export served by nginx: the cluster makes no
 * outbound request, but the *client browser* does. So a reintroduced CDN
 * dependency WORKS, and therefore never reports itself — it only leaks
 * employee IPs to a third party and breaks on whichever desk sits behind a
 * filtering proxy. That is exactly the kind of regression a human reviewer
 * cannot be expected to catch, hence this check.
 *
 * Run with `npm run check:external-urls`, after `npm run build`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

/* ------------------------------------------------------------------ *
 * Allow-lists — deliberately TWO, because adding an entry to one does
 * not mean the same thing as adding it to the other.
 * ------------------------------------------------------------------ */

/** Hosts the browser may actually contact at runtime. Adding an entry here
 *  is a decision with privacy and availability consequences. */
const NETWORK_ALLOWED = {
  "docs.google.com":
    "lib/google-embed.ts — user documents named by backend data, deliberate exception",
  "drive.google.com": "idem — see the spec's 'Documents Google' section",
  localhost: "lib/atom-api.ts:11 dev fallback when the backend URL is unset",
  "127.0.0.1": "idem",
};

/** Strings that are never fetched: XML namespace URIs and documentation links
 *  baked into vendor error messages. Inert by nature — forbidding them would
 *  make the check cry wolf, which is how guard-rails get switched off. Each
 *  entry was confirmed by hand; confirm before adding another. */
const INERT_ALLOWED = {
  "www.w3.org": "SVG / XHTML / MathML namespace URIs",
  "nextjs.org": "Next.js error-message documentation links",
  "react.dev": "React dev-warning documentation links",
  "reactjs.org": "legacy React warning links",
  "reactflow.dev": "@xyflow/react error links",
  "www.eclipse.org": "elkjs (Eclipse Layout Kernel) header",
  "github.com": "vendor issue-tracker links inside error strings",
  "tools.ietf.org": "RFC references in @react-pdf/renderer",
  "www.aiim.org": "XMP/PDF metadata namespace (@react-pdf/renderer)",
  "ns.adobe.com": "XMP metadata namespace",
  "purl.org": "Dublin Core metadata namespace",
};

/** Overrides every allow-list: these are the regressions this lot exists to
 *  prevent. Listed by name so that a red build cannot be "fixed" by quietly
 *  appending the host above. */
const NEVER = {
  "fonts.googleapis.com": "Google Fonts is back — check app/globals.css",
  "fonts.gstatic.com": "Google Fonts is back — check app/globals.css",
  "basemaps.cartocdn.com": "CARTO basemap is back — check components/MapView.tsx",
  "api.mapbox.com": "MapLibre/Mapbox is back — check package.json",
  "events.mapbox.com": "MapLibre telemetry is back — check package.json",
};

/** The backend is environment-dependent (the Jenkinsfile picks a gateway per
 *  target), so it is derived, never hardcoded. */
const backendUrl = process.env.NEXT_PUBLIC_ATOM_API_BASE_URL;
if (backendUrl) {
  try {
    NETWORK_ALLOWED[new URL(backendUrl).hostname] =
      "backend (NEXT_PUBLIC_ATOM_API_BASE_URL)";
  } catch {
    console.warn(`! NEXT_PUBLIC_ATOM_API_BASE_URL is not a URL: ${backendUrl}`);
  }
}

/* ------------------------------------------------------------------ *
 * Scanning
 * ------------------------------------------------------------------ */

/** Skipped by extension rather than allowed by extension: an allow-list of
 *  extensions would silently stop scanning whatever Next starts emitting next.
 *  Binaries matter here — most of the w3.org/adobe/purl hits in this repo come
 *  from XMP metadata inside a PNG, not from code. */
const BINARY = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".bmp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".pdf", ".mp4", ".webm", ".zip", ".gz",
]);

/** Licence texts cite their author's site (the OFL cites scripts.sil.org).
 *  Excluding the directory is cleaner than allow-listing SIL. */
const SKIP_DIRS = new Set(["licenses"]);

/**
 * Requires either `localhost` or a host carrying at least one dot. Without
 * that, minified chunks yield `https://a` and `http://n` (fragments of Next's
 * URL feature-detection) and the very first run reports three violations that
 * are not violations — after which nobody trusts the tool again.
 */
const URL_RE = /\bhttps?:\/\/((?:localhost|(?:[a-z0-9-]+\.)+[a-z0-9-]+))/gi;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(join(dir, entry.name));
    } else if (!BINARY.has(extname(entry.name).toLowerCase())) {
      yield join(dir, entry.name);
    }
  }
}

/** An allow-list entry covers its subdomains, but only as a suffix on a dot —
 *  so an entry for `gstatic.com` could never let `fonts.gstatic.com` through
 *  by accident of substring matching. */
function matches(host, list) {
  const h = host.toLowerCase();
  for (const allowed of Object.keys(list)) {
    if (h === allowed || h.endsWith("." + allowed)) return allowed;
  }
  return null;
}

const violations = new Map(); // host -> { count, first: {file, context} }
const seen = new Map(); // host -> count

function record(map, host, value) {
  const cur = map.get(host);
  if (cur) cur.count += 1;
  else map.set(host, { count: 1, ...value });
}

let scanned = 0;
for (const file of walk(OUT)) {
  const text = readFileSync(file, "utf8");
  scanned += 1;
  for (const m of text.matchAll(URL_RE)) {
    const host = m[1].toLowerCase();
    record(seen, host, {});
    const banned = matches(host, NEVER);
    const allowed =
      !banned && (matches(host, NETWORK_ALLOWED) || matches(host, INERT_ALLOWED));
    if (allowed) continue;
    record(violations, host, {
      file: relative(ROOT, file),
      context: text.slice(Math.max(0, m.index - 30), m.index + 60).replace(/\s+/g, " "),
      reason: banned ? NEVER[banned] : null,
    });
  }
}

/* ------------------------------------------------------------------ *
 * Sources — a check on `out/` alone cannot see every regression
 * ------------------------------------------------------------------ */

/** `next/font/google` downloads from fonts.gstatic.com during `next build`
 *  and leaves NO external URL in the output. The deliverable would look
 *  clean while the build itself had become network-dependent. */
const SOURCE_DIRS = ["app", "components", "lib", "styles"];
const SOURCE_FORBIDDEN = [
  [/next\/font\/google/, "next/font/google downloads fonts during the build"],
  [/fonts\.googleapis\.com|fonts\.gstatic\.com/, "Google Fonts reference"],
  [/cartocdn|maplibre-gl|react-map-gl/, "MapLibre/CARTO reference"],
];
const sourceHits = [];
for (const dir of SOURCE_DIRS) {
  const abs = join(ROOT, dir);
  try {
    statSync(abs);
  } catch {
    continue;
  }
  for (const file of walk(abs)) {
    const text = readFileSync(file, "utf8");
    for (const [re, why] of SOURCE_FORBIDDEN) {
      if (re.test(text)) sourceHits.push({ file: relative(ROOT, file), why });
    }
  }
}

/* ------------------------------------------------------------------ *
 * Report
 * ------------------------------------------------------------------ */

console.log(`Scanned ${scanned} text files under out/`);

if (backendUrl && seen.has("localhost")) {
  console.warn(
    "! `localhost` appears in the output although NEXT_PUBLIC_ATOM_API_BASE_URL was set —\n" +
      "  the backend URL was probably not injected into this build.",
  );
}

if (violations.size === 0 && sourceHits.length === 0) {
  console.log("\nAllowed hosts actually present (prune what no longer appears):");
  for (const [host, { count }] of [...seen].sort()) {
    const group = matches(host, NETWORK_ALLOWED)
      ? "network"
      : matches(host, INERT_ALLOWED)
        ? "inert"
        : "?";
    console.log(`  ${host.padEnd(24)} ${String(count).padStart(4)}×  [${group}]`);
  }
  console.log("\nOK — no third-party dependency in the deliverable.");
  process.exit(0);
}

console.error("\nFAILED — the deliverable would contact a third party.\n");
for (const [host, v] of [...violations].sort((a, b) => b[1].count - a[1].count)) {
  console.error(`  ${host} — ${v.count} occurrence(s)`);
  if (v.reason) console.error(`    ${v.reason}`);
  console.error(`    first: ${v.file}`);
  console.error(`    …${v.context}…`);
}
for (const { file, why } of sourceHits) {
  console.error(`  ${file} — ${why}`);
}
process.exit(1);
