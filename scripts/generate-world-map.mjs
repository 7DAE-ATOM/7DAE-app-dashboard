/**
 * Generates the offline basemap for `/map` — `lib/world-map.generated.ts`.
 *
 * Why a generator and not a runtime fetch: shipping `countries-50m.json`
 * (739 KB) to the browser would mean a network round trip, a loading state,
 * and promoting d3-geo + topojson-client into the client bundle — to compute,
 * on every page load, a projection whose framing is fixed by decision. Here
 * the browser receives path strings and draws them.
 *
 * `d3-geo`, `topojson-client` and `world-atlas` therefore stay
 * devDependencies. This script is NOT part of the build (Jenkins must never
 * depend on devDependency resolution to produce the deliverable) — run it by
 * hand with `npm run generate:map` when a frame or resolution changes, and
 * commit the result.
 *
 * TWO PANELS, and the reason matters. The sites this map will eventually carry
 * are severely clustered: Toulouse, Getafe, Filton, Hamburg and Bremen sit
 * within ~10° of each other, while Tianjin, Mirabel and Mobile are a world
 * away. No single window can hold both without either cropping the outliers or
 * crushing the European cluster into thirty pixels — which is far less than a
 * bubble sized by an application count would need. So the world panel keeps
 * the distant sites in context, and the Europe panel is the inset that gives
 * the cluster room. Each carries its own Mercator parameters, so a marker is
 * placed by arithmetic on whichever panel is being drawn.
 *
 * RESOLUTION IS PER PANEL, and the choice flips with the window — do not
 * "harmonise" it. Fidelity is a matter of pixels per degree, not of principle:
 *   - World, 110m: 5.5 px/degree, vertices 3-6 px apart. 58 KB.
 *     At 50m the same window costs 383 KB for detail invisible at this zoom.
 *   - Europe, 50m: vertices 1-2 px apart. 100 KB.
 *     At 110m the same window puts them 15-30 px apart — Brittany becomes a
 *     triangle.
 *
 * Note for anyone trying to shrink the output: rounding coordinates is not the
 * lever (~30%), and decimation buys nothing while the source is already
 * coarser than EPSILON. Real simplification (`topojson-simplify`) would be the
 * honest next step, not a bigger EPSILON.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { feature, merge, mesh } from "topojson-client";
import { geoMercator, geoPath } from "d3-geo";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Vertex decimation threshold, in canvas units: drops any point closer than
 *  this to the previously emitted one. Overridable as `EPS` so the size/quality
 *  trade-off above can be re-measured without editing the file. */
const EPSILON = Number(process.env.EPS ?? 0.5);

const PANELS = [
  {
    name: "WORLD",
    doc: "Whole world, cut at 76°N / 56°S — which drops Antarctica and the worst of Mercator's polar stretching, and yields a ratio of ~1.91, close enough to a wide screen that `meet` letterboxes only slightly.",
    resolution: "110m",
    width: 2000,
    frame: { minLng: -180, maxLng: 180, minLat: -56, maxLat: 76 },
  },
  {
    name: "EUROPE",
    doc: "Inset over the European cluster. Nearly square (~1.04), so it sits well as a panel in a corner of the world map.",
    resolution: "50m",
    width: 1200,
    frame: { minLng: -12, maxLng: 32, minLat: 35, maxLat: 62 },
  },
];

const topologies = new Map();
function loadTopology(resolution) {
  if (!topologies.has(resolution)) {
    const file = resolve(
      __dirname,
      "..",
      "node_modules",
      "world-atlas",
      `countries-${resolution}.json`,
    );
    topologies.set(resolution, JSON.parse(readFileSync(file, "utf-8")));
  }
  return topologies.get(resolution);
}

/** A d3 path context emitting a rounded, decimated path string. d3-geo's own
 *  `.digits()` only applies to its default string context, and rounding alone
 *  would not drop any vertex. */
function decimatingContext() {
  const parts = [];
  let last = null;
  let pending = null;
  const round = (n) => Math.round(n);
  return {
    toString() {
      return parts.join("");
    },
    beginPath() {
      last = null;
      pending = null;
    },
    moveTo(x, y) {
      // Flush a point held back by decimation: the last vertex of a ring must
      // survive, or the outline visibly shrinks away from its corners.
      if (pending) parts.push(`L${pending[0]},${pending[1]}`);
      pending = null;
      last = [round(x), round(y)];
      parts.push(`M${last[0]},${last[1]}`);
    },
    lineTo(x, y) {
      const p = [round(x), round(y)];
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < EPSILON) {
        pending = p;
        return;
      }
      pending = null;
      last = p;
      parts.push(`L${p[0]},${p[1]}`);
    },
    closePath() {
      if (pending) {
        parts.push(`L${pending[0]},${pending[1]}`);
        pending = null;
      }
      parts.push("Z");
      last = null;
    },
    arc() {},
  };
}

