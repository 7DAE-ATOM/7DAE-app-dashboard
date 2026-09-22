"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the user asked the system to keep motion to a minimum.
 *
 * Read in JavaScript rather than through a plain `@media
 * (prefers-reduced-motion: reduce)` rule because the two produce different
 * results here: cutting the animation in CSS would leave a data-object dot
 * wherever its keyframes start — pinned against a node — whereas what the
 * preference asks for is the ordinary, still rendering, dots back at the
 * middle of their flow. That is a choice between two renderings, so it has to
 * be made where the rendering is decided.
 *
 * Same shape as `lib/useTheme.ts`: an external source of truth (here the media
 * query rather than the DOM), subscribed through `useSyncExternalStore`, with
 * a constant server snapshot so the first paint agrees with the server.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getSnapshot(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

/** No motion preference is known server-side; assuming "motion allowed" keeps
 * the markup identical to the common case. */
function getServerSnapshot(): boolean {
  return false;
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
