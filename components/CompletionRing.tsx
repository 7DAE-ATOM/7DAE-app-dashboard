import clsx from "clsx";

/** Ring geometry, in viewBox units. The SVG scales as a whole, so stroke width
 * and type size stay proportional whatever `size` the caller asks for. */
const CENTER = 50;
const RADIUS = 42;
const STROKE = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular progress gauge: a track, an arc filled in proportion to `value`,
 * and the percentage in the middle.
 *
 * Domain-agnostic — it takes a number and a maximum, so it fits any bounded
 * measure, and the wording under the ring comes from `caption`. Colours are
 * read from the `--color-*` tokens, so light/dark needs no JavaScript.
 *
 * Laid out `inline-flex` so it shrinks to its own width: placement is the
 * caller's business, not the gauge's.
 */
export default function CompletionRing({
  value,
  max = 100,
  size = 128,
  caption,
  className,
}: {
  value: number;
  max?: number;
  /** Rendered width and height in pixels. */
  size?: number;
  /** Short label under the ring, e.g. "Completion". */
  caption?: string;
  className?: string;
}) {
  // Out-of-range data would otherwise draw an arc longer than the circle, or a
  // negative dash. Clamp once and show the clamped number, so the ring and the
  // figure never contradict each other.
  const bounded = Math.min(max, Math.max(0, value));
  const ratio = max > 0 ? bounded / max : 0;
  const percent = Math.round(ratio * 100);

  return (
    <div className={clsx("inline-flex flex-col items-center gap-1.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-label={caption ? `${caption} ${percent}%` : `${percent}%`}
        className="flex-none"
      >
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={STROKE}
        />
        {/* Skipped entirely at 0: a zero-length dash with a round cap paints a
            dot in several SVG engines, which would read as a stray pip at 12
            o'clock instead of an empty ring. */}
        {ratio > 0 && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${(CIRCUMFERENCE * ratio).toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}
        <text
          x={CENTER}
          y={CENTER}
          dy="0.32em"
          textAnchor="middle"
          fontSize={24}
          fontWeight={700}
          fill="var(--color-fg)"
        >
          {percent}%
        </text>
      </svg>
      {caption && (
        <span className="text-[10px] uppercase tracking-[0.07em] font-mono text-muted">
          {caption}
        </span>
      )}
    </div>
  );
}
