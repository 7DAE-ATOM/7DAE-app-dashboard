import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Share/network glyph — one node on the left linked to two on the right,
 * the catalogue's "Show in Discover" action. */
export default function GraphIcon({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className={clsx(className)}
    >
      <path d="m8.6 10.6 6.8-3.8" />
      <path d="m8.6 13.4 6.8 3.8" />
      <circle cx="6" cy="12" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="5.6" r="2.6" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18.4" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
