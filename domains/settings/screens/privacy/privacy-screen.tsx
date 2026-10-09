import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SettingsPageShell } from "@/domains/settings/components/settings-page-shell";
import {
  LEGAL_LAST_UPDATED,
  LEGAL_POLICY_VERSION,
  type LegalSection,
  privacyPolicySections,
  thirdPartyServices,
  userAgreementSections,
} from "@/features/settings";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type DocumentType = "agreement" | "privacy" | "third-party" | null;

type InfoRowProps = {
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  isLast?: boolean;
  onPress?: () => void;
  status?: string;
  title: string;
};

function SectionCard({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <View>{children}</View>
    </View>
  );
}

function InfoRow({
  description,
  icon,
  isLast,
  onPress,
  status,
  title,
}: InfoRowProps) {
  const theme = useAppTheme();

  return (
    <View>
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.infoRow,
          pressed && onPress
            ? { backgroundColor: theme.colors.surfacePressed }
            : null,
        ]}
      >
        <View
          style={[
            styles.rowIcon,
            { backgroundColor: theme.colors.primarySoft },
          ]}
        >
          <MaterialIcons name={icon} size={23} color={theme.colors.primary} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
            {title}
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.rowDescription, { color: theme.colors.textMuted }]}
          >
            {description}
          </Text>
        </View>
        <View style={styles.rowTrailing}>
          {status ? (
            <Text
              numberOfLines={1}
              style={[styles.rowStatus, { color: theme.colors.textMuted }]}
            >
              {status}
            </Text>
          ) : null}
          {onPress ? (
            <MaterialIcons
              name="chevron-right"
              size={22}
              color={theme.colors.textSubtle}
            />
          ) : null}
        </View>
      </Pressable>
      {!isLast ? (
        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />
      ) : null}
    </View>
  );
}

