/**
 * Short bordered card used across the detail-page tabs (Identity,
 * Accountability, …) to display a single labeled attribute.
 *
 * The optional icon sits in the top-right corner, opposite the label, as a
 * discreet muted marker rather than an accent next to the text — matching the
 * validated design prototype. A missing value falls back to a muted "—".
 */
export default function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | null;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-2">
      {/* Smaller and tighter than the repo's usual `text-xs tracking-[0.15em]`
          section heading: these labels are long ("Program Category") and sit in
          a five-column grid, so the wide tracking pushed them onto two lines. */}
      <div className="flex items-start justify-between gap-2 text-muted">
        <span className="text-[10px] uppercase tracking-[0.07em] font-mono leading-tight">
          {label}
        </span>
        {icon && <span className="flex-none">{icon}</span>}
      </div>
      <div
        className={
          value
            ? "text-[13px] font-semibold text-fg"
            : "text-[13px] font-medium text-muted"
        }
      >
        {value || "—"}
      </div>
    </div>
  );
}
