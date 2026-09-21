import clsx from "clsx";

type Props = { size?: number; className?: string };

/** A sigmoid flow carrying a train of beads — the Discover toolbar's
 * flow-animation switch (`DiscoverFlowAnimationToggle`).
 *
 * The curve is one half-period of a sine (trough on the left, crest on the
 * right), which reads as *travel with a direction* where the previous single
 * arc read as a plain link. The beads swell towards the middle and shrink
 * again at the tip: at 16px that size ramp is what says "these are moving",
 * since nothing in a static glyph can.
 */
export default function FlowAnimationIcon({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx(className)}
    >
      <path d="M2.6 17.6C3.3 17.9 4 18 4.6 18c2.9 0 5.8-2.9 8.7-6s5.8-6 8.7-6" />
      <circle cx="4.6" cy="18" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="13.3" cy="12" r="2.7" fill="currentColor" stroke="none" />
      <circle cx="17.7" cy="7.7" r="1.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
