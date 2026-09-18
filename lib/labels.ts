import type {
  ApplicationCategory,
  ApplicationStatus,
  BusinessCriticality,
  ProviderType,
} from "@/lib/types";

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  active: "Active",
  developmentPhase: "Development Phase",
  inactive: "Inactive",
  planPhase: "Plan Phase",
  NA: "Not set",
};

export const CATEGORY_LABELS: Record<ApplicationCategory, string> = {
  ivbot: "IVBOT",
  END_USER_TOOL: "End User Tool",
  component: "Component",
  official: "Official",
  not1v: "Not 1V",
  notDefined: "Not Defined",
};

/**
 * One pictogram per category, served from `public/categories/`. The `Record`
 * is exhaustive on purpose: a value added to `ApplicationCategory` upstream
 * must break the build here rather than render a silent 404.
 */
export const CATEGORY_ICONS: Record<ApplicationCategory, string> = {
  ivbot: "/categories/ivbot.webp",
  END_USER_TOOL: "/categories/end-user-tool.webp",
  component: "/categories/component.webp",
  official: "/categories/official.webp",
  not1v: "/categories/not1v.webp",
  notDefined: "/categories/not-defined.webp",
};

export const BUSINESS_CRITICALITY_LABELS: Record<BusinessCriticality, string> = {
  missionCritical: "Mission Critical",
  businessCritical: "Business Critical",
  businessOperational: "Business Operational",
  administrativeService: "Administrative Service",
  NA: "Not set",
};

/**
 * One pictogram per criticality level, served from `public/criticality/`. The
 * four artworks are the same shield carrying a four-bar gauge, with as many
 * bars lit as the level is high (Mission Critical = 4 … Administrative
 * Service = 1).
 *
 * `NA` is deliberately absent from the type: an undefined criticality renders
 * nothing at all, so it has no artwork to point at.
 */
export const CRITICALITY_ICONS: Record<
  Exclude<BusinessCriticality, "NA">,
  string
> = {
  missionCritical: "/criticality/mission-critical.webp",
  businessCritical: "/criticality/business-critical.webp",
  businessOperational: "/criticality/business-operational.webp",
  administrativeService: "/criticality/administrative-service.webp",
};

export const PROVIDER_TYPE_LABELS: Record<ProviderType, string> = {
  airbus: "Airbus",
  external: "External",
  NA: "Not set",
};
