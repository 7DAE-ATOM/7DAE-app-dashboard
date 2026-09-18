import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Paper-plane pictogram used for the Program Category stat-card on the
 * Identity tab. */
export default function PlaneIcon({ size = 14, className }: Props) {
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
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}
