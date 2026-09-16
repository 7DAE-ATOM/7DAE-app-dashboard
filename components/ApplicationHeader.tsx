import type { Application } from "@/lib/types";
import ChipCategory from "./ChipCategory";
import BadgeStatus from "./BadgeStatus";
import ChipBusinessCriticality from "./ChipBusinessCriticality";
import { PICTOGRAM_SIZE } from "@/lib/pictogramSizes";
import LifecycleSection from "./detail/LifecycleSection";
import CompletionRing from "./CompletionRing";

export default function ApplicationHeader({
  application,
}: {
  application: Application;
}) {
  const m = application;
  return (
    <header className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl md:text-4xl font-bold leading-tight tracking-tight">
          {m.name}
        </h1>
        <div className="flex items-center flex-wrap gap-3">
          {m.externalId && (
            <span className="text-xs font-mono text-fg">[{m.externalId}]</span>
          )}
          <BadgeStatus status={m.status} withIcon />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipCategory category={m.category} size={PICTOGRAM_SIZE.detail} />
        <ChipBusinessCriticality
          level={m.businessCriticality}
          size={PICTOGRAM_SIZE.detail}
        />
      </div>

      <LifecycleSection lifecycle={m.lifecycle} />

      <CompletionRing value={m.completion} caption="Completion" size={52} />
    </header>
  );
}
