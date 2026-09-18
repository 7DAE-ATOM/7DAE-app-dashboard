import clsx from "clsx";

export type DocLinkKind = "brd" | "ard" | "confluence" | "drive";

type Props = { kind: DocLinkKind; size?: number; className?: string };

/**
 * Pictogram for one documentation destination on the Application detail page.
 *
 * Each kind gets a shape that says what is behind the link rather than a
 * generic sheet of paper: a requirements clipboard for the BRD, stacked layers
 * for the architecture document, a book for the Confluence space, a folder for
 * the Drive path. Drawn on a 24px grid with a 1.75 stroke — slightly finer
 * than the 2 used by the small 14px icons, which reads better at 18px.
 */
export default function DocLinkIcon({ kind, size = 18, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={clsx(className)}
    >
      {kind === "brd" && (
        <>
          <rect x="8" y="2.5" width="8" height="4" rx="1.4" />
          <path d="M16 4.5h1.5A1.5 1.5 0 0 1 19 6v13.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5V6a1.5 1.5 0 0 1 1.5-1.5H8" />
          <path d="M8.5 12h7M8.5 16h4.5" />
        </>
      )}
      {kind === "ard" && (
        <>
          <path d="M12 2.5 21 7l-9 4.5L3 7Z" />
          <path d="m3 12 9 4.5L21 12" />
          <path d="m3 16.5 9 4.5 9-4.5" />
        </>
      )}
      {kind === "confluence" && (
        <>
          <path d="M6.5 2.5H20v19H6.5A2.5 2.5 0 0 1 4 19V5a2.5 2.5 0 0 1 2.5-2.5Z" />
          <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
        </>
      )}
      {kind === "drive" && (
        <path d="M2.5 7A1.5 1.5 0 0 1 4 5.5h4.4a1.5 1.5 0 0 1 1.25.67l.7 1.05a1.5 1.5 0 0 0 1.25.67H20A1.5 1.5 0 0 1 21.5 9.4v8.1A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5Z" />
      )}
    </svg>
  );
}
