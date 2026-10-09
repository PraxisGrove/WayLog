import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import Constants from "expo-constants";
import { cacheDirectory } from "expo-file-system/legacy";
import { type Href, useRouter } from "expo-router";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DownloadProgressModal } from "@/domains/settings/components/download-progress-modal";
import {
  getSettingsGlassCardStyle,
  type SettingsGlassTone,
  SettingsPageShell,
} from "@/domains/settings/components/settings-page-shell";
import {
  aboutProjectCopy,
  checkPgyerAppUpdate,
  formatAboutRuntimeInfo,
  getPgyerUpdateLink,
} from "@/features/settings";
import {
  downloadApk,
  installApk,
  isNativeInstallSupported,
} from "@/features/settings/app-updater";
import { getProfileGlassSurface } from "@/shared/account/profile-visuals";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { createDiagnosticLogger } from "@/features/diagnostics";
const aboutScreenLogger = createDiagnosticLogger("about-screen");
type StatusTone = "error" | "info" | "success";

type UpdaterStatus = "done" | "downloading" | "error" | "idle" | "installing";

type InfoRowProps = {
  badge?: string;
  badgeColor?: string;
  description: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  isBusy?: boolean;
  isLast?: boolean;
  onPress?: () => void;
  status?: string;
  title: string;
};

function getToneColors(
  theme: ReturnType<typeof useAppTheme>,
  tone: StatusTone,
) {
  if (tone === "error") {
    return {
      backgroundColor: theme.colors.dangerSoft,
      borderColor: theme.colors.dangerBorder,
      iconColor: theme.colors.danger,
      textColor: theme.colors.danger,
    };
  }

  if (tone === "success") {
    return {
      backgroundColor: theme.colors.successSoft,
      borderColor: theme.colors.success,
      iconColor: theme.colors.success,
      textColor: theme.colors.success,
    };
  }

  return {
    backgroundColor: theme.colors.primarySoft,
    borderColor: theme.colors.border,
    iconColor: theme.colors.primary,
    textColor: theme.colors.textMuted,
  };
}

