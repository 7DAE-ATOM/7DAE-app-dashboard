import type { Application } from "@/lib/types";

/** One section of the tab: a title, then the linked FactSheet names as
 * pills, or its own empty state. Both sections share the exact same markup —
 * only the data and the wording differ. */
function LinkedFactSheetSection({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: { id: string; name: string }[];
  emptyLabel: string;
}) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-medium text-fg">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : (
        <ul className="flex max-h-96 flex-row flex-wrap items-start gap-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="w-fit rounded-card border border-border bg-surface px-3 py-2 text-sm text-fg"
            >
              {item.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Content of the DATA tab on the Application detail page: the Data Object
 * FactSheets linked via `relApplicationToDataObject` and the Business
 * Capabilities linked via `relApplicationToBusinessCapability` (names only —
 * no navigation, no extra attributes, per spec).
 */
export default function DataTab({
  application,
}: {
  /** Application already fetched by the parent — no data fetching here. */
  application: Application;
}) {
  return (
    <div className="flex flex-col gap-6">
      <LinkedFactSheetSection
        title="Data Objects"
        items={application.dataObjects ?? []}
        emptyLabel="Aucun Data Object associé."
      />
      <LinkedFactSheetSection
        title="Business Capabilities"
        items={application.businessCapabilities ?? []}
        emptyLabel="Aucune Business Capability associée."
      />
    </div>
  );
}
