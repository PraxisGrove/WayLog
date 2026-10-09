import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentAuthUser } from "../../features/auth";
import {
  feedbackEntry,
  getProfileInitials,
  getProfileLoginAccountChannel,
  getProfileLoginAccountVisualKind,
  getProfileLoginStatusPresentation,
  getProfilePageVisibility,
  normalizeProfileAvatarImageUri,
  profileAvatarOffsetRange,
  profileAvatarScaleRange,
  profileLoginInputWebFocusStyle,
  profileMenuSections,
  profilePostLoginCopy,
  shouldShowProfileLoginStatusMessage,
  shouldShowProfilePasswordSetupPrompt,
} from "../../features/auth/profile-page";
import * as profileVisuals from "../../shared/account/profile-visuals";
import {
  formatProfileFieldNoteDate,
  getProfileGlassSurface,
  getProfileTravelPaperBackground,
} from "../../shared/account/profile-visuals";
import { createAppTheme } from "../../shared/theme/theme";
import { getThemeColorById } from "../../shared/theme/theme-colors";

type ProfileBackgroundSpec = {
  dark: {
    baseColor: string;
    horizontalLineGap: number;
    marginLineOffset: number;
    pinOpacity: number;
    routePaths: readonly string[];
    routeMarkers: readonly {
      kind: string;
    }[];
    variant: string;
    verticalLineCount: number;
  };
  light: {
    baseColor: string;
    horizontalLineGap: number;
    marginLineOffset: number;
    pinOpacity: number;
    routeColor: string;
    routePaths: readonly string[];
    routeMarkers: readonly {
      kind: string;
    }[];
    variant: string;
  };
};

type ProfileGlassSurfaceSpec = {
  dark: {
    androidCardBackgroundColor: string;
    blur: number;
    cardBackgroundColor: string;
    tabBarBackgroundColor: string;
  };
  light: {
    androidCardBackgroundColor: string;
    blur: number;
    cardBackgroundColor: string;
    tabBarBackgroundColor: string;
    tabBarBottom: number;
    tabBarHorizontalMargin: number;
    tabBarRadius: number;
  };
};

type MainTabRouteSpec = readonly string[];

const defaultMessage = "输入邮箱或手机号获取验证码，登录成功后自动创建账号。";

test("profile tab keeps the signed-out page focused on login", () => {
  const visibility = getProfilePageVisibility(null);

  assert.equal(visibility.showLoginPanel, true);
  assert.equal(visibility.showPostLoginModules, false);
  assert.equal(visibility.showStandaloneHeader, false);
});

test("profile login inputs suppress the default web focus outline", () => {
  assert.equal(profileLoginInputWebFocusStyle.outlineStyle, "solid");
  assert.equal(profileLoginInputWebFocusStyle.outlineWidth, 0);
});

test("profile login account input switches its visual hint for phone candidates", () => {
  assert.equal(getProfileLoginAccountVisualKind(""), "email");
  assert.equal(getProfileLoginAccountVisualKind("138"), "phone");
  assert.equal(getProfileLoginAccountVisualKind("+86 138"), "phone");
  assert.equal(getProfileLoginAccountVisualKind("user@example.com"), "email");
});

test("profile login account input routes complete formats to the correct verification channel", () => {
  assert.equal(getProfileLoginAccountChannel("13800138000"), "phone");
  assert.equal(getProfileLoginAccountChannel("+86 138-0013-8000"), "phone");
  assert.equal(getProfileLoginAccountChannel("user@example.com"), "email");
  assert.equal(getProfileLoginAccountChannel("1380013"), null);
  assert.equal(getProfileLoginAccountChannel("user@"), null);
});

test("profile login hides the default helper message", () => {
  assert.equal(
    shouldShowProfileLoginStatusMessage(defaultMessage, defaultMessage),
    false,
  );
  assert.equal(
    shouldShowProfileLoginStatusMessage(
      "验证码已发送，请查看邮箱。如果没看到，请检查垃圾邮件或稍等一会儿。",
      defaultMessage,
    ),
    true,
  );
});

test("profile login failure status is presented as a visible alert", () => {
  const status = getProfileLoginStatusPresentation(
    "验证码不正确或已过期，请重新发送后再试。",
    defaultMessage,
    "error",
  );

  assert.equal(status.visible, true);
  assert.equal(status.accessibilityRole, "alert");
  assert.equal(status.tone, "error");
});

