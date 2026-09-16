"use client";

import { createContext, useContext } from "react";
import type { Application } from "@/lib/types";

export type ApplicationInfoContextValue = {
  openApplicationId: string | null;
  /** Interfaces get the same treatment (see `InterfaceInfoCard`). The two ids
   * are derived from a single piece of state in `DiscoverGraph`, so at most
   * one card is ever open. */
  openInterfaceId: string | null;
  toggle: (id: string) => void;
  toggleInterface: (id: string) => void;
  close: () => void;
  resolveApplication: (id: string) => Application | null;
};

/** State/logic lives in `DiscoverGraph` (which app id's card is open, if
 * any) — this context just makes it reachable from any `ApplicationNode`
 * without threading it through every node's `data` (which would force
 * rebuilding every Application node's data object on each open/close). */
export const ApplicationInfoContext = createContext<ApplicationInfoContextValue>({
  openApplicationId: null,
  openInterfaceId: null,
  toggle: () => {},
  toggleInterface: () => {},
  close: () => {},
  resolveApplication: () => null,
});

export function useApplicationInfo(): ApplicationInfoContextValue {
  return useContext(ApplicationInfoContext);
}
