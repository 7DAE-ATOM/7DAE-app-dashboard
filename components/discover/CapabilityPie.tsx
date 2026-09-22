"use client";

export type PieSlice = { id: string; name: string; color: string };

/** Past this, the slices are too thin to tell apart in a disc a few dozen
 * pixels wide; the rest is gathered into one neutral slice rather than
 * silently dropped. Lower than the flows' six dots on purpose: a pie crowds
 * far faster than a row. */
const MAX_SLICES = 4;

/** Point on the circle at `turn` (0 = twelve o'clock, 1 = full turn). */
function pointAt(turn: number, radius: number): { x: number; y: number } {
  const angle = turn * 2 * Math.PI - Math.PI / 2;
  return { x: radius + radius * Math.cos(angle), y: radius + radius * Math.sin(angle) };
}

/**
 * The capabilities an application covers, as a disc of equal slices.
 *
 * **Equal** because the pie says *which ones*, never *how much*: nothing in the
 * model weighs a capability's share of an application, and a wider slice would
 * read as "more important" on sight. It is a coloured signature, not a chart —
 * which is also why a single capability fills the whole disc rather than
 * shrinking into a marker: every application is then compared on the same
 * shape.
 *
 * Inline SVG rather than a `conic-gradient`: the image export renders the DOM
 * through a `foreignObject`, where a conic gradient is exactly the kind of
 * thing that comes back blank. Arc paths are ordinary vector drawing, and each
 * one can carry its own tooltip.
 */
export default function CapabilityPie({
  slices,
  size,
}: Readonly<{ slices: PieSlice[]; size: number }>) {
  if (slices.length === 0) return null;

  const shown = slices.slice(0, MAX_SLICES);
  const hidden = slices.slice(MAX_SLICES);
  const total = shown.length + (hidden.length > 0 ? 1 : 0);
  const r = size / 2;

  const wedges = [
    ...shown.map((s) => ({ key: s.id, color: s.color, title: s.name })),
    ...(hidden.length > 0
      ? [
          {
            key: "overflow",
            color: "var(--color-muted)",
            title: hidden.map((s) => s.name).join(", "),
          },
        ]
      : []),
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {total === 1 ? (
        // A single wedge would be an arc whose ends coincide — a degenerate
        // path that draws nothing. One capability means a full disc anyway.
        <circle cx={r} cy={r} r={r} fill={wedges[0].color}>
          <title>{wedges[0].title}</title>
        </circle>
      ) : (
        wedges.map((w, i) => {
          const from = pointAt(i / total, r);
          const to = pointAt((i + 1) / total, r);
          const largeArc = 1 / total > 0.5 ? 1 : 0;
          return (
            <path
              key={w.key}
              d={`M ${r} ${r} L ${from.x} ${from.y} A ${r} ${r} 0 ${largeArc} 1 ${to.x} ${to.y} Z`}
              fill={w.color}
              // The rectangle's own background, so neighbouring slices read as
              // two rather than as one blended shape.
              stroke="var(--color-surface)"
              strokeWidth={1}
            >
              <title>{w.title}</title>
            </path>
          );
        })
      )}
    </svg>
  );
}
