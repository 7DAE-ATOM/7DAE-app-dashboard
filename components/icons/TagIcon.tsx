import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Tag pictogram used for the Version stat-card on the Identity tab. */
export default function TagIcon({ size = 14, className }: Props) {
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
      <path d="M20.6 12.6 12 21.2 2.8 12 2 3.2 10.8 4l8.6 8.6a2 2 0 0 1 0 2.8Z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
