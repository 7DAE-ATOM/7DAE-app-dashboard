"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme is the user's color preference, stored on `<html data-theme="…">`
 * before hydration by the inline anti-FOUC script in `app/layout.tsx`.
 *
 * The DOM — not a module variable — is the source of truth here, which is what
 * lets the very first paint already be right. Preferences that don't need that
 * go through `lib/createPersistedStore.ts` instead; see CLAUDE.md for the rule.
 *
 * Components subscribe through `useTheme()`, which uses `useSyncExternalStore`
 * + a `MutationObserver` on `data-theme`, so any write to the attribute is
 * reflected everywhere within a single tick. A write from *another tab* lands
 * through the `storage` listener below, which sets the attribute and thus goes
 * down the same path.
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

/**
 * Mirrors another tab's choice onto this document. Installed once, lazily, on
 * the first subscriber — the toggle lives in the header of every page, but a
 * page could exist without it and would still want to follow.
 *
 * Only the attribute is written: the `MutationObserver` above is what turns
 * that into a React update, so there is a single path into the UI.
 */
let crossTabInstalled = false;

function installCrossTabSync(): void {
  if (crossTabInstalled || typeof window === "undefined") return;
  crossTabInstalled = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== null && e.key !== STORAGE_KEY) return;
    const next: Theme = e.newValue === "light" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
  });
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  installCrossTabSync();
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  if (typeof document === "undefined") return "dark";
  const value = document.documentElement.getAttribute("data-theme");
  return value === "light" ? "light" : "dark";
}

function getServerSnapshot(): Theme {
  return "dark";
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setTheme(next: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", next);
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // localStorage unavailable (private mode, etc.) — session-only bascule still works
  }
}
