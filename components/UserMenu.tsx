"use client";

/***********************************************************
 * UserMenu — The profile icon at the far right of the banner, and the
 * read-only card it opens.
 *
 *                              [👤]
 *               ┌──────────────────────┐
 *               │ Jane Doe             │
 *               │ Email                │
 *               │ jane.doe@airbus.com  │
 *               │ Department           │
 *               │ —                    │
 *               │ Company              │
 *               │ Airbus               │
 *               └──────────────────────┘
 *
 * File structure:
 *
 *   1. IMPORTS — useState, DropdownMenu, UserIcon, useCurrentUser and the
 *      AtomApiError type.
 *   2. CONSTANTS — ROWS, the three labelled lines under the name.
 *   3. FUNCTIONS — isUnauthorized(), which tells "not signed in" apart from
 *      any other failure.
 *   4. COMPONENT FUNCTIONS —
 *      a. UserMenu() — owns `open`, hands the behaviour to DropdownMenu.
 *      b. ProfileContent() — one rendering per phase: loading, ready,
 *         not signed in, error.
 *
 * Same menu as 7DAE-atom-cockpit (`components/profile/ProfileMenu.tsx`):
 * identical look, copy and behaviour in every ATOM application. Only the
 * data source differs — here the SWR hook `useCurrentUser()`, over
 * `fetchCurrentUser()` in lib/atom-api.ts.
 *
 * This file owns the CONTENT only. Opening, closing, Escape, outside
 * clicks, focus return and route changes all belong to the DropdownMenu
 * primitive (components/ui/DropdownMenu.tsx).
 *
 * The icon is GENERIC and never changes when the identity arrives, so the
 * banner does not shift. A missing field shows "—": a dash says "there is
 * nothing", an omitted row makes the user wonder whether it was forgotten.
 * Labels sit ABOVE their values — an email is the longest line of the card,
 * and a side-by-side label column would steal the width it needs.
 *
 * Used on: components/Header.tsx
 ***********************************************************/

import { useState } from "react";

import UserIcon from "@/components/icons/UserIcon";
import DropdownMenu from "@/components/ui/DropdownMenu";
import type { AtomApiError, CurrentUserDto } from "@/lib/atom-api";
import { useCurrentUser, type CurrentUserState } from "@/lib/useCurrentUser";

/***********************************************************
 * Constants
 ***********************************************************/

const ROWS: { label: string; field: "email" | "department" | "company" }[] = [
  { label: "Email", field: "email" },
  { label: "Department", field: "department" },
  { label: "Company", field: "company" },
];

/***********************************************************
 * Functions
 ***********************************************************/

/** 401/403 — the remedy is to sign in again, not to retry later. */
function isUnauthorized(error: Error): boolean {
  const status = (error as Partial<AtomApiError>).status;
  return (
    status === 401 ||
    status === 403 ||
    error.message.startsWith("ATOM_UNAUTHORIZED")
  );
}

/** A string with content, or null. */
function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/***********************************************************
 * UserMenu
 ***********************************************************/

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const state = useCurrentUser();

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => setOpen(next)}
      label="User profile"
      icon={<UserIcon />}
      align="end"
    >
      <ProfileContent state={state} />
    </DropdownMenu>
  );
}

/***********************************************************
 * ProfileContent — one rendering per phase
 ***********************************************************/

function ProfileContent({ state }: { state: CurrentUserState }) {
  if (state.isLoading) {
    return <p className="px-4 py-3 text-sm text-muted">Loading your profile…</p>;
  }

  const user: CurrentUserDto | null = state.user;
  const usable = user && (text(user.displayName) || text(user.email));

  if (state.error || !usable) {
    return (
      <p className="px-4 py-3 text-sm text-muted">
        {state.error && isUnauthorized(state.error)
          ? "You are not signed in. Reload the page to sign in again."
          : "Your profile could not be loaded."}
      </p>
    );
  }

  return (
    <div className="px-4 py-3">
      <p className="text-base font-semibold text-fg">{text(user.displayName) ?? "—"}</p>
      <dl className="mt-3 flex flex-col gap-3 text-sm">
        {ROWS.map((row) => (
          <div key={row.field}>
            <dt className="text-xs text-muted">{row.label}</dt>
            <dd className="mt-0.5 min-w-0 break-words text-fg select-text">
              {text(user[row.field]) ?? "—"}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
