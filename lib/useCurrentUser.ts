"use client";

import useSWR from "swr";
import { fetchCurrentUser, type CurrentUserDto } from "@/lib/atom-api";

/** SWR key for the current user's identity. */
export const SWR_KEY_CURRENT_USER = "current-user";

export type CurrentUserState = {
  user: CurrentUserDto | null;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Loads the identity (login, email, names…) of the user viewing the page.
 *
 * The SPA never sees the JWT itself — the AFTER gateway injects it on the
 * request to the backend — so the backend decodes it and returns the claims
 * through `GET /api/infos/me`.
 *
 * The error is **returned, never thrown** — same reasoning as
 * `useApplicationLinks`: who is logged in is cosmetic, and a failure must not
 * replace the page with the `app/error.tsx` screen. In dev without
 * `NEXT_PUBLIC_DEV_JWT` the call answers 401, so `user` simply stays `null`.
 *
 * The identity cannot change while the page is open, so revalidation is off:
 * one request per page load, shared by every caller through the SWR cache.
 *
 * Personal data: it lives in the SWR memory cache only — never written to
 * localStorage / sessionStorage, never logged.
 */
export function useCurrentUser(): CurrentUserState {
  const { data, error, isLoading } = useSWR(SWR_KEY_CURRENT_USER, fetchCurrentUser, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
  });

  return {
    user: data ?? null,
    isLoading,
    error: (error as Error) ?? null,
  };
}
