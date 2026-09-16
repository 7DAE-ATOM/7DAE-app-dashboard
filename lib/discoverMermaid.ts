/**
 * Turns a snapshot of the Discover graph into Mermaid flowchart text.
 *
 * No React, no xyflow: the exporter only knows a plain description of what is
 * on screen, so it can be read — and reasoned about — on its own.
 *
 * The output is meant to be opened in draw.io (Arrange → Insert → Advanced →
 * Mermaid), which converts it to native shapes. That conversion is why the
 * semantics live in the **shapes** rather than in `classDef` styling: a shape
 * survives it, a style rule may not.
 */

import type { DiscoverEdge } from "@/lib/types";

export type DiscoverGraphSnapshot = {
  applications: {
    id: string;
    name: string;
    externalId: string | null;
    /** A selected application (it has a chip), as opposed to one brought in
     * by exploration. Rendered with a distinct shape. */
    isRoot: boolean;
  }[];
  interfaces: {
    id: string;
    name: string | null;
    protocol: string | null;
    /** Technical id of the Application providing it. */
    providerId: string;
  }[];
  /** Always consumer Application → consumed Interface. */
  edges: DiscoverEdge[];
};

/**
 * Mermaid labels are wrapped in double quotes, so an inner quote ends the
 * label and breaks the whole diagram. `#quot;` is Mermaid's entity form for
 * it. Line breaks are folded away for the same reason — a label is one line.
 */
function label(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/"/g, "#quot;");
}

/** Same fallback chain as the tooltip on the canvas (`InterfaceNode.tsx`), so
 * the export names an interface the way the graph does. */
function interfaceLabel(iface: DiscoverGraphSnapshot["interfaces"][number]): string {
  return iface.name || iface.protocol || "Interface";
}

/**
 * Serialises `snapshot` to a Mermaid `flowchart`.
 *
 * Deterministic: the same graph always yields the same text, byte for byte,
 * which is what makes the file worth versioning next to a document.
 */
export function toMermaid(snapshot: DiscoverGraphSnapshot): string {
  // Node ids are LeanIX UUIDs — 36 characters with dashes, which Mermaid
  // would need escaping for. Handing out short sequential ids sidesteps both
  // the escaping and any collision question; traceability back to LeanIX
  // rides in the label, through the External ID.
  const alias = new Map<string, string>();
  const lines: string[] = ["flowchart LR"];

  snapshot.applications.forEach((app, i) => {
    const id = `app${i}`;
    alias.set(app.id, id);
    const text = label(app.externalId ? `${app.name} — ${app.externalId}` : app.name);
    // `[[…]]` for a selected application, `[…]` for one reached by exploring.
    lines.push(app.isRoot ? `  ${id}[["${text}"]]` : `  ${id}["${text}"]`);
  });

  snapshot.interfaces.forEach((iface, i) => {
    const id = `if${i}`;
    alias.set(iface.id, id);
    lines.push(`  ${id}(["${label(interfaceLabel(iface))}"])`);
  });

  // On the canvas an interface is a child node of its provider. Mermaid has
  // no such nesting, so the relation becomes an edge of its own, dotted and
  // labelled to keep it apart from consumption.
  for (const iface of snapshot.interfaces) {
    const provider = alias.get(iface.providerId);
    const target = alias.get(iface.id);
    if (provider && target) lines.push(`  ${provider} -. provides .-> ${target}`);
  }

  for (const edge of snapshot.edges) {
    const source = alias.get(edge.consumerId);
    const target = alias.get(edge.interfaceId);
    if (source && target) lines.push(`  ${source} --> ${target}`);
  }

  return `${lines.join("\n")}\n`;
}
