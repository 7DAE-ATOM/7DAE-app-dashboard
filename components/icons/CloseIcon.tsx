import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Cross — dialog dismiss button (About dialog, Discover dialogs). */
export default function CloseIcon({ size = 16, className }: Props) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
