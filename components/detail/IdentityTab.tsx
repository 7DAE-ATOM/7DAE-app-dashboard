import type { Application } from "@/lib/types";
import TagIcon from "@/components/icons/TagIcon";
import MapPinIcon from "@/components/icons/MapPinIcon";
import PlaneIcon from "@/components/icons/PlaneIcon";
import ShieldIcon from "@/components/icons/ShieldIcon";
import RefreshIcon from "@/components/icons/RefreshIcon";
import StatCard from "@/components/detail/StatCard";

/**
 * Content of the Identity tab on the Application detail page: a row of
 * short attribute cards plus the application description.
 */
export default function IdentityTab({
  application,
}: {
  /** Application already fetched by the parent — no data fetching here. */
  application: Application;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Version" value={application.version} icon={<TagIcon />} />
        <StatCard
          label="Airbus Site"
          value={application.airbusSite}
          icon={<MapPinIcon />}
        />
        <StatCard
          label="Program Category"
          value={application.programCategory}
          icon={<PlaneIcon />}
        />
        <StatCard label="Part IS" value={application.partIS} icon={<ShieldIcon />} />
        <StatCard
          label="Obso Risk Status"
          value={application.obsoRiskStatus}
          icon={<RefreshIcon />}
        />
      </div>
      <div className="rounded-card border border-border bg-surface p-4 space-y-2">
        <h3 className="text-xs uppercase tracking-[0.15em] font-mono text-muted">
          Description
        </h3>
        <p className="text-sm leading-relaxed text-fg/90">
          {application.description || "—"}
        </p>
      </div>
    </div>
  );
}
