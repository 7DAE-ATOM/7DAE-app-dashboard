"use client";

import useSWR from "swr";
import { getApplicationLinks } from "@/lib/applications";
import type { ApplicationLink } from "@/lib/types";

/** SWR key for one application's interface graph. Same tuple convention as
 * `photoKey`: `null` disables the fetch entirely. */
export function applicationLinksKey(
  externalId: string,
): [string, string] | null {
  return externalId ? ["application-links", externalId] : null;
}

export type ApplicationLinksState = {
  links: ApplicationLink[] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** Re-runs the fetch — bound to the Retry button of the In Context panel. */
  retry: () => void;
};

/**
 * Loads the applications linked to `externalId`.
 *
 * Unlike the rest of the detail page, the error is *returned* rather than
 * thrown: the interface graph is a secondary concern and a `/links` failure
 * must stay confined to its panel instead of replacing the whole fiche with
 * the `app/error.tsx` screen.
 *
 * The call is lazy for free — `Tabs` only mounts the active panel, so nothing
 * is requested until the In Context tab is opened, and the global SWR cache
 * keeps it from being requested again on re-open.
 */
export function useApplicationLinks(externalId: string): ApplicationLinksState {
  const { data, error, isLoading, mutate } = useSWR(
    applicationLinksKey(externalId),
    () => getApplicationLinks(externalId),
  );

  return {
    links: data,
    isLoading,
    error: (error as Error) ?? null,
    retry: () => void mutate(),
  };
}
