/**
 * Turns the Discover canvas into a PNG or an SVG.
 *
 * Unlike `lib/discoverMermaid.ts`, which rebuilds the diagram from the model,
 * this captures what the browser actually renders. Everything that shapes the
 * display — Simple/Complex mode, the card display toggles, the theme, the
 * active highlight — is therefore honoured without a line of code for it.
 *
 * The caller hands over a DOM element and the logical extent to frame; this
 * module knows nothing about React Flow.
 */

/** Raised when the PNG would exceed what a browser canvas can hold. Its own
 * class so the caller can say something useful instead of "export failed". */
export class ImageExportTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageExportTooLargeError";
  }
}

export type CaptureBounds = { x: number; y: number; width: number; height: number };

/** Logical pixels of breathing room around the diagram, so nothing touches
 * the edge of the image. */
const PADDING = 32;

/** Output pixels per logical pixel. What has to stay constant across graph
 * sizes is the scale applied to *text* — a 14px card name always lands at
 * 28px — not the file's dimensions. Aiming for a fixed output width instead
 * would keep the dimensions and let legibility collapse on large graphs. */
const PIXEL_RATIO = 2;

/** Browsers cap both a canvas' side and its total area; past either, the
 * canvas comes back blank instead of throwing. Chrome's practical ceiling. */
const MAX_CANVAS_SIDE = 16384;
const MAX_CANVAS_AREA = MAX_CANVAS_SIDE * MAX_CANVAS_SIDE;

/** Node chrome opts out of the capture by carrying this attribute — resize
 * handles, the info button. Marking the element beats guessing a selector
 * from here, and the next affordance only has to set it. */
const EXCLUDE_ATTRIBUTE = "data-export-hide";

/** `html-to-image` **keeps** a node when this returns true — it is an
 * inclusion filter, not an exclusion one. */
function shouldInclude(node: HTMLElement): boolean {
  // The filter also visits SVG elements (the edges), which have no `dataset`
  // in the same sense — `getAttribute` works on both.
  return typeof node.getAttribute !== "function" || node.getAttribute(EXCLUDE_ATTRIBUTE) === null;
}

/**
 * Renders `viewport` framed on `bounds`.
 *
 * The transform is applied to the **clone** the library builds, never to the
 * live element: the on-screen zoom and pan are left exactly as they were.
 */
export async function captureViewport(
  viewport: HTMLElement,
  bounds: CaptureBounds,
  format: "png" | "svg",
): Promise<Blob> {
  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);

  if (format === "png") {
    const outWidth = width * PIXEL_RATIO;
    const outHeight = height * PIXEL_RATIO;
    if (
      outWidth > MAX_CANVAS_SIDE ||
      outHeight > MAX_CANVAS_SIDE ||
      outWidth * outHeight > MAX_CANVAS_AREA
    ) {
      // Refused rather than quietly downscaled: at this size no PNG would be
      // readable anyway, and a silent downscale would look like a success.
      throw new ImageExportTooLargeError(
        "This diagram is too large for a PNG. Export it as SVG or Mermaid instead.",
      );
    }
  }

  const options = {
    width,
    height,
    // No `backgroundColor`: that is what leaves the PNG transparent.
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${PADDING - bounds.x}px, ${PADDING - bounds.y}px)`,
    },
    filter: shouldInclude,
    // Without this, the library fetches the font stylesheets to inline them —
    // a network call to Google Fonts at export time, which this export must
    // never make. Text keeps the named font stack instead.
    skipFonts: true,
  } as const;

  // Imported here, not at module scope: this is what keeps the capture
  // toolkit out of /discover's initial bundle.
  const htmlToImage = await import("html-to-image");

  if (format === "svg") {
    const dataUrl = await htmlToImage.toSvg(viewport, options);
    return new Blob([decodeURIComponent(dataUrl.split(",")[1] ?? "")], {
      type: "image/svg+xml;charset=utf-8",
    });
  }

  return htmlToImage.toBlob(viewport, { ...options, pixelRatio: PIXEL_RATIO }).then((blob) => {
    if (!blob) throw new Error("The browser returned an empty image.");
    return blob;
  });
}

/** Overlays that must fit inside the frame instead of being cropped by it —
 * the open detail cards. They are positioned relative to their node and can
 * be dragged anywhere, so their extent can't be derived from the node boxes
 * and has to be measured on the live DOM. */
const EXTEND_ATTRIBUTE = "data-export-extend";

/**
 * Where the frame-extending overlays sit, in graph coordinates.
 *
 * `viewport` carries React Flow's `translate(…) scale(zoom)` with a `0 0`
 * origin, so its own client rect marks where graph origin `(0, 0)` lands on
 * screen; dividing by `zoom` undoes the rest.
 */
export function overlayBoxes(viewport: HTMLElement, zoom: number): CaptureBounds[] {
  if (zoom <= 0) return [];
  const origin = viewport.getBoundingClientRect();
  return Array.from(
    viewport.querySelectorAll<HTMLElement>(`[${EXTEND_ATTRIBUTE}]`),
  ).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      x: (r.left - origin.left) / zoom,
      y: (r.top - origin.top) / zoom,
      width: r.width / zoom,
      height: r.height / zoom,
    };
  });
}

/** Bounding box of a set of already-absolute boxes, or `null` when empty. */
export function boundsOf(
  boxes: { x: number; y: number; width: number; height: number }[],
): CaptureBounds | null {
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
