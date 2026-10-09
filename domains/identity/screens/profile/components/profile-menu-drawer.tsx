import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  type CurrentAuthUser,
  getAuthIdentityMeta,
  getPrimaryAuthIdentity,
  profileMenuSections,
} from "@/features/auth";
import type { AppTheme } from "@/shared/theme/theme";
import { ModalTransition } from "@/shared/ui/modal-transition";

import type { createProfileScreenStyles } from "../styles/profile-screen.styles";

type ProfileMenuRoute =
  | "about"
  | "account"
  | "appearance"
  | "feedback"
  | "preferences"
  | "reminders";

type ProfileMenuDrawerProps = {
  onClose: () => void;
  onNavigate: (route: ProfileMenuRoute) => void;
  resolvedThemeLabel: string;
  signedInUser: CurrentAuthUser | null;
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
  visible: boolean;
};

export function ProfileMenuDrawer({
  onClose,
  onNavigate,
  resolvedThemeLabel,
  signedInUser,
  styles,
  theme,
  visible,
}: ProfileMenuDrawerProps) {
  return (
    <ModalTransition
      backdropAccessibilityLabel="关闭个人主页菜单"
      contentStyle={[
        localStyles.drawer,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
      drawerOffset={480}
      onRequestClose={onClose}
      overlayColor={theme.colors.overlay}
      preset="drawer"
      rootStyle={localStyles.overlay}
      visible={visible}
    >
      <SafeAreaView
        edges={["top", "bottom"]}
        style={localStyles.drawerSafeArea}
      >
        <View
          style={[
            localStyles.header,
            { borderBottomColor: theme.colors.border },
          ]}
        >
          <View>
            <Text style={[localStyles.title, { color: theme.colors.text }]}>
              菜单
            </Text>
            <Text
              style={[localStyles.subtitle, { color: theme.colors.textMuted }]}
            >
              账号、偏好和应用信息
            </Text>
          </View>
          <Pressable
            accessibilityLabel="关闭菜单"
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              localStyles.closeButton,
              { backgroundColor: theme.colors.surfaceMuted },
              pressed && { backgroundColor: theme.colors.surfacePressed },
            ]}
          >
            <MaterialIcons
              name="close"
              size={20}
              color={theme.colors.textMuted}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={localStyles.content}
          showsVerticalScrollIndicator={false}
        >
          {profileMenuSections.map((section) => (
            <View
              key={section.title || "main"}
              style={[
                localStyles.section,
                { borderColor: theme.colors.border },
              ]}
            >
              {section.title ? (
                <Text
                  style={[
                    styles.settingSectionTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  {section.title}
                </Text>
              ) : null}
              {section.items.map((item, index) => {
                const isAppearance = item.route === "appearance";
                const isAccount = item.route === "account";
                const isLast = index === section.items.length - 1;
                const primaryIdentity =
                  isAccount && signedInUser
                    ? getPrimaryAuthIdentity(signedInUser.identities)
                    : null;
                const identityMeta = primaryIdentity
                  ? getAuthIdentityMeta(primaryIdentity)
                  : undefined;

                return (
                  <View key={item.title}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => onNavigate(item.route)}
                      style={({ pressed }) => [
                        styles.settingListRow,
                        pressed && {
                          backgroundColor: theme.colors.surfacePressed,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.settingIcon,
                          { backgroundColor: theme.colors.primarySoft },
                        ]}
                      >
                        <MaterialIcons
                          name={item.icon}
                          size={20}
                          color={theme.colors.primary}
                        />
                      </View>
                      <View style={styles.settingCopy}>
                        <Text
                          style={[
                            styles.itemTitle,
                            { color: theme.colors.text },
                          ]}
                        >
                          {item.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.mutedText,
                            { color: theme.colors.textMuted },
                          ]}
                        >
                          {isAppearance
                            ? `当前：${resolvedThemeLabel}`
                            : identityMeta
                              ? `${identityMeta.title}：${identityMeta.description}`
                              : item.description}
                        </Text>
                      </View>
                      <MaterialIcons
                        name="chevron-right"
                        size={24}
                        color={theme.colors.textSubtle}
                      />
                    </Pressable>
                    {!isLast ? (
                      <View
                        style={[
                          styles.settingDivider,
                          { backgroundColor: theme.colors.border },
                        ]}
                      />
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ModalTransition>
  );
}

const localStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "flex-end",
  },
  drawer: {
    width: "92%",
    maxWidth: 430,
    height: "100%",
    borderWidth: 0,
    borderRightWidth: 0,
    overflow: "hidden",
  },
  drawerSafeArea: {
    flex: 1,
  },
  header: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: "600",
  },
  closeButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
  },
  content: {
    gap: 12,
    padding: 14,
    paddingBottom: 20,
  },
  section: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 0,
  },
});
