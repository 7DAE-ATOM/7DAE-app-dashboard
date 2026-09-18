import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Generic video pictogram used for video document cards on the Application
 * detail page — no per-video thumbnail frame is available. */
export default function VideoIcon({ size = 14, className }: Props) {
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
      <rect x="2" y="6" width="13" height="12" rx="2" />
      <path d="M15 10l6-3.5v11L15 14" />
    </svg>
  );
}
