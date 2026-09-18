import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Double horizontal arrow shown on hover over an Application rectangle's
 * left/right resize handle (Discover graph). */
export default function ResizeHorizontalIcon({ size = 14, className }: Props) {
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
      <path d="M8 8 4 12l4 4" />
      <path d="M16 8l4 4-4 4" />
      <path d="M4 12h16" />
    </svg>
  );
}
