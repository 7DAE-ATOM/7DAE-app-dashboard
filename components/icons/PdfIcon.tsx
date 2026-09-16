import clsx from "clsx";

type Props = { size?: number; className?: string };

/** Solid document marked "PDF" — the catalogue's "Export PDF" action. */
export default function PdfIcon({ size = 14, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={clsx(className)}
    >
      <path d="M14 2H7a2.5 2.5 0 0 0-2.5 2.5v15A2.5 2.5 0 0 0 7 22h10a2.5 2.5 0 0 0 2.5-2.5V7.5z" />
      <path d="M14.5 2.2V7a.5.5 0 0 0 .5.5h4.8z" opacity="0.55" />
      <text
        x="12"
        y="16.4"
        textAnchor="middle"
        fontSize="6.4"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fill="var(--color-surface)"
      >
        PDF
      </text>
    </svg>
  );
}
