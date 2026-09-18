import type { Application } from "@/lib/types";
import { PROVIDER_TYPE_LABELS } from "@/lib/labels";
import StatCard from "@/components/detail/StatCard";
import ManagerCard from "@/components/ManagerCard";

/**
 * Content of the Accountability tab on the Application detail page:
 * ownership/provider attributes plus the people responsible for the app.
 */
export default function AccountabilityTab({
  application,
}: {
  /** Application already fetched by the parent — no data fetching here. */
  application: Application;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Portfolio" value={application.portfolio?.name ?? null} />
        <StatCard
          label="Dept Provider"
          value={
            application.deptProviders.length > 0
              ? application.deptProviders.join(", ")
              : null
          }
        />
        <StatCard label="Operator" value={application.operator} />
        <StatCard
          label="Provider Type"
          value={PROVIDER_TYPE_LABELS[application.providerType]}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ManagerCard
          name={application.manager?.name ?? "Not set"}
          email={application.manager?.email ?? ""}
          roleLabel="Application Manager"
        />
        {application.solutionArchitect && (
          <ManagerCard
            name={application.solutionArchitect.name}
            email={application.solutionArchitect.email}
            roleLabel="Solution Architect"
          />
        )}
      </div>
    </div>
  );
}
