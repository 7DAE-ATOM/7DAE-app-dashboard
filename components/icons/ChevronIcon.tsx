import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Right-pointing chevron — disclosure control of the Business Capabilities
 * tree filter. Callers rotate it (e.g. `rotate-90`) to signal the expanded
 * state rather than swapping for a second icon. */
export default function ChevronIcon({ size = 14, className }: Props) {
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
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
