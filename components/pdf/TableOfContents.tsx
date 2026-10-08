import { Page, Text, View, Link } from "@react-pdf/renderer";
import type { Application } from "@/lib/types";
import { applicationHref } from "@/lib/url";
import { styles, colors } from "./styles";

type Props = {
  applications: Application[];
  baseUrl: string;
};

export default function TableOfContents({ applications, baseUrl }: Props) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.h1}>Contents</Text>
      <Text style={{ ...styles.small, marginTop: 4 }}>
        Click a row to jump to its detail page. Click ↗ to open in the
        dashboard.
      </Text>
      <View style={styles.divider} />

      <View>
        {applications.map((a, i) => (
          <View
            key={a.externalId}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 5,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
            }}
            wrap={false}
          >
            <Text
              style={{ ...styles.small, width: 28, color: colors.muted }}
            >
              {i + 1}.
            </Text>
            <View style={{ flex: 1 }}>
              <Link src={`#application-${a.externalId}`} style={styles.link}>
                <Text style={{ ...styles.body, color: colors.accent }}>
                  {a.name}
                </Text>
              </Link>
            </View>
            <Text
              style={{
                ...styles.mono,
                width: 130,
                color: colors.muted,
              }}
            >
              {a.externalId}
            </Text>
            <Link
              src={`${baseUrl}${applicationHref(a.externalId)}`}
              style={{ width: 18, textAlign: "right" }}
            >
              <Text style={{ ...styles.small, color: colors.accent }}>↗</Text>
            </Link>
          </View>
        ))}
      </View>
    </Page>
  );
}