test("profile tab shows personal modules after sign-in", () => {
  const authUser = {
    identities: [],
    session: {
      createdAt: "2026-05-30T00:00:00.000Z",
      lastActiveAt: "2026-05-30T00:00:00.000Z",
      userId: "user-1",
    },
    user: {
      createdAt: "2026-05-30T00:00:00.000Z",
      displayName: "测试用户",
      id: "user-1",
      updatedAt: "2026-05-30T00:00:00.000Z",
    },
  } satisfies CurrentAuthUser;

  const visibility = getProfilePageVisibility(authUser);

  assert.equal(visibility.showLoginPanel, false);
  assert.equal(visibility.showPostLoginModules, true);
  assert.deepEqual(profilePostLoginCopy.summaryLabels, [
    "行程",
    "天数",
    "地点",
  ]);
  assert.deepEqual(profilePostLoginCopy.quickActionTitles, [
    "足迹地图",
    "收藏地点",
    "旅行手账",
  ]);
  assert.equal(profilePostLoginCopy.settingSectionTitles.length, 1);
  assert.equal(profilePostLoginCopy.avatarActions.length, 2);
  assert.equal(profilePostLoginCopy.profileFieldLabels.length, 3);
  assert.deepEqual(profileAvatarScaleRange, {
    defaultValue: 1,
    max: 2,
    min: 1,
    step: 0.1,
  });
  assert.deepEqual(profileAvatarOffsetRange, {
    defaultValue: 0,
    max: 40,
    min: -40,
    step: 4,
  });
});

test("profile avatar helpers keep profile and account pages on the same user avatar data", () => {
  assert.equal(getProfileInitials("雨宫莲"), "雨宫");
  assert.equal(getProfileInitials(""), "我");
  assert.equal(
    normalizeProfileAvatarImageUri(" https://example.com/avatar.jpg "),
    "https://example.com/avatar.jpg",
  );
  assert.equal(
    normalizeProfileAvatarImageUri("data:image/jpeg;base64,avatar"),
    "data:image/jpeg;base64,avatar",
  );
  assert.equal(normalizeProfileAvatarImageUri("javascript:alert(1)"), "");
});

test("profile tab prompts signed-in email users to set a password when needed", () => {
  const authUser = {
    identities: [
      {
        createdAt: "2026-05-30T00:00:00.000Z",
        id: "identity-1",
        label: "t***@example.com",
        lastLoginAt: "2026-05-30T00:00:00.000Z",
        provider: "email",
        providerUid: "test@example.com",
        userId: "user-1",
      },
    ],
    session: {
      accessToken: "access-token-1",
      createdAt: "2026-05-30T00:00:00.000Z",
      lastActiveAt: "2026-05-30T00:00:00.000Z",
      userId: "user-1",
    },
    user: {
      createdAt: "2026-05-30T00:00:00.000Z",
      displayName: "测试用户",
      id: "user-1",
      updatedAt: "2026-05-30T00:00:00.000Z",
    },
  } satisfies CurrentAuthUser;

  assert.equal(shouldShowProfilePasswordSetupPrompt(authUser), true);
  assert.equal(
    shouldShowProfilePasswordSetupPrompt({
      ...authUser,
      identities: [{ ...authUser.identities[0], hasPassword: true }],
    }),
    false,
  );
  assert.equal(
    shouldShowProfilePasswordSetupPrompt({
      ...authUser,
      session: {
        ...authUser.session,
        passwordSetupDismissedAt: "2026-05-30T00:01:00.000Z",
      },
    }),
    false,
  );
});

test("profile tab uses the field notes structure in both color modes", () => {
  const background = (
    profileVisuals as { profileTravelPaperBackground?: ProfileBackgroundSpec }
  ).profileTravelPaperBackground;

  assert.ok(background);
  if (!background) {
    return;
  }

  assert.equal(background.light.variant, "field-notes");
  assert.equal(background.light.baseColor, "#F0ECE2");
  assert.equal(background.light.horizontalLineGap, 36);
  assert.equal(background.light.marginLineOffset, 42);
  assert.equal(background.light.routeColor, "#C2410C");
  assert.equal(background.light.pinOpacity, 0.58);
  assert.equal(background.light.routePaths.length, 2);
  assert.equal(
    background.light.routePaths[0],
    "M-24 188 C64 128, 115 230, 196 172 S333 106, 420 164",
  );
  assert.deepEqual(
    background.light.routeMarkers.map((marker) => marker.kind),
    ["reusable-booster", "saturn-beacon", "landing-burn"],
  );
  assert.equal(background.dark.variant, "field-notes");
  assert.equal(background.dark.baseColor, "#171513");
  assert.equal(background.dark.pinOpacity, 0.58);
  assert.equal(background.dark.horizontalLineGap, 36);
  assert.equal(background.dark.marginLineOffset, 42);
  assert.equal(background.dark.verticalLineCount, 0);
  assert.deepEqual(background.dark.routePaths, background.light.routePaths);
  assert.deepEqual(background.dark.routeMarkers, background.light.routeMarkers);
});

