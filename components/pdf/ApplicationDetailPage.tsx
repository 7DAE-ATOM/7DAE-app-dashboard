import { Page, Text, View, Link } from "@react-pdf/renderer";
import type { Application } from "@/lib/types";
import {
  styles,
  colors,
  statusColor,
  businessCriticalityColor,
  lifecycleColor,
  avatarColor,
  initials,
} from "./styles";
import {
  PdfCategoryIcon,
  PdfPhaseInIcon,
  PdfActiveIcon,
  PdfPhaseOutIcon,
  PdfEndOfLifeIcon,
  PdfPlanIcon,
} from "./icons";
import {
  STATUS_LABELS,
  CATEGORY_LABELS,
  BUSINESS_CRITICALITY_LABELS,
  PROVIDER_TYPE_LABELS,
} from "@/lib/labels";
import { formatDate } from "@/lib/format-date";

type Props = {
  application: Application;
  baseUrl: string;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={styles.h3}>{title}</Text>
      <View style={{ marginTop: 4 }}>{children}</View>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 3 }}>
      <Text style={{ ...styles.small, width: 90 }}>{label}</Text>
      <Text style={{ ...styles.body, flex: 1 }}>{value}</Text>
    </View>
  );
}

function ManagerRow({
  name,
  email,
  roleLabel,
}: {
  name: string;
  email?: string;
  roleLabel: string;
}) {
  return (
    <View style={{ ...styles.section, marginBottom: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View
          style={{
            ...styles.avatar,
            backgroundColor: avatarColor(email ?? name),
          }}
        >
          <Text style={{ color: colors.bg, fontSize: 13, fontFamily: "Helvetica-Bold" }}>
            {initials(name)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ ...styles.body, fontFamily: "Helvetica-Bold" }}>{name}</Text>
          <Text style={styles.small}>{roleLabel}</Text>
          {email && (
            <Text style={{ ...styles.mono, color: colors.muted }}>{email}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const LIFECYCLE_STEPS = [
  {
    key: "plan",
    label: "Plan",
    Icon: PdfPlanIcon,
    reached: (d: string) => `Planned for ${d}`,
    unreached: "No plan date",
  },
  {
    key: "phaseIn",
    label: "Phase In",
    Icon: PdfPhaseInIcon,
    reached: (d: string) => `Phased in ${d}`,
    unreached: "Not yet phased in",
  },
  {
    key: "active",
    label: "Active",
    Icon: PdfActiveIcon,
    reached: (d: string) => `Active since ${d}`,
    unreached: "Not active",
  },
  {
    key: "phaseOut",
    label: "Phase Out",
    Icon: PdfPhaseOutIcon,
    reached: (d: string) => `Phase-out started ${d}`,
    unreached: "Not phased out",
  },
  {
    key: "endOfLife",
    label: "End of Life",
    Icon: PdfEndOfLifeIcon,
    reached: (d: string) => `End of life ${d}`,
    unreached: "Not end of life",
  },
] as const;

export default function ApplicationDetailPage({ application: app, baseUrl }: Props) {
  const status = STATUS_LABELS[app.status] ?? app.status;
  const statusBg = statusColor[app.status] ?? colors.muted;
  const criticalityBg = businessCriticalityColor[app.businessCriticality] ?? colors.muted;

  return (
    <Page size="A4" style={styles.page} id={`application-${app.externalId}`}>
      {/* Zone 1 — Header */}
      <View style={styles.section}>
        <Text style={styles.h1}>{app.name}</Text>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ ...styles.mono, color: colors.muted }}>
              [{app.externalId}]
            </Text>
            <Text style={{ ...styles.badge, backgroundColor: statusBg }}>
              {status}
            </Text>
          </View>
          <Text style={{ ...styles.badge, backgroundColor: criticalityBg }}>
            {BUSINESS_CRITICALITY_LABELS[app.businessCriticality]}
          </Text>
        </View>
      </View>

      {/* Zone 2 — Identity + Details / Lifecycle (two columns) */}
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 10 }}>
        <View style={{ flex: 1 }}>
          <Section title="Identity">
            <View style={styles.chipType}>
              <PdfCategoryIcon size={14} />
              <Text style={styles.chipTypeLabel}>
                {CATEGORY_LABELS[app.category] ?? app.category}
              </Text>
            </View>
          </Section>
          <Section title="Details">
            <DetailRow label="Portfolio" value={app.portfolio?.name ?? "—"} />
            <DetailRow label="Operator" value={app.operator ?? "—"} />
            <DetailRow
              label="Provider type"
              value={PROVIDER_TYPE_LABELS[app.providerType]}
            />
            <DetailRow
              label="Dept Provider"
              value={app.deptProviders.length > 0 ? app.deptProviders.join(", ") : "—"}
            />
            <DetailRow label="Version" value={app.version ?? "—"} />
            <DetailRow label="Completion" value={`${app.completion}%`} />
          </Section>
        </View>
        <View style={{ flex: 1 }}>
          {LIFECYCLE_STEPS.map((step) => {
            const raw = app.lifecycle[step.key];
            const reached = !!raw;
            const c = reached ? lifecycleColor[step.key] : colors.muted;
            return (
              <View
                key={step.key}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <step.Icon size={14} color={c} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      ...styles.body,
                      fontFamily: "Helvetica-Bold",
                      color: reached ? colors.fg : colors.muted,
                    }}
                  >
                    {step.label}
                  </Text>
                  <Text style={styles.small}>
                    {reached ? step.reached(formatDate(raw)) : step.unreached}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      {/* Zone 3 — Manager / Solution Architect */}
      <ManagerRow
        name={app.manager?.name ?? "Not set"}
        email={app.manager?.email}
        roleLabel="Application Manager"
      />
      {app.solutionArchitect && (
        <ManagerRow
          name={app.solutionArchitect.name}
          email={app.solutionArchitect.email}
          roleLabel="Solution Architect"
        />
      )}

      <Section title="Description">
        <Text style={styles.body}>{app.description || "—"}</Text>
      </Section>

      {/* Footer link */}
      <View
        style={{
          position: "absolute",
          bottom: 30,
          left: 40,
          right: 40,
          borderTopWidth: 0.5,
          borderTopColor: colors.border,
          paddingTop: 8,
        }}
        fixed
      >
        <Link
          src={`${baseUrl}/application?id=${encodeURIComponent(app.externalId)}`}
          style={{ ...styles.small, color: colors.accent }}
        >
          <Text>View on dashboard ↗</Text>
        </Link>
      </View>
    </Page>
  );
}
