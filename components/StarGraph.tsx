"use client";

import { useId, useState } from "react";
import {
  layoutStar,
  type StarEdgeDirection,
  type StarNeighborInput,
  type StarNodeInput,
} from "@/lib/star-graph-layout";

export type StarNode = StarNodeInput;
export type StarNeighbor = StarNeighborInput;
export type { StarEdgeDirection };

const DIM_OPACITY = 0.3;
const CORNER_R = 8;
/** Vertical offsets of the two text lines from the box centre. */
const NAME_DY = -4;
const CODE_DY = 11;

/**
 * Generic ego-centred star graph: one hub, its neighbours on one or two
 * elliptical rings, edges arrowed according to their direction.
 *
 * Deliberately domain-agnostic — it knows nothing about applications, fetches
 * nothing and does not route. Callers hand it `{ center, neighbors }` plus a
 * `nodeHref` builder; each neighbour is then a real link opening in a new tab.
 * Colours come exclusively from the `--color-*` tokens so light/dark needs no
 * JavaScript.
 */
export default function StarGraph({
  center,
  neighbors,
  nodeHref,
  ariaLabel,
}: {
  center: StarNode;
  neighbors: StarNeighbor[];
  /**
   * Destination for a neighbour, from its `id`. Each node becomes a link
   * opening in a new tab. Omit to render a non-interactive diagram.
   */
  nodeHref?: (id: string) => string;
  ariaLabel?: string;
}) {
  const markerId = useId();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  if (neighbors.length === 0) return null;

  const layout = layoutStar(center, neighbors);
  // `useId` emits colons, which browsers refuse to parse inside `url(#…)`.
  const scope = markerId.replace(/[^a-zA-Z0-9]/g, "");
  const arrow = `star-arrow-${scope}`;
  const arrowActive = `star-arrow-active-${scope}`;

  return (
    <svg
      viewBox={layout.viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel ?? `${center.label} and its ${neighbors.length} linked nodes`}
      className="w-full h-auto"
    >
      <defs>
        {/* One definition per colour is enough: `auto-start-reverse` flips the
            same marker when it is used as `marker-start`, which is what gives
            the inbound / outbound / bidirectional cases from a single shape.
            A marker never inherits the referencing line's stroke, hence the
            second, accent-coloured copy for the highlighted edge. */}
        {[
          [arrow, "var(--color-muted)"],
          [arrowActive, "var(--color-accent)"],
        ].map(([id, fill]) => (
          <marker
            key={id}
            id={id}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill={fill} />
          </marker>
        ))}
      </defs>

      {/* Edges first, so opaque node boxes paint over any line that grazes
          them on its way to the outer ring. */}
      {layout.neighbors.map((node, index) => {
        const isActive = activeId === node.id;
        const marker = isActive ? arrowActive : arrow;
        return (
          <line
            key={`${node.id}-${index}-edge`}
            x1={node.edge.x1}
            y1={node.edge.y1}
            x2={node.edge.x2}
            y2={node.edge.y2}
            stroke={isActive ? "var(--color-accent)" : "var(--color-muted)"}
            strokeWidth={isActive ? 2 : 1.3}
            opacity={activeId !== null && !isActive ? DIM_OPACITY : 1}
            // Edges are painted before the boxes so they never cross a label,
            // which puts them outside the node group — so they carry their own
            // hover handlers to keep "hovering an edge highlights it" working.
            onMouseEnter={() => setActiveId(node.id)}
            onMouseLeave={() => setActiveId(null)}
            markerStart={
              node.direction === "in" || node.direction === "both"
                ? `url(#${marker})`
                : undefined
            }
            markerEnd={
              node.direction === "out" || node.direction === "both"
                ? `url(#${marker})`
                : undefined
            }
          />
        );
      })}

      {layout.neighbors.map((node, index) => {
        // The API is expected to de-duplicate, but the spec says a duplicate
        // must render twice rather than be hidden — so the id alone is not a
        // safe key.
        const key = `${node.id}-${index}`;
        const isActive = activeId === node.id;
        const isDimmed = activeId !== null && !isActive;

        const href = nodeHref?.(node.id);

        // A real SVG <a> rather than a role="button" group: it opens in a new
        // tab natively, and middle-click, ctrl/cmd-click and "Open link in…"
        // from the context menu all keep working without any handler.
        const Wrapper = href ? "a" : "g";

        return (
          <Wrapper
            key={key}
            {...(href
              ? { href, target: "_blank", rel: "noopener noreferrer" }
              : {})}
            opacity={isDimmed ? DIM_OPACITY : 1}
            className={href ? "cursor-pointer" : undefined}
            onMouseEnter={() => setActiveId(node.id)}
            onMouseLeave={() => setActiveId(null)}
            onFocus={() => {
              setActiveId(node.id);
              setFocusedId(node.id);
            }}
            onBlur={() => {
              setActiveId(null);
              setFocusedId(null);
            }}
          >
            <g transform={`translate(${node.x} ${node.y})`}>
              <title>{`${node.label}${node.sublabel ? ` (${node.sublabel})` : ""}`}</title>
              {/* Outline on an SVG element is unreliable across browsers, so the
                  keyboard focus ring is drawn explicitly. */}
              {focusedId === node.id && (
                <rect
                  x={-node.width / 2 - 4}
                  y={-node.height / 2 - 4}
                  width={node.width + 8}
                  height={node.height + 8}
                  rx={CORNER_R + 3}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                />
              )}
              <rect
                x={-node.width / 2}
                y={-node.height / 2}
                width={node.width}
                height={node.height}
                rx={CORNER_R}
                fill="var(--color-surface)"
                stroke={isActive ? "var(--color-accent)" : "var(--color-border)"}
                strokeWidth={isActive ? 1.8 : 1.2}
              />
              <text
                x={0}
                y={node.sublabel ? NAME_DY : 0}
                dy="0.32em"
                textAnchor="middle"
                fontSize={layout.fonts.name}
                fontWeight={600}
                fill={isActive ? "var(--color-accent)" : "var(--color-fg)"}
              >
                {node.display}
              </text>
              {node.sublabel && (
                <text
                  x={0}
                  y={CODE_DY}
                  dy="0.32em"
                  textAnchor="middle"
                  fontSize={layout.fonts.code}
                  className="font-mono"
                  fill="var(--color-muted)"
                >
                  {node.sublabel}
                </text>
              )}
            </g>
          </Wrapper>
        );
      })}

      {/* The hub is never dimmed: it is the subject of the diagram and sits at
          the end of every edge. */}
      <g transform={`translate(${layout.center.x} ${layout.center.y})`}>
        <title>{center.label}</title>
        <rect
          x={-layout.center.width / 2}
          y={-layout.center.height / 2}
          width={layout.center.width}
          height={layout.center.height}
          rx={10}
          fill="var(--color-accent)"
        />
        <text
          x={0}
          y={center.sublabel ? -5 : 0}
          dy="0.32em"
          textAnchor="middle"
          fontSize={layout.fonts.centerName}
          fontWeight={700}
          fill="var(--color-accent-fg)"
        >
          {layout.center.display}
        </text>
        {center.sublabel && (
          <text
            x={0}
            y={13}
            dy="0.32em"
            textAnchor="middle"
            fontSize={layout.fonts.centerCode}
            className="font-mono"
            fill="var(--color-accent-fg)"
            opacity={0.85}
          >
            {center.sublabel}
          </text>
        )}
      </g>
    </svg>
  );
}
