import clsx from "clsx";

type Props = { size?: number; className?: string };

/** "i" in a circle — Application identity card trigger (Discover graph). */
export default function InfoIcon({ size = 14, className }: Props) {
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
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <circle cx="12" cy="8" r="0.1" fill="currentColor" stroke="currentColor" strokeWidth={2.5} />
    </svg>
  );
}
