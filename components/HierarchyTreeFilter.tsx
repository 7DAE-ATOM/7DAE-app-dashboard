"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import ChevronIcon from "@/components/icons/ChevronIcon";
import type { HierarchyTree, HierarchyTreeNode } from "@/lib/types";

type Props = {
  tree: HierarchyTree;
  /** Copy is the only thing that differs between axes. */
  searchPlaceholder: string;
  emptyLabel: string;
  /** Applications each node would bring in, given the *other* active filters
   * — computed by the caller, which is the only one that knows them. */
  counts: Map<string, number>;
  /** Checked ids only. A checked parent is expanded to its descendants at
   * filtering time, not here: the UI never auto-checks children. */
  value: string[];
  onChange: (ids: string[]) => void;
};

/** Nodes matching `query`, plus every ancestor of a match so the paths stay
 * walkable. Returns `null` when there is no query — meaning "no filtering",
 * which the renderer distinguishes from "an empty result". */
function visibleNodeIds(
  tree: HierarchyTree,
  query: string,
): Set<string> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const visible = new Set<string>();
  for (const node of tree.byId.values()) {
    if (!node.name.toLowerCase().includes(q)) continue;
    visible.add(node.id);
    let parentId = node.parentId;
    while (parentId) {
      if (visible.has(parentId)) break;
      visible.add(parentId);
      parentId = tree.byId.get(parentId)?.parentId ?? null;
    }
  }
  return visible;
}

/**
 * A collapsible checkbox tree, shared by the catalogue's two hierarchical
 * axes: Business Capabilities and Data Objects. Nothing here knows which one
 * it is rendering — the tree, the counts and the copy all come from the
 * caller.
 *
 * The flat `Toggle` used by every other axis can't carry indentation, a
 * disclosure chevron or a per-node count, so this is its own component — the
 * other axes keep `Toggle` untouched.
 *
 * Expanded/collapsed state and the search text are **local**: neither is a
 * filter value, so neither belongs in `FilterValue`. Collapsing everything on
 * a filter reset is handled by the caller remounting this component.
 */
export default function HierarchyTreeFilter({
  tree,
  searchPlaceholder,
  emptyLabel,
  counts,
  value,
  onChange,
}: Readonly<Props>) {
  const [query, setQuery] = useState("");
  // Kept apart from the paths a search force-opens, so clearing the search
  // restores exactly what the user had opened.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const visible = useMemo(() => visibleNodeIds(tree, query), [tree, query]);
  const checked = useMemo(() => new Set(value), [value]);

  const toggleExpanded = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleChecked = (id: string) => {
    onChange(checked.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const renderNode = (node: HierarchyTreeNode, depth: number) => {
    if (visible && !visible.has(node.id)) return null;
    const hasChildren = node.children.length > 0;
    // While searching, matching paths are open whatever the user had folded.
    const isOpen = hasChildren && (visible !== null || expanded.has(node.id));
    const count = counts.get(node.id) ?? 0;

    return (
      <li key={node.id}>
        <div
          className="flex items-center gap-1.5 py-0.5"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleExpanded(node.id)}
              aria-expanded={isOpen}
              aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
              className="shrink-0 rounded p-0.5 text-muted hover:text-accent"
            >
              <ChevronIcon className={clsx("transition-transform", isOpen && "rotate-90")} />
            </button>
          ) : (
            // Same footprint as the chevron button, so leaf labels stay
            // aligned with their siblings'.
            <span aria-hidden className="shrink-0 p-0.5">
              <span className="block h-[14px] w-[14px]" />
            </span>
          )}
          <label className="flex min-w-0 flex-1 items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={checked.has(node.id)}
              onChange={() => toggleChecked(node.id)}
              className="shrink-0 accent-[var(--color-accent)]"
            />
            {/* The description, when the crawl carries one, is what tells two
                similarly named nodes apart. */}
            <span
              className="truncate text-xs text-fg"
              title={node.description?.trim() || node.name}
            >
              {node.name}
            </span>
            <span className="ml-auto shrink-0 text-[11px] font-mono text-muted">{count}</span>
          </label>
        </div>
        {isOpen && <ul>{node.children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  const nothingMatches = visible !== null && visible.size === 0;

  return (
    <div>
      <input
        type="search"
        placeholder={searchPlaceholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full px-2.5 py-1.5 mb-1.5 rounded-lg bg-surface-2 border border-border text-xs text-fg placeholder:text-muted focus:outline-none focus:border-accent"
      />
      {nothingMatches ? (
        <div className="py-2 text-xs text-muted">{emptyLabel}</div>
      ) : (
        <ul className="max-h-[320px] overflow-y-auto pr-1">
          {tree.roots.map((root) => renderNode(root, 0))}
        </ul>
      )}
    </div>
  );
}
