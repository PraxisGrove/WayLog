import type { CurrentAuthUser } from "./types";

export const profilePostLoginCopy = {
  appearanceTitle: "外观",
  avatarActions: ["上传头像", "移除头像"],
  profileFieldLabels: ["头像", "名称", "个人简介"],
  quickActionTitles: ["足迹地图", "收藏地点", "旅行手账"],
  settingSectionTitles: ["账号与应用"],
  summaryLabels: ["行程", "天数", "地点"],
} as const;

export const profileAvatarScaleRange = {
  defaultValue: 1,
  max: 2,
  min: 1,
  step: 0.1,
} as const;

export const profileAvatarOffsetRange = {
  defaultValue: 0,
  max: 40,
  min: -40,
  step: 4,
} as const;

export const feedbackEntry = {
  description: "反馈软件不足、使用问题和改进建议",
  icon: "feedback",
  route: "feedback",
  title: "问题反馈",
} as const;

export const profileLoginInputWebFocusStyle = {
  outlineStyle: "solid",
  outlineWidth: 0,
} as const;

export type ProfileLoginAccountChannel = "email" | "phone";

export function getProfileLoginAccountVisualKind(
  input: string,
): ProfileLoginAccountChannel {
  const value = input.trim();

  if (value && /^\+?[\d\s-]+$/.test(value)) {
    return "phone";
  }

  return "email";
}

export function getProfileLoginAccountChannel(
  input: string,
): ProfileLoginAccountChannel | null {
  const value = input.trim();
  const phoneDigits = value.replace(/\D/g, "");

  if (
    /^1[3-9]\d{9}$/.test(phoneDigits) ||
    /^861[3-9]\d{9}$/.test(phoneDigits)
  ) {
    return "phone";
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "email";
  }

  return null;
}

export function getProfileInitials(displayName: string) {
  return displayName.trim().slice(0, 2).toUpperCase() || "我";
}

export function normalizeProfileAvatarImageUri(avatarUrl?: string | null) {
  const value = avatarUrl?.trim() ?? "";

  if (/^(file|content|data|blob|https?):/i.test(value)) {
    return value;
  }

  return "";
}

export function shouldShowProfileLoginStatusMessage(
  message: string,
  defaultMessage: string,
): boolean {
  return message !== defaultMessage;
}

export type ProfileLoginStatusTone = "error" | "info" | "success";

export function getProfileLoginStatusPresentation(
  message: string,
  defaultMessage: string,
  tone: ProfileLoginStatusTone,
) {
  const visible = shouldShowProfileLoginStatusMessage(message, defaultMessage);

  return {
    accessibilityRole: tone === "error" && visible ? "alert" : undefined,
    tone,
    visible,
  } as const;
}

export const profileQuickActions = [
  {
    title: "足迹地图",
    description: "查看行程地点的地图分布",
    icon: "map",
    route: "footprints",
  },
  {
    title: "收藏地点",
    description: "景点、餐厅、酒店和交通点",
    icon: "favorite",
    route: "favoritePlaces",
  },
  {
    title: "旅行手账",
    description: "回看照片、文字和旅途故事",
    icon: "auto-stories",
    route: "travelJournal",
  },
] as const;

export const profileMenuSections = [
  {
    title: "",
    items: [
      {
        title: "行程提醒",
        description: "重要信息和当天安排提醒",
        icon: "event-available",
        route: "reminders",
      },
      {
        title: "外观设置",
        description: "切换浅色、深色或跟随系统",
        icon: "palette",
        route: "appearance",
      },
    ],
  },
  {
    title: "账号与应用",
    items: [
      {
        title: "账号与登录",
        description: "查看当前登录方式和同步身份",
        icon: "verified-user",
        route: "account",
      },
      {
        title: "偏好设置",
        description: "交通、地图、提醒与预算偏好",
        icon: "tune",
        route: "preferences",
      },
      feedbackEntry,
      {
        title: "关于项目",
        description: "版本、更新和基础信息",
        icon: "info-outline",
        route: "about",
      },
    ],
  },
] as const;

export function getProfilePageVisibility(authUser: CurrentAuthUser | null) {
  const isSignedIn = Boolean(authUser);

  return {
    showLoginPanel: !isSignedIn,
    showPostLoginModules: isSignedIn,
    showStandaloneHeader: false,
  };
}

export function shouldShowProfilePasswordSetupPrompt(
  authUser: CurrentAuthUser | null,
) {
  if (
    !authUser?.session.accessToken ||
    authUser.session.passwordSetupDismissedAt
  ) {
    return false;
  }

  const emailIdentity = authUser.identities.find(
    (identity) => identity.provider === "email",
  );

  return Boolean(emailIdentity && !emailIdentity.hasPassword);
}

function isGuestOnlyAuthUser(authUser: CurrentAuthUser | null) {
  return Boolean(
    authUser &&
      authUser.identities.length > 0 &&
      authUser.identities.every((identity) => identity.provider === "guest"),
  );
}

function isCloudBackedAuthUser(authUser: CurrentAuthUser | null) {
  return Boolean(authUser?.session.accessToken);
}

export function shouldPromptGuestDataMigration(
  previousAuthUser: CurrentAuthUser | null,
  nextAuthUser: CurrentAuthUser | null,
) {
  return (
    isGuestOnlyAuthUser(previousAuthUser) && isCloudBackedAuthUser(nextAuthUser)
  );
}