function buildPanel({ resolution, width, frame }) {
  const world = loadTopology(resolution);
  const collection = world.objects.countries;
  const features = feature(world, collection).features;

  const inFrame = ([lng, lat]) =>
    lng >= frame.minLng &&
    lng <= frame.maxLng &&
    lat >= frame.minLat &&
    lat <= frame.maxLat;

  // Keep a country if any vertex falls in the window. Countries that merely
  // straddle it (Russia, Canada) are kept here and trimmed in projected space
  // by `clipExtent` below.
  const kept = [];
  features.forEach((f, i) => {
    const g = f.geometry;
    if (!g) return;
    const polygons =
      g.type === "Polygon"
        ? [g.coordinates]
        : g.type === "MultiPolygon"
          ? g.coordinates
          : [];
    if (polygons.some((rings) => rings[0].some(inFrame))) {
      kept.push(collection.geometries[i]);
    }
  });

  // Merged land, then internal borders only. `mesh` with `(a, b) => a !== b`
  // emits each shared border exactly ONCE — per-country paths would double
  // every internal stroke and leave anti-aliasing seams where two fills meet.
  const land = merge(world, kept);
  const borders = mesh(
    world,
    { type: "GeometryCollection", geometries: kept },
    (a, b) => a !== b,
  );

  // Fit to the declared WINDOW, not to the countries that happened to pass the
  // filter — otherwise the framing would silently shift the day a resolution
  // change adds or drops an island. Computed from the projected corners rather
  // than with `fitExtent`, because d3 interpolates a polygon's edges as
  // GEODESICS: the northern edge bulges above its declared latitude and the
  // fitted canvas comes out noticeably taller than asked for. Mercator being
  // cylindrical, the corners give the exact answer.
  const projection = geoMercator().scale(1).translate([0, 0]);
  const [x0, y0] = projection([frame.minLng, frame.maxLat]);
  const [x1, y1] = projection([frame.maxLng, frame.minLat]);
  const scale = width / (x1 - x0);
  const height = Math.round((y1 - y0) * scale);
  projection.scale(scale).translate([-x0 * scale, -y0 * scale]);
  // Trims what falls outside the window in projected space — notably the
  // arctic coastlines of Russia, Canada and Greenland, which would otherwise
  // contribute a lot of path for latitudes the canvas never shows.
  projection.clipExtent([
    [0, 0],
    [width, height],
  ]);

  const toPath = (geometry) => {
    const context = decimatingContext();
    geoPath(projection, context)(geometry);
    return context.toString();
  };

  return {
    width,
    height,
    countries: kept.length,
    land: toPath(land),
    borders: toPath(borders),
    mercator: { scale: projection.scale(), translate: projection.translate() },
  };
}

const built = PANELS.map((panel) => ({ ...panel, ...buildPanel(panel) }));

const body = built
  .map(
    (p) => `/** ${p.doc}
 *  Natural Earth ${p.resolution}. */
export const ${p.name}: MapPanel = {
  width: ${p.width},
  height: ${p.height},
  land:
    ${JSON.stringify(p.land)},
  borders:
    ${JSON.stringify(p.borders)},
  mercator: { scale: ${p.mercator.scale}, translate: [${p.mercator.translate[0]}, ${p.mercator.translate[1]}] },
};`,
  )
  .join("\n\n");

const out = `// AUTO-GENERATED by scripts/generate-world-map.mjs — do not edit by hand.
// Re-run \`npm run generate:map\` after changing PANELS or EPSILON there.
//
// Natural Earth via the \`world-atlas\` package, public domain.

/** One framing of the world: its canvas, its outlines, and the Mercator
 *  parameters that place a coordinate on it. Use \`projectOnPanel\`
 *  (lib/mapProjection.ts) rather than reimplementing the formula. */
export type MapPanel = {
  readonly width: number;
  readonly height: number;
  /** Merged landmass, filled. */
  readonly land: string;
  /** Internal country borders, stroked — each shared border drawn once. */
  readonly borders: string;
  readonly mercator: {
    readonly scale: number;
    readonly translate: readonly [number, number];
  };
};

${body}
`;

const target = resolve(__dirname, "..", "lib", "world-map.generated.ts");
writeFileSync(target, out, "utf-8");

const kb = (s) => (s.length / 1024).toFixed(1);
console.log(`Wrote ${target}`);
let total = 0;
for (const p of built) {
  total += p.land.length + p.borders.length;
  console.log(
    `  ${p.name.padEnd(7)} ${p.resolution.padEnd(5)} ${p.width}x${p.height}  ` +
      `${String(p.countries).padStart(3)} countries  ` +
      `land ${kb(p.land)} KB + borders ${kb(p.borders)} KB`,
  );
}
console.log(`  total paths: ${(total / 1024).toFixed(1)} KB`);
