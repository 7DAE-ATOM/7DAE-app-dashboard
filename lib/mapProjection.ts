import type { MapPanel } from "@/lib/world-map.generated";

/**
 * Places a geographic coordinate on a generated map panel.
 *
 * The panels are plain Mercator, which is the reason that projection was
 * chosen over prettier equal-area alternatives: it is closed-form, so placing
 * a marker needs six lines of arithmetic instead of shipping d3-geo to the
 * browser. Keep this the ONLY implementation of the formula — a second copy
 * inside a component would drift the day a panel's framing changes.
 */
export function projectOnPanel(
  panel: MapPanel,
  lng: number,
  lat: number,
): { x: number; y: number } {
  const { scale, translate } = panel.mercator;
  return {
    x: scale * ((lng * Math.PI) / 180) + translate[0],
    y: translate[1] - scale * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)),
  };
}

/**
 * Whether a coordinate actually falls on a panel's canvas.
 *
 * Needed because the panels overlap on purpose: a European site belongs on
 * both the world map and the inset, whereas Tianjin only exists on the world
 * map. Callers drawing the inset must skip what falls outside it, or Mercator
 * will happily return coordinates far off-canvas rather than fail.
 */
export function isOnPanel(panel: MapPanel, lng: number, lat: number): boolean {
  const { x, y } = projectOnPanel(panel, lng, lat);
  return x >= 0 && x <= panel.width && y >= 0 && y <= panel.height;
}