function SectionCard({
  children,
  title,
  tone,
}: {
  children: ReactNode;
  title: string;
  tone: SettingsGlassTone;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.sectionCard,
        styles.profileGlassCard,
        getSettingsGlassCardStyle(tone),
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
  badge,
  badgeColor,
  description,
  icon,
  isBusy,
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
        disabled={!onPress || isBusy}
        onPress={onPress}
        style={({ pressed }) => [
          styles.infoRow,
          pressed && onPress
            ? { backgroundColor: theme.colors.surfacePressed }
            : null,
          isBusy ? { opacity: 0.72 } : null,
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
          <View style={styles.rowTitleLine}>
            <Text style={[styles.rowTitle, { color: theme.colors.text }]}>
              {title}
            </Text>
            {badge ? (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: badgeColor || theme.colors.warningSoft },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    { color: badgeColor ? "#FFFFFF" : theme.colors.warning },
                  ]}
                >
                  {badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            numberOfLines={2}
            style={[styles.rowDescription, { color: theme.colors.textMuted }]}
          >
            {description}
          </Text>
        </View>
        <View style={styles.rowTrailing}>
          {isBusy ? (
            <Text style={[styles.rowStatus, { color: theme.colors.primary }]}>
              检查中…
            </Text>
          ) : status ? (
            <Text
              numberOfLines={1}
              style={[styles.rowStatus, { color: theme.colors.textMuted }]}
            >
              {status}
            </Text>
          ) : null}
          {onPress && !isBusy ? (
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

export function AboutScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("info");

  const [updaterVisible, setUpdaterVisible] = useState(false);
  const [updaterStatus, setUpdaterStatus] = useState<UpdaterStatus>("idle");
  const [updaterProgress, setUpdaterProgress] = useState(0);
  const [updaterError, setUpdaterError] = useState<string | undefined>();
  const [updaterVersionLabel, setUpdaterVersionLabel] = useState<
    string | undefined
  >();
  const downloadUrlRef = useRef<string | undefined>(undefined);

  const runtimeInfo = useMemo(
    () =>
      formatAboutRuntimeInfo({
        androidVersionCode: Constants.platform?.android?.versionCode,
        appOwnership: Constants.appOwnership,
        debugMode: Constants.debugMode,
        executionEnvironment: Constants.executionEnvironment,
        iosBuildNumber: Constants.platform?.ios?.buildNumber,
        nativeVersion: Constants.expoConfig?.version,
        platformOS: Platform.OS,
      }),
    [],
  );
  const profileGlassTone = useMemo(
    () => getProfileGlassSurface(theme),
    [theme],
  );
  const statusColors = getToneColors(theme, statusTone);

  const openPgyerUpdatePage = async () => {
    const result = getPgyerUpdateLink();

    if (!result.ok) {
      setStatusTone("error");
      setStatusMessage(result.message);
      return false;
    }

    try {
      await Linking.openURL(result.updateUrl);
      return true;
    } catch (error) {
      aboutScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to open Pgyer update page.", error] },
        "Legacy warning captured",
      );
      setStatusTone("error");
      setStatusMessage("蒲公英安装页打开失败，请稍后再试。");
      return false;
    }
  };

  const startApkDownload = useCallback(
    async (downloadUrl: string, versionLabel: string) => {
      downloadUrlRef.current = downloadUrl;
      setUpdaterVersionLabel(versionLabel);
      setUpdaterProgress(0);
      setUpdaterError(undefined);
      setUpdaterStatus("downloading");
      setUpdaterVisible(true);

      try {
        const fileUri = await downloadApk(downloadUrl, (progress) => {
          setUpdaterProgress(progress);
        });

        setUpdaterStatus("done");
        setUpdaterProgress(100);

        try {
          setUpdaterStatus("installing");
          await installApk(fileUri);
        } catch (installError) {
          aboutScreenLogger.warn(
            "legacy.warn",
            { args: ["Failed to auto-install APK.", installError] },
            "Legacy warning captured",
          );
          setUpdaterStatus("done");
        }
      } catch (error) {
        aboutScreenLogger.warn(
          "legacy.warn",
          { args: ["Failed to download APK.", error] },
          "Legacy warning captured",
        );
        setUpdaterStatus("error");
        setUpdaterError(
          error instanceof Error
            ? error.message
            : "下载失败，请检查网络连接后重试。",
        );
      }
    },
    [],
  );

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setStatusMessage("");
    setStatusTone("info");

    try {
      const result = await checkPgyerAppUpdate({
        currentBuildNumber: runtimeInfo.buildNumber,
        currentVersion: runtimeInfo.version,
      });

      if (result.hasUpdate) {
        const versionLabel = result.latestVersion
          ? `${result.latestVersion}${result.latestBuildNumber ? ` (${result.latestBuildNumber})` : ""}`
          : "";

        const directUrl = result.downloadUrl?.trim();
        const hasDirectUrl = directUrl
          ? /^https?:\/\//i.test(directUrl)
          : false;

        if (result.downloadUrlError) {
          aboutScreenLogger.warn(
            "update.direct-download-url.unavailable",
            { errorMessage: result.downloadUrlError },
            "Direct update download URL is unavailable",
          );
        }

        if (isNativeInstallSupported() && hasDirectUrl && directUrl) {
          setIsCheckingUpdate(false);
          startApkDownload(directUrl, versionLabel);
          return;
        }

        const opened = await openPgyerUpdatePage();

        if (opened) {
          setStatusTone("success");
          setStatusMessage(
            `发现新版本${versionLabel ? ` ${versionLabel}` : ""}，已打开安装页。`,
          );
        }
      } else {
        setStatusTone("success");
        setStatusMessage(
          result.latestVersion
            ? `已是最新版本（${result.latestVersion}）。`
            : "已是最新版本。",
        );
      }
    } catch (error) {
      aboutScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to check Pgyer update.", error] },
        "Legacy warning captured",
      );
      const opened = await openPgyerUpdatePage();

      if (opened) {
        setStatusTone("info");
        setStatusMessage("暂时无法自动检测版本，已打开蒲公英安装页。");
      }
    }

    setIsCheckingUpdate(false);
  };

  const handleUpdaterCancel = useCallback(() => {
    setUpdaterVisible(false);
    setTimeout(() => {
      setUpdaterStatus("idle");
      setUpdaterProgress(0);
      setUpdaterError(undefined);
    }, 300);
  }, []);

  const handleUpdaterRetry = useCallback(() => {
    if (downloadUrlRef.current) {
      startApkDownload(downloadUrlRef.current, updaterVersionLabel || "");
    }
  }, [startApkDownload, updaterVersionLabel]);

  const handleUpdaterInstall = useCallback(async () => {
    try {
      const fileUri = `${cacheDirectory}waylog-update.apk`;

      setUpdaterStatus("installing");
      await installApk(fileUri);
    } catch (error) {
      aboutScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to install APK.", error] },
        "Legacy warning captured",
      );
      setUpdaterStatus("error");
      setUpdaterError(
        "安装启动失败，请在文件管理器中找到下载的 APK 手动安装。",
      );
    }
  }, []);

  const appVersionLabel = runtimeInfo.version;

  return (
    <SettingsPageShell onBack={() => router.back()} title="关于一路记">
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.heroCard,
            styles.profileGlassCard,
            getSettingsGlassCardStyle(profileGlassTone),
          ]}
        >
          <View
            style={[
              styles.appIcon,
              { backgroundColor: theme.colors.primarySoft },
            ]}
          >
            <MaterialIcons
              name="travel-explore"
              size={36}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.appName, { color: theme.colors.text }]}>
              {aboutProjectCopy.appName}
            </Text>
            <Text
              style={[styles.appSubtitle, { color: theme.colors.textMuted }]}
            >
              {aboutProjectCopy.subtitle}
            </Text>
          </View>
          <View
            style={[
              styles.stageBadge,
              { backgroundColor: theme.colors.warningSoft },
            ]}
          >
            <Text
              style={[styles.stageBadgeText, { color: theme.colors.warning }]}
            >
              {aboutProjectCopy.stage}
            </Text>
          </View>
        </View>

        {statusMessage ? (
          <View
            style={[
              styles.statusBanner,
              {
                backgroundColor: statusColors.backgroundColor,
                borderColor: statusColors.borderColor,
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
              color={statusColors.iconColor}
            />
            <Text
              style={[styles.statusText, { color: statusColors.textColor }]}
            >
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <SectionCard title="版本信息" tone={profileGlassTone}>
          <InfoRow
            description="当前安装的应用版本"
            icon="new-releases"
            status={`${appVersionLabel}${runtimeInfo.buildNumber !== "暂无" ? ` (${runtimeInfo.buildNumber})` : ""}`}
            title="当前版本"
          />
          <InfoRow
            description="当前运行的分发或调试渠道"
            icon="inventory-2"
            status={runtimeInfo.releaseChannelLabel}
            title="发布渠道"
          />
          <InfoRow
            badge="Android 内置下载"
            badgeColor={
              Platform.OS === "android" ? theme.colors.success : undefined
            }
            description={
              Platform.OS === "android"
                ? "检测新版本并下载安装，无需跳转浏览器"
                : "检测新版本并跳转到安装页面"
            }
            icon="system-update"
            isBusy={isCheckingUpdate}
            isLast
            onPress={handleCheckUpdate}
            title="检查更新"
          />
        </SectionCard>

        <SectionCard title="法律文件" tone={profileGlassTone}>
          <InfoRow
            description="信息收集、使用和保护说明"
            icon="policy"
            onPress={() => router.push("/privacy?doc=privacy" as Href)}
            title="隐私政策"
          />
          <InfoRow
            description="服务条款、使用规范和免责声明"
            icon="description"
            onPress={() => router.push("/privacy?doc=agreement" as Href)}
            title="用户协议"
          />
          <InfoRow
            description="集成服务的数据共享详情"
            icon="share"
            isLast
            onPress={() => router.push("/privacy?doc=third-party" as Href)}
            title="第三方信息共享清单"
          />
        </SectionCard>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
            {aboutProjectCopy.copyright}
          </Text>
          <Text style={[styles.footerText, { color: theme.colors.textSubtle }]}>
            {aboutProjectCopy.thanks}
          </Text>
        </View>
      </ScrollView>

      <DownloadProgressModal
        errorMessage={updaterError}
        onCancel={handleUpdaterCancel}
        onInstall={handleUpdaterInstall}
        onRetry={handleUpdaterRetry}
        progress={updaterProgress}
        status={updaterStatus}
        versionLabel={updaterVersionLabel}
        visible={updaterVisible}
      />
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
  heroCard: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 2,
  },
  profileGlassCard: {
    elevation: 3,
    shadowOffset: { height: 14, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
  },
  appIcon: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  heroCopy: {
    alignItems: "center",
    gap: 6,
  },
  appName: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0,
    lineHeight: 30,
    textAlign: "center",
  },
  appSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  stageBadge: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  stageBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
  },
  statusBanner: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
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
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 22,
  },
  badge: {
    minHeight: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 16,
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
});
