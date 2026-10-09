import { requestSupabase } from "../auth/supabase";

export type AboutRuntimeInfoInput = {
  androidVersionCode?: number | string | null;
  appOwnership?: string | null;
  debugMode?: boolean | null;
  executionEnvironment?: string | null;
  iosBuildNumber?: string | null;
  nativeVersion?: string | null;
  platformOS?: string | null;
};

export type AboutRuntimeInfo = {
  buildNumber: string;
  executionLabel: string;
  platformLabel: string;
  releaseChannelLabel: string;
  version: string;
};

export type AboutPgyerUpdateLinkResult =
  | {
      ok: true;
      updateUrl: string;
    }
  | {
      message: string;
      ok: false;
    };

export type AboutPgyerPublishedVersion = {
  buildHaveNewVersion?: boolean | null;
  buildUpdateDescription?: string | null;
  buildVersion?: string | number | null;
  buildVersionNo?: string | number | null;
  publishedAt?: string | null;
  updateUrl?: string | null;
};

export type AboutPgyerUpdateStatus = {
  downloadUrl?: string;
  hasUpdate: boolean;
  latestBuildNumber?: string;
  latestVersion?: string;
  releaseNotes?: string;
  updateUrl: string;
};

export type AboutPgyerUpdateCheckResponse = {
  downloadUrl?: string;
  downloadUrlError?: string;
  hasUpdate: boolean;
  latestBuildNumber?: string;
  latestVersion?: string;
  ok: true;
  releaseNotes?: string;
  updateUrl: string;
};

const defaultAppVersion = "1.0.0";
const pgyerHomeUrl = "https://www.pgyer.com";
const publicReleasesUrl = "https://github.com/PraxisGrove/WayLog/releases";

export const aboutProjectCopy = {
  appName: "一路记 WayLog",
  copyright: "一路记 WayLog © 2026",
  stage: "MVP 迭代中",
  subtitle: "个人旅行助手 · 旅行控制台 + 旅行手账",
  thanks: "感谢你参与早期版本体验",
} as const;

export const waylogDistributionConfig = {
  get pgyerAppUrl() {
    const configuredUrl =
      process.env.EXPO_PUBLIC_APP_DOWNLOAD_URL?.trim() ?? "";
    return /^https?:\/\//i.test(configuredUrl)
      ? configuredUrl
      : publicReleasesUrl;
  },
  pgyerHomeUrl,
} as const;

export function normalizePgyerAppUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? "";

  if (!trimmed || trimmed === "?") {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `${pgyerHomeUrl}/${trimmed.replace(/^\/+/, "")}`;
}

export function formatAboutRuntimeInfo(
  input: AboutRuntimeInfoInput,
): AboutRuntimeInfo {
  const version = input.nativeVersion?.trim() || defaultAppVersion;
  const buildNumber =
    String(input.androidVersionCode ?? input.iosBuildNumber ?? "").trim() ||
    "暂无";

  return {
    buildNumber,
    executionLabel: getExecutionLabel(input.executionEnvironment),
    platformLabel: getPlatformLabel(input.platformOS),
    releaseChannelLabel: getReleaseChannelLabel(input),
    version,
  };
}

export function getPgyerUpdateLink(
  value: string | null | undefined = waylogDistributionConfig.pgyerAppUrl,
): AboutPgyerUpdateLinkResult {
  const updateUrl = normalizePgyerAppUrl(value);

  if (updateUrl) {
    return {
      ok: true,
      updateUrl,
    };
  }

  return {
    message: "蒲公英更新链接不可用，请稍后再试。",
    ok: false,
  };
}

export function compareVersionLike(
  currentVersion?: string | number | null,
  latestVersion?: string | number | null,
): number {
  const currentParts = extractVersionParts(currentVersion);
  const latestParts = extractVersionParts(latestVersion);

  if (!currentParts.length || !latestParts.length) {
    return 0;
  }

  const length = Math.max(currentParts.length, latestParts.length);

  for (let index = 0; index < length; index++) {
    const currentPart = currentParts[index] ?? 0;
    const latestPart = latestParts[index] ?? 0;

    if (latestPart > currentPart) return 1;
    if (latestPart < currentPart) return -1;
  }

  return 0;
}

export function getPgyerUpdateStatus(input: {
  currentBuildNumber?: string | number | null;
  currentVersion?: string | number | null;
  latest: AboutPgyerPublishedVersion;
}): AboutPgyerUpdateStatus {
  const currentBuildNumber = normalizeComparableValue(input.currentBuildNumber);
  const currentVersion = normalizeComparableValue(input.currentVersion);
  const latestBuildNumber = normalizeComparableValue(
    input.latest.buildVersionNo,
  );
  const latestVersion = normalizeComparableValue(input.latest.buildVersion);
  const updateUrl =
    normalizePgyerAppUrl(input.latest.updateUrl) ||
    waylogDistributionConfig.pgyerAppUrl;
  const hasBuildNumberSignal = Boolean(currentBuildNumber && latestBuildNumber);
  const inferredHasUpdate = hasBuildNumberSignal
    ? compareVersionLike(currentBuildNumber, latestBuildNumber) > 0
    : compareVersionLike(currentVersion, latestVersion) > 0;

  return {
    hasUpdate: input.latest.buildHaveNewVersion ?? inferredHasUpdate,
    latestBuildNumber: latestBuildNumber || undefined,
    latestVersion: latestVersion || undefined,
    releaseNotes:
      normalizeComparableValue(input.latest.buildUpdateDescription) ||
      undefined,
    updateUrl,
  };
}

export async function checkPgyerAppUpdate(input: {
  currentBuildNumber?: string | number | null;
  currentVersion?: string | number | null;
}): Promise<AboutPgyerUpdateCheckResponse> {
  return requestSupabase<AboutPgyerUpdateCheckResponse>({
    body: {
      currentBuildNumber:
        normalizeComparableValue(input.currentBuildNumber) || undefined,
      currentVersion:
        normalizeComparableValue(input.currentVersion) || undefined,
    },
    path: "pgyer-update-check",
    service: "functions",
  });
}

function getPlatformLabel(platformOS?: string | null): string {
  if (platformOS === "android") return "Android";
  if (platformOS === "ios") return "iOS";
  if (platformOS === "web") return "Web";

  return "当前设备";
}

function getExecutionLabel(executionEnvironment?: string | null): string {
  if (executionEnvironment === "storeClient") return "Expo Go";
  if (executionEnvironment === "standalone") return "独立应用";
  if (executionEnvironment === "bare") return "原生构建";

  return "开发环境";
}

function getReleaseChannelLabel(input: AboutRuntimeInfoInput): string {
  if (input.debugMode)
    return input.platformOS === "web" ? "Web 调试" : "开发调试";
  if (input.appOwnership === "expo") return "Expo Go";
  if (input.executionEnvironment === "storeClient") return "Expo Go";
  if (input.androidVersionCode || input.iosBuildNumber) return "内测/正式包";

  return "本地构建";
}

function extractVersionParts(value?: string | number | null): number[] {
  const normalizedValue = normalizeComparableValue(value);

  if (!normalizedValue) {
    return [];
  }

  return (normalizedValue.match(/\d+/g) ?? []).map((part) =>
    Number.parseInt(part, 10),
  );
}

function normalizeComparableValue(value?: string | number | null): string {
  const normalizedValue = String(value ?? "").trim();

  return normalizedValue &&
    normalizedValue !== "?" &&
    normalizedValue !== "暂无" &&
    normalizedValue !== "undefined"
    ? normalizedValue
    : "";
}
