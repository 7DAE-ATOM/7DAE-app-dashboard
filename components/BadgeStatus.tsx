import type { ApplicationStatus } from "@/lib/types";
import clsx from "clsx";
import StatusIcon from "./icons/StatusIcon";
import { STATUS_LABELS } from "@/lib/labels";

const colors: Record<ApplicationStatus, string> = {
  active: "bg-success/15 text-success",
  developmentPhase: "bg-accent/15 text-accent",
  planPhase: "bg-warning/15 text-warning",
  inactive: "bg-danger/15 text-danger",
  // No background: `bg-surface-2` read as a white block on the light theme,
  // and an undefined status doesn't deserve more weight than the real ones.
  NA: "text-muted",
};

export default function BadgeStatus({
  status,
  withIcon = false,
}: {
  status: ApplicationStatus;
  withIcon?: boolean;
}) {
  return (
    <span
      className={clsx(
        "badge-status inline-flex items-center px-2 py-0.5 rounded font-medium",
        colors[status]
      )}
    >
      {withIcon ? (
        <StatusIcon status={status} className="mr-1.5" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      )}
      {STATUS_LABELS[status]}
    </span>
  );
}
