/**
 * Generates a deterministic per-application SVG cover (name + a color variant
 * of the plane), used wherever an Application has no real photo (`coverPhoto
 * === null`, always true today — see integration-api-applications.md). No
 * network call: the template is embedded here, not fetched from `public/`.
 */

const SVG_TEMPLATE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 675" role="img" aria-labelledby="title desc">
  <title id="title">AERO TEST — application d'essais en vol</title>
  <desc id="desc">Identité visuelle technologique avec silhouette d'avion, trajectoires et télémétrie. Les couleurs sont modifiables dans les variables CSS.</desc>
  <style>
    .bg{fill:#061527} .panel{fill:#0b2944} .primary{fill:#18c6e8}
    .secondary{fill:#6574ff} .accent{fill:#ffb547} .text{fill:#f5fbff}
    .muted{fill:#86a8bd} .line{fill:none;stroke:#18c6e8;stroke-width:2}
    .soft-line{fill:none;stroke:#86a8bd;stroke-width:1.5;opacity:.35}
    .stroke-muted{stroke:#86a8bd} .stroke-primary{stroke:#18c6e8}
    .stop-panel{stop-color:#0b2944}.stop-bg{stop-color:#061527}
    .stop-primary{stop-color:#18c6e8}.stop-secondary{stop-color:#6574ff}
    .label{font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:700;letter-spacing:3px}
    .name{font-family:Inter,Arial,sans-serif;font-size:68px;font-weight:800;letter-spacing:5px}
    .sub{font-family:Inter,Arial,sans-serif;font-size:17px;font-weight:500;letter-spacing:4px}
  </style>

  <defs>
    <linearGradient id="panelGlow" x1="0" y1="0" x2="1" y2="1">
      <stop class="stop-panel"/>
      <stop offset="1" class="stop-bg"/>
    </linearGradient>
    <linearGradient id="wingGlow" x1="0" y1="0" x2="1" y2="0">
      <stop class="stop-primary"/>
      <stop offset="1" class="stop-secondary"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse">
      <path d="M44 0H0V44" class="soft-line" opacity=".22"/>
    </pattern>
    <clipPath id="screen"><rect x="36" y="36" width="1128" height="603" rx="38"/></clipPath>
  </defs>

  <rect width="1200" height="675" rx="48" class="bg"/>
  <rect x="36" y="36" width="1128" height="603" rx="38" fill="url(#panelGlow)" class="stroke-muted" stroke-opacity=".22"/>
  <g clip-path="url(#screen)">
    <rect x="36" y="36" width="1128" height="603" fill="url(#grid)" opacity=".35"/>
    <circle cx="600" cy="337" r="246" class="soft-line"/>
    <circle cx="600" cy="337" r="188" class="soft-line" stroke-dasharray="4 13"/>
    <path d="M-20 514C186 415 319 507 472 422S775 325 1220 430" class="line" opacity=".17"/>
    <path d="M-20 534C186 435 319 527 472 442S775 345 1220 450" class="soft-line"/>
  </g>

  <g class="label muted">
    <text x="86" y="106">FLT / 001</text><text x="1040" y="106">LIVE</text>
    <text x="86" y="586">M 0.82</text><text x="996" y="586">FL 350</text>
  </g>
  <circle cx="1020" cy="101" r="5" class="accent" filter="url(#glow)"/>
  <g class="soft-line">
    <path d="M86 130h132m-132 8h78M982 130h132m-78 8h78M86 548h84m860 0h84"/>
    <path d="M600 75v24M600 576v24M305 337h24M871 337h24"/>
  </g>

  <g transform="translate(600 270)" filter="url(#glow)">
    <path d="M0-106c10 0 16 15 18 36l4 54 132 69v20L23 40l-7 72 36 25v16L0 143l-52 10v-16l36-25-7-72-131 33V53l132-69 4-54c2-21 8-36 18-36Z" fill="url(#wingGlow)"/>
    <path d="M0-92v216" stroke="#f5fbff" stroke-width="2" opacity=".72"/>
  </g>

  <g>
    <rect x="326" y="438" width="548" height="126" rx="25" class="bg stroke-primary" opacity=".94" stroke-opacity=".55"/>
    <path d="M350 438h72M778 564h72" class="line" stroke-width="4"/>
    <text x="600" y="505" text-anchor="middle" class="name text">AERO TEST</text>
    <text x="600" y="538" text-anchor="middle" class="sub muted">FLIGHT TEST SOFTWARE</text>
  </g>

  <g transform="translate(111 242)">
    <path d="M0 0v194" class="soft-line"/><path d="M0 43h25M0 97h39M0 151h25" class="line"/>
    <circle cy="97" r="6" class="primary"/>
  </g>
  <g transform="translate(1089 242) scale(-1 1)">
    <path d="M0 0v194" class="soft-line"/><path d="M0 43h25M0 97h39M0 151h25" class="line"/>
    <circle cy="97" r="6" class="secondary"/>
  </g>
</svg>`;

const TEMPLATE_PRIMARY = "#18c6e8";
const TEMPLATE_SECONDARY = "#6574ff";

/** Curated [primary, secondary] pairs for the plane's gradient + side dots.
 * All chosen to stay legible against the template's fixed dark background. */
export const COLOR_PAIRS: readonly [string, string][] = [
  ["#18c6e8", "#6574ff"], // cyan / indigo (original)
  ["#14e0b4", "#34d399"], // teal / emerald
  ["#ffb547", "#ff7847"], // amber / orange
  ["#ff6bcb", "#a78bfa"], // magenta / violet
  ["#38bdf8", "#3b82f6"], // sky / blue
  ["#fb7185", "#f43f5e"], // rose / red
];

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Step down the name's font-size as it grows, so it keeps fitting the
 * fixed-width cartouche without wrapping. */
function fitFontSize(name: string): number {
  const len = name.length;
  if (len <= 10) return 68;
  if (len <= 14) return 54;
  if (len <= 18) return 42;
  if (len <= 24) return 34;
  return 28;
}

function truncateForCartouche(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return name.slice(0, maxChars - 1).trimEnd() + "…";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generateApplicationCoverSvg(name: string, seed: string): string {
  const [primary, secondary] = COLOR_PAIRS[hashSeed(seed) % COLOR_PAIRS.length];

  const fontSize = fitFontSize(name);
  // Beyond the font-size floor, a very long name would still overflow the
  // cartouche — truncate as a last resort.
  const displayName = fontSize === 28 ? truncateForCartouche(name, 26) : name;
  const safeName = escapeXml(displayName);

  return SVG_TEMPLATE.replace(
    /<text x="600" y="505" text-anchor="middle" class="name text">AERO TEST<\/text>/,
    `<text x="600" y="505" text-anchor="middle" class="name text" style="font-size:${fontSize}px">${safeName}</text>`,
  )
    .split(TEMPLATE_PRIMARY)
    .join(primary)
    .split(TEMPLATE_SECONDARY)
    .join(secondary);
}

export function generateApplicationCoverDataUri(name: string, seed: string): string {
  return `data:image/svg+xml,${encodeURIComponent(generateApplicationCoverSvg(name, seed))}`;
}
