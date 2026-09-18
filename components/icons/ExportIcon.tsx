import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Tray with an arrow leaving it — the Discover "Export" menu. Stroked, not
 * filled, to sit next to the gear it shares a toolbar with. */
export default function ExportIcon({ size = 14, className }: Props) {
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
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