function LegalDocumentContent({
  sections,
  title,
}: {
  sections: LegalSection[];
  title: string;
}) {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.documentContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.documentTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.documentDate, { color: theme.colors.textMuted }]}>
        最后更新：{LEGAL_LAST_UPDATED}
      </Text>
      {sections.map((section) => (
        <View key={section.title} style={styles.documentSection}>
          <Text
            style={[styles.documentSectionTitle, { color: theme.colors.text }]}
          >
            {section.title}
          </Text>
          {section.paragraphs.map((paragraph) => (
            <Text
              key={paragraph}
              style={[
                styles.documentParagraph,
                { color: theme.colors.textMuted },
              ]}
            >
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

function ThirdPartyServicesContent() {
  const theme = useAppTheme();

  return (
    <ScrollView
      contentContainerStyle={styles.documentContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.documentTitle, { color: theme.colors.text }]}>
        第三方信息共享清单
      </Text>
      <Text style={[styles.documentDate, { color: theme.colors.textMuted }]}>
        最后更新：{LEGAL_LAST_UPDATED}
      </Text>
      <Text
        style={[styles.documentParagraph, { color: theme.colors.textMuted }]}
      >
        本应用集成了以下第三方服务，以便为您提供完整的功能体验。下表列出了各服务的提供方、用途以及共享的数据类型。
      </Text>
      {thirdPartyServices.map((service) => (
        <View
          key={`${service.name}-${service.provider}`}
          style={[
            styles.thirdPartyCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.thirdPartyName, { color: theme.colors.text }]}>
            {service.name}
          </Text>
          <Text
            style={[
              styles.thirdPartyProvider,
              { color: theme.colors.textSubtle },
            ]}
          >
            提供方：{service.provider}
          </Text>
          <View style={styles.thirdPartyRow}>
            <Text
              style={[styles.thirdPartyLabel, { color: theme.colors.text }]}
            >
              用途：
            </Text>
            <Text
              style={[
                styles.thirdPartyValue,
                { color: theme.colors.textMuted },
              ]}
            >
              {service.purpose}
            </Text>
          </View>
          <View style={styles.thirdPartyRow}>
            <Text
              style={[styles.thirdPartyLabel, { color: theme.colors.text }]}
            >
              共享数据：
            </Text>
            <Text
              style={[
                styles.thirdPartyValue,
                { color: theme.colors.textMuted },
              ]}
            >
              {service.dataShared}
            </Text>
          </View>
          <Text
            style={[styles.thirdPartyWebsite, { color: theme.colors.primary }]}
          >
            {service.website}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

type PrivacyScreenProps = {
  doc?: string;
};

export function PrivacyScreen({ doc }: PrivacyScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();
  const [activeDocument, setActiveDocument] = useState<DocumentType>(null);

  useEffect(() => {
    if (doc === "agreement") {
      setActiveDocument("agreement");
    } else if (doc === "privacy") {
      setActiveDocument("privacy");
    } else if (doc === "third-party") {
      setActiveDocument("third-party");
    }
  }, [doc]);

  const documentTitle = useMemo(() => {
    switch (activeDocument) {
      case "agreement":
        return "用户协议";
      case "privacy":
        return "隐私政策";
      case "third-party":
        return "第三方信息共享清单";
      default:
        return "";
    }
  }, [activeDocument]);

  const handleBack = () => {
    if (activeDocument) {
      setActiveDocument(null);
    } else {
      router.back();
    }
  };

  return (
    <SettingsPageShell
      onBack={handleBack}
      title={activeDocument ? documentTitle : "隐私与合规"}
    >
      {activeDocument === "agreement" ? (
        <LegalDocumentContent
          sections={userAgreementSections}
          title="一路记 用户协议"
        />
      ) : activeDocument === "privacy" ? (
        <LegalDocumentContent
          sections={privacyPolicySections}
          title="一路记 隐私政策"
        />
      ) : activeDocument === "third-party" ? (
        <ThirdPartyServicesContent />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <SectionCard title="法律文件">
            <InfoRow
              description="服务条款、使用规范和免责声明"
              icon="description"
              onPress={() => setActiveDocument("agreement")}
              title="用户协议"
            />
            <InfoRow
              description="信息收集、使用和保护说明"
              icon="policy"
              onPress={() => setActiveDocument("privacy")}
              title="隐私政策"
            />
            <InfoRow
              description="集成服务的数据共享详情"
              icon="share"
              isLast
              onPress={() => setActiveDocument("third-party")}
              title="第三方信息共享清单"
            />
          </SectionCard>

          <View style={styles.footer}>
            <Text
              style={[styles.footerText, { color: theme.colors.textMuted }]}
            >
              政策版本：{LEGAL_POLICY_VERSION}
            </Text>
            <Text
              style={[styles.footerText, { color: theme.colors.textSubtle }]}
            >
              最后更新：{LEGAL_LAST_UPDATED}
            </Text>
          </View>
        </ScrollView>
      )}
    </SettingsPageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  sectionCard: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
  },
  sectionTitle: {
    paddingHorizontal: 18,
    paddingBottom: 4,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  infoRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  rowIcon: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  rowDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  rowTrailing: {
    maxWidth: 120,
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
  },
  rowStatus: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
    textAlign: "right",
  },
  divider: {
    height: 1,
    marginLeft: 82,
    opacity: 0.72,
  },
  footer: {
    alignItems: "center",
    gap: 4,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    textAlign: "center",
  },
  documentContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 120,
  },
  documentTitle: {
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 32,
    marginBottom: 8,
  },
  documentDate: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
  },
  documentSection: {
    marginBottom: 24,
  },
  documentSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 26,
    marginBottom: 12,
  },
  documentParagraph: {
    fontSize: 14,
    lineHeight: 24,
    marginBottom: 12,
  },
  thirdPartyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    gap: 8,
  },
  thirdPartyName: {
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 24,
  },
  thirdPartyProvider: {
    fontSize: 13,
    lineHeight: 18,
  },
  thirdPartyRow: {
    flexDirection: "row",
    gap: 4,
  },
  thirdPartyLabel: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 22,
  },
  thirdPartyValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
  },
  thirdPartyWebsite: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: 4,
  },
});
