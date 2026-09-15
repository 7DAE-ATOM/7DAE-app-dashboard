"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import FilterBar, { type FilterValue } from "./FilterBar";
import type {
  ApplicationCategory,
  ApplicationStatus,
  BusinessCapabilityTree,
  BusinessCriticality,
} from "@/lib/types";

type Props = {
  categories: ApplicationCategory[];
  statuses: ApplicationStatus[];
  portfolios: string[];
  businessCriticalities: BusinessCriticality[];
  capabilityTree?: BusinessCapabilityTree | null;
  capabilityCounts?: Map<string, number>;
  capabilityResetToken?: number;
  /** Forwarded to `FilterBar` — same "ACTIONS" row as on desktop. */
  actions?: ReactNode;
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  count: number;
};

export default function FilterSheet({
  categories,
  statuses,
  portfolios,
  businessCriticalities,
  capabilityTree,
  capabilityCounts,
  capabilityResetToken,
  actions,
  value,
  onChange,
  count,
}: Props) {
  const [open, setOpen] = useState(false);
  const activeCount =
    value.categories.length +
    value.statuses.length +
    value.portfolios.length +
    value.businessCriticalities.length +
    value.businessCapabilityIds.length +
    (value.search ? 1 : 0) +
    (value.operator ? 1 : 0) +
    (value.photo !== "all" ? 1 : 0);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 lg:hidden z-30 px-5 py-3 rounded-full bg-accent text-accent-fg font-semibold shadow-2xl flex items-center gap-2"
      >
        Filters
        {activeCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-white/20 text-xs flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border rounded-t-3xl p-6 z-50 lg:hidden max-h-[85vh] overflow-y-auto"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="w-12 h-1 bg-muted/40 rounded-full mx-auto mb-4" />
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Filters</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted"
                >
                  Close
                </button>
              </div>
              <FilterBar
                categories={categories}
                statuses={statuses}
                portfolios={portfolios}
                businessCriticalities={businessCriticalities}
                capabilityTree={capabilityTree}
                capabilityCounts={capabilityCounts}
                capabilityResetToken={capabilityResetToken}
                actions={actions}
                value={value}
                onChange={onChange}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-6 w-full py-3 rounded bg-accent text-accent-fg font-semibold"
              >
                Show {count} result{count !== 1 ? "s" : ""}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
