"use client";

import { createContext, useContext } from "react";
import type { Application } from "@/lib/types";

const EMPTY: ReadonlySet<string> = new Set();

export type ApplicationInfoContextValue = {
  /** Every application whose card is open. A **set**, not a single id: cards
   * are pinned, so opening one never closes another. Only its own cross
   * does. */
  openApplicationIds: ReadonlySet<string>;
  /** Interfaces get the same treatment (see `InterfaceInfoCard`), on their
   * own set — the two kinds share nothing but the gesture. */
  openInterfaceIds: ReadonlySet<string>;
  toggle: (id: string) => void;
  toggleInterface: (id: string) => void;
  closeApplication: (id: string) => void;
  closeInterface: (id: string) => void;
  resolveApplication: (id: string) => Application | null;
};

/** State/logic lives in `DiscoverGraph` (which cards are open) — this context
 * just makes it reachable from any `ApplicationNode` without threading it
 * through every node's `data` (which would force rebuilding every Application
 * node's data object on each open/close). */
export const ApplicationInfoContext = createContext<ApplicationInfoContextValue>({
  openApplicationIds: EMPTY,
  openInterfaceIds: EMPTY,
  toggle: () => {},
  toggleInterface: () => {},
  closeApplication: () => {},
  closeInterface: () => {},
  resolveApplication: () => null,
});

export function useApplicationInfo(): ApplicationInfoContextValue {
  return useContext(ApplicationInfoContext);
}
