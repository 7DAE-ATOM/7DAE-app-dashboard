import clsx from "clsx";
import type { LinkedResourceKind } from "@/lib/types";

type Props = {
  kind: Exclude<LinkedResourceKind, "video">;
  size?: number;
  className?: string;
};

const COLOR_CLASS: Record<Props["kind"], string> = {
  slides: "text-warning",
  docs: "text-accent",
  sheets: "text-success",
};

/** Generic document pictogram for Google Slides/Docs/Sheets links — colored
 * by kind, no per-document thumbnail available. */
export default function DocKindIcon({ kind, size = 14, className }: Props) {
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
      className={clsx(className ?? COLOR_CLASS[kind])}
    >
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="8" x2="16" y2="8" />
      <line x1="8" y1="12" x2="16" y2="12" />
      <line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  );
}
