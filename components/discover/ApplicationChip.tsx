import type { Application } from "@/lib/types";

type Props = {
  application: Application;
  onRemove: (id: string) => void;
  /** `compact` in the toolbar bar, `large` in the enlarged dialog. The size
   * is the only difference between the two views — markup and remove action
   * are shared so they can never drift apart. */
  size?: "compact" | "large";
};

/** One selected application in the Discover selection, with its remove
 * button. */
export default function ApplicationChip({
  application,
  onRemove,
  size = "compact",
}: Readonly<Props>) {
  const large = size === "large";
  return (
    <span
      className={`flex max-w-full items-center gap-1.5 break-words rounded-card border border-border bg-surface-2 text-fg ${
        large ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      }`}
    >
      {application.name}
      <button
        type="button"
        onClick={() => onRemove(application.id)}
        aria-label={`Remove ${application.name}`}
        className="text-muted hover:text-danger"
      >
        ✕
      </button>
    </span>
  );
}
