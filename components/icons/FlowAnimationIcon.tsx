import clsx from "clsx";

type Props = { size?: number; className?: string };

/** A link with two beads travelling along it — the Discover toolbar's
 * flow-animation switch (`DiscoverFlowAnimationToggle`). */
export default function FlowAnimationIcon({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx(className)}
    >
      {/* The flow itself, bowed like the graph's edges. */}
      <path d="M3 17c6 0 12-10 18-10" />
      <circle cx="8.5" cy="14.5" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="9.5" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
