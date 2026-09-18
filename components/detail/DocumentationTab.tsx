import clsx from "clsx";
import type { Application } from "@/lib/types";
import { isValidUrl } from "@/lib/url";
import DocLinkIcon, { type DocLinkKind } from "@/components/icons/DocLinkIcon";

function DocChip({
  label,
  url,
  kind,
}: {
  label: string;
  url: string | null;
  kind: DocLinkKind;
}) {
  const clickable = isValidUrl(url);
  const className = clsx(
    "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
    clickable
      ? "border-border hover:border-accent hover:text-accent"
      : "border-border opacity-50 pointer-events-none",
  );
  const content = (
    <>
      <span className={clickable ? "text-accent flex-none" : "text-muted flex-none"}>
        <DocLinkIcon kind={kind} />
      </span>
      <span className="text-[13px] font-semibold truncate">{label}</span>
    </>
  );
  return clickable ? (
    <a href={url!} target="_blank" rel="noopener noreferrer" className={className}>
      {content}
    </a>
  ) : (
    <div className={className}>{content}</div>
  );
}

/**
 * Content of the Documentation tab on the Application detail page: compact
 * chips linking to ARD/BRD/Confluence/Google Drive when available.
 */
export default function DocumentationTab({
  application,
}: {
  /** Application already fetched by the parent — no data fetching here. */
  application: Application;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      <DocChip label="ARD" url={application.ARDURL} kind="ard" />
      <DocChip label="BRD" url={application.BRDURL} kind="brd" />
      <DocChip
        label="Confluence"
        url={application.confluenceURL}
        kind="confluence"
      />
      <DocChip label="Google Drive" url={application.gDrivePath} kind="drive" />
    </div>
  );
}