test("profile background and glass colors follow the active theme skin", () => {
  const lightTheme = createAppTheme("light", getThemeColorById("warm"));
  const darkTheme = createAppTheme("dark", getThemeColorById("ocean"));
  const lightBackground = getProfileTravelPaperBackground(lightTheme);
  const darkBackground = getProfileTravelPaperBackground(darkTheme);
  const darkGlass = getProfileGlassSurface(darkTheme);

  assert.equal(lightBackground.baseColor, "#F0ECE2");
  assert.equal(lightBackground.routeColor, lightTheme.colors.primary);
  assert.equal(lightBackground.glowColor, lightTheme.colors.primary);
  assert.equal(darkBackground.baseColor, "#171513");
  assert.equal(darkBackground.glowColor, darkTheme.colors.primary);
  assert.equal(darkGlass.cardBackgroundColor, "rgba(33, 30, 27, 0.94)");
  assert.equal(darkGlass.tabBarBackgroundColor, "rgba(29, 26, 23, 0.94)");
});

test("profile field note marker includes the supplied month and day", () => {
  assert.equal(
    formatProfileFieldNoteDate(new Date(2026, 5, 12)),
    "FIELD NOTE  06 / 12",
  );
});

test("profile tab defines translucent glass surfaces with opaque Android fallbacks", () => {
  const glass = (
    profileVisuals as { profileGlassSurface?: ProfileGlassSurfaceSpec }
  ).profileGlassSurface;
  const shouldUseProfileGlassTabBar = (
    profileVisuals as {
      shouldUseProfileGlassTabBar?: (pathname: string) => boolean;
    }
  ).shouldUseProfileGlassTabBar;
  const mainTabRoutes = (profileVisuals as { mainTabRoutes?: MainTabRouteSpec })
    .mainTabRoutes;

  assert.ok(glass);
  assert.ok(shouldUseProfileGlassTabBar);
  assert.ok(mainTabRoutes);
  if (!glass || !shouldUseProfileGlassTabBar || !mainTabRoutes) {
    return;
  }

  assert.equal(glass.light.blur, 16);
  assert.equal(glass.light.androidCardBackgroundColor, "#FBFAF7");
  assert.equal(glass.light.cardBackgroundColor.startsWith("rgba("), true);
  assert.equal(glass.light.tabBarBackgroundColor.startsWith("rgba("), true);
  assert.equal(glass.light.tabBarBottom, 10);
  assert.equal(glass.light.tabBarHorizontalMargin, 18);
  assert.equal(glass.light.tabBarRadius, 20);
  assert.equal(glass.dark.cardBackgroundColor.startsWith("rgba("), true);
  assert.equal(glass.dark.androidCardBackgroundColor, "#211E1B");
  assert.equal(shouldUseProfileGlassTabBar("/profile"), true);
  assert.equal(shouldUseProfileGlassTabBar("/"), true);
  assert.deepEqual([...mainTabRoutes], ["/", "/create", "/profile"]);
});

test("profile feedback entry is listed in the profile menu with correct title and route", () => {
  assert.equal(feedbackEntry.route, "feedback");
  assert.equal(feedbackEntry.title, "问题反馈");

  const appSection = profileMenuSections.find((section) =>
    section.items.some(
      (item) => (item as { route: string }).route === "feedback",
    ),
  );

  if (!appSection) {
    assert.ok(
      false,
      "Expected the profile menu to include an account and app section.",
    );
    return;
  }

  const feedbackItem = appSection.items.find(
    (item) => (item as { route: string }).route === "feedback",
  );

  assert.equal(feedbackItem?.title, feedbackEntry.title);
});

test("profile menu keeps the account entry for the standalone account and security page", () => {
  const appSection = profileMenuSections.find((section) =>
    section.items.some(
      (item) => (item as { route: string }).route === "account",
    ),
  );

  if (!appSection) {
    assert.ok(
      false,
      "Expected the profile menu to include an account and app section.",
    );
    return;
  }

  const accountItem = appSection.items.find(
    (item) => (item as { route: string }).route === "account",
  );

  assert.equal(accountItem?.route, "account");
  assert.equal(accountItem?.icon, "verified-user");
});

test("profile menu exposes preferences instead of the old data management entry", () => {
  const appSection = profileMenuSections.find((section) =>
    section.items.some(
      (item) => (item as { route: string }).route === "preferences",
    ),
  );

  if (!appSection) {
    assert.ok(
      false,
      "Expected the profile menu to include a preferences entry.",
    );
    return;
  }

  const preferenceItem = appSection.items.find(
    (item) => (item as { route: string }).route === "preferences",
  );

  assert.equal(preferenceItem?.title, "偏好设置");
  assert.equal(preferenceItem?.description, "交通、地图、提醒与预算偏好");
  assert.equal(
    appSection.items.some(
      (item) => (item as { route: string }).route === "data",
    ),
    false,
  );
});
