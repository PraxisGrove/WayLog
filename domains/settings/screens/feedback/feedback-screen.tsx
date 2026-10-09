import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  getSettingsGlassCardStyle,
  SettingsPageShell,
} from "@/domains/settings/components/settings-page-shell";
import {
  type FeedbackContactMethod,
  type FeedbackPayload,
  feedbackContactMethodOptions,
  submitFeedback,
} from "@/features/settings";
import { getProfileGlassSurface } from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";

type StatusTone = "error" | "info" | "success";

function getToneColors(
  theme: ReturnType<typeof useAppTheme>,
  tone: StatusTone,
) {
  if (tone === "error") {
    return {
      backgroundColor: theme.colors.dangerSoft,
      borderColor: theme.colors.dangerBorder,
      textColor: theme.colors.danger,
    };
  }

  if (tone === "success") {
    return {
      backgroundColor: theme.colors.successSoft,
      borderColor: theme.colors.success,
      textColor: theme.colors.success,
    };
  }

  return {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    textColor: theme.colors.textMuted,
  };
}

function ContactMethodRadio({
  isSubmitting,
  onChange,
  selected,
  theme,
}: {
  isSubmitting: boolean;
  onChange: (value: FeedbackContactMethod | null) => void;
  selected: FeedbackContactMethod | null;
  theme: ReturnType<typeof useAppTheme>;
}) {
  return (
    <View style={styles.radioGroup}>
      {feedbackContactMethodOptions.map((option) => {
        const isSelected = selected === option;
        const optionLabel = option === "qq" ? "QQ" : option;

        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            disabled={isSubmitting}
            key={option}
            onPress={() => onChange(isSelected ? null : option)}
            style={({ pressed }) => [
              styles.radioOption,
              {
                backgroundColor: isSelected
                  ? theme.colors.primarySoft
                  : theme.colors.surfaceMuted,
                borderColor: isSelected
                  ? theme.colors.primary
                  : theme.colors.border,
              },
              pressed && { opacity: 0.72 },
            ]}
          >
            <MaterialIcons
              name={
                isSelected ? "radio-button-checked" : "radio-button-unchecked"
              }
              size={18}
              color={
                isSelected ? theme.colors.primary : theme.colors.textSubtle
              }
            />
            <Text
              style={[
                styles.radioLabel,
                {
                  color: isSelected ? theme.colors.primary : theme.colors.text,
                },
              ]}
            >
              {optionLabel}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FeedbackScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const profileGlassTone = getProfileGlassSurface(theme);

  const [description, setDescription] = useState("");
  const [contactMethod, setContactMethod] =
    useState<FeedbackContactMethod | null>(null);
  const [contactValue, setContactValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");

  const toneColors = getToneColors(theme, statusTone);
  const isDescriptionValid = description.trim().length > 0;

  const handleBack = () => {
    router.back();
  };

  const handleSubmit = async () => {
    if (!isDescriptionValid) {
      setStatusTone("error");
      setStatusMessage("请填写问题描述");
      return;
    }

    setIsSubmitting(true);
    setStatusTone("info");
    setStatusMessage("");

    const payload: FeedbackPayload = {
      contactMethod,
      contactValue,
      description: description.trim(),
    };

    const result = await submitFeedback(payload, {
      appVersion: Constants.expoConfig?.version,
      platform: Platform.OS,
    });

    if (result.ok) {
      setStatusTone("success");
      setStatusMessage("感谢反馈！我们会尽快查看并改进。");
      setDescription("");
      setContactMethod(null);
      setContactValue("");
    } else {
      setStatusTone("error");
      setStatusMessage(result.message);
    }

    setIsSubmitting(false);
  };

  return (
    <SettingsPageShell keyboardAvoiding onBack={handleBack} title="问题反馈">
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {statusMessage ? (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: toneColors.backgroundColor,
                borderColor: toneColors.borderColor,
              },
            ]}
          >
            <MaterialIcons
              name={
                statusTone === "success"
                  ? "check-circle-outline"
                  : statusTone === "error"
                    ? "error-outline"
                    : "info-outline"
              }
              size={18}
              color={toneColors.textColor}
            />
            <Text style={[styles.statusText, { color: toneColors.textColor }]}>
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.sectionCard,
            styles.profileGlassCard,
            getSettingsGlassCardStyle(profileGlassTone),
          ]}
        >
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                { backgroundColor: theme.colors.primarySoft },
              ]}
            >
              <MaterialIcons
                color={theme.colors.primary}
                name="rate-review"
                size={21}
              />
            </View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                反馈内容
              </Text>
              <Text
                style={[
                  styles.sectionSubtitle,
                  { color: theme.colors.textMuted },
                ]}
              >
                描述问题，留下可选联系方式
              </Text>
            </View>
          </View>

          <View style={styles.fieldLabelRow}>
            <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
              问题描述
            </Text>
            <Text
              style={[styles.requiredBadge, { color: theme.colors.danger }]}
            >
              必填
            </Text>
          </View>
          <TextInput
            autoCapitalize="sentences"
            editable={!isSubmitting}
            multiline
            numberOfLines={6}
            onChangeText={setDescription}
            placeholder="请描述你遇到的问题或建议…"
            placeholderTextColor={theme.colors.textSubtle}
            style={[
              styles.textArea,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              },
            ]}
            textAlignVertical="top"
            value={description}
          />

          <View
            style={[
              styles.sectionDivider,
              { backgroundColor: theme.colors.border },
            ]}
          />
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
            联系方式
            <Text style={{ color: theme.colors.textMuted }}>（选填）</Text>
          </Text>
          <ContactMethodRadio
            isSubmitting={isSubmitting}
            onChange={setContactMethod}
            selected={contactMethod}
            theme={theme}
          />

          {contactMethod ? (
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              keyboardType={
                contactMethod === "手机号"
                  ? "phone-pad"
                  : contactMethod === "邮箱"
                    ? "email-address"
                    : "default"
              }
              onChangeText={setContactValue}
              placeholder={`请输入你的${contactMethod === "qq" ? "QQ" : contactMethod}`}
              placeholderTextColor={theme.colors.textSubtle}
              style={[
                styles.input,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={contactValue}
            />
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isSubmitting}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: isSubmitting
                  ? theme.colors.primaryPressed
                  : theme.colors.primary,
              },
              pressed && { backgroundColor: theme.colors.primaryPressed },
              isSubmitting && { opacity: 0.72 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={theme.colors.onPrimary} size="small" />
            ) : (
              <MaterialIcons
                name="send"
                size={20}
                color={theme.colors.onPrimary}
              />
            )}
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.onPrimary },
              ]}
            >
              {isSubmitting ? "提交中…" : "提交反馈"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SettingsPageShell>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 144,
    gap: 14,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  profileGlassCard: {
    elevation: 3,
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 23,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  fieldLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 20,
  },
  requiredBadge: {
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "800",
  },
  fieldHint: {
    fontSize: 13,
    lineHeight: 19,
  },
  textArea: {
    minHeight: 126,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  radioGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  radioOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minHeight: 38,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 19,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 15,
  },
  sectionDivider: {
    height: 1,
    opacity: 0.72,
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
