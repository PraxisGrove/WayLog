import assert from "node:assert/strict";
import test from "node:test";
import { resolveAgentConversationLayoutPreset } from "../../domains/agent/screens/conversation/agent-conversation-layout-preset";
import { resolveProfileLayoutPreset } from "../../domains/identity/screens/profile/profile-layout-preset";
import { resolveTripDetailOverviewLayout } from "../../domains/trips/screens/trip-detail/detail-layout-preset";
import { resolveTripDetailDayLayoutPreset } from "../../domains/trips/screens/trip-detail/trip-detail-day-layout-preset";
import { resolveTripFormLayoutPreset } from "../../domains/trips/screens/trip-form-layout-preset";
import { resolveTripListHomeLayout } from "../../domains/trips/screens/trip-list/home-layout-preset";
import { resolveTheme } from "../../shared/theme/resolve-theme";
import {
  getSkinCatalogItemById,
  type SkinCatalogLayer,
  skinUiCatalog,
} from "../../shared/theme/skin-ui-catalog";
import { createAppTheme } from "../../shared/theme/theme";
import { THEME_COLORS } from "../../shared/theme/theme-colors";
import {
  DEFAULT_THEME_ID,
  getThemeDefinition,
  isThemeId,
  THEME_DEFINITIONS,
} from "../../shared/theme/theme-registry";

function getRequired<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

test("theme skins define complete light and dark modes", () => {
  assert.equal(
    new Set(THEME_COLORS.map((color) => color.id)).size,
    THEME_COLORS.length,
  );

  for (const color of THEME_COLORS) {
    for (const mode of ["light", "dark"] as const) {
      const theme = createAppTheme(mode, color);

      assert.equal(theme.id, color.id);
      assert.ok(theme.colors.primary);
      assert.ok(theme.colors.primarySoft);
      assert.ok(theme.colors.focusRing);
      assert.ok(theme.colors.navigation.activeBackground);
      assert.ok(theme.colors.ticket.background);
      assert.ok(theme.colors.ticket.featured.heroBackground);
    }
  }
});

test("trip status meaning stays stable when users switch skins", () => {
  const baseline = createAppTheme("light", THEME_COLORS[0]).colors.status;

  for (const color of THEME_COLORS.slice(1)) {
    assert.deepEqual(createAppTheme("light", color).colors.status, baseline);
  }
});

test("theme registry exposes classic and default theme definitions", () => {
  assert.equal(DEFAULT_THEME_ID, "default");
  assert.deepEqual(
    THEME_DEFINITIONS.map((definition) => definition.id),
    ["default", "classic"],
  );
  assert.equal(getThemeDefinition("classic").displayName, "简洁模式");
  assert.equal(getThemeDefinition("default").displayName, "默认模式");
  assert.equal(getThemeDefinition("missing").id, "default");
  assert.equal(isThemeId("classic"), true);
  assert.equal(isThemeId("default"), true);
  assert.equal(isThemeId("missing"), false);
});

test("resolveTheme wraps classic design tokens and recipes", () => {
  const resolvedTheme = resolveTheme({
    classicPaletteId: "ocean",
    colorScheme: "dark",
    themeId: "classic",
  });
  const legacyTheme = createAppTheme(
    "dark",
    getRequired(
      THEME_COLORS.find((color) => color.id === "ocean"),
      "expected ocean theme color",
    ),
  );

  assert.equal(resolvedTheme.id, "classic");
  assert.equal(resolvedTheme.tokens.id, "ocean");
  assert.equal(resolvedTheme.tokens.colors.primary, legacyTheme.colors.primary);
  assert.equal(
    resolvedTheme.recipes.button.primary.backgroundColor,
    legacyTheme.colors.primary,
  );
  assert.equal(resolvedTheme.defaultHomeLayoutPreset, "simpleList");
  assert.deepEqual(resolvedTheme.agent, {
    conversationLayoutPreset: "standard",
  });
  assert.deepEqual(resolvedTheme.shell, {
    primaryActionPlacement: "center",
    tabBarPreset: "centerAdd",
  });
  assert.deepEqual(resolvedTheme.detail, {
    dayLayoutPreset: "immersiveMapSheet",
    layoutPreset: "standard",
  });
  assert.deepEqual(resolvedTheme.profile, {
    layoutPreset: "standard",
  });
  assert.deepEqual(resolvedTheme.tripForm, {
    layoutPreset: "standard",
  });
  assert.equal(resolvedTheme.tokens.routeMap.marker.mobileNameMaxLength, 8);
  assert.equal(resolvedTheme.tokens.routeMap.marker.desktopNameMaxLength, 10);
  assert.equal(resolvedTheme.tokens.routeMap.marker.palette.length >= 4, true);
  assert.equal(
    resolvedTheme.tokens.routeMap.route.selectedWidth >
      resolvedTheme.tokens.routeMap.route.normalWidth,
    true,
  );
});

test("semantic component recipes expose the first foundation variants", () => {
  const resolvedTheme = resolveTheme({
    classicPaletteId: "warm",
    colorScheme: "light",
    themeId: "classic",
  });

  assert.deepEqual(Object.keys(resolvedTheme.recipes.button), [
    "danger",
    "ghost",
    "primary",
    "secondary",
  ]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.card), [
    "default",
    "elevated",
    "profile",
    "ticket",
  ]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.dialog), [
    "default",
    "elevated",
  ]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.feedback), [
    "danger",
    "info",
    "success",
    "warning",
  ]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.input), [
    "default",
    "error",
    "search",
  ]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.badge), [
    "danger",
    "info",
    "success",
    "warning",
  ]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.listRow), [
    "default",
    "navigation",
    "selectable",
  ]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.sheet), ["default"]);
  assert.deepEqual(Object.keys(resolvedTheme.recipes.surface), [
    "default",
    "muted",
    "raised",
  ]);
});

test("default theme id resolves as a minimal draft skin", () => {
  const resolvedTheme = resolveTheme({
    classicPaletteId: "warm",
    colorScheme: "light",
    themeId: "default",
  });

  assert.equal(resolvedTheme.id, "default");
  assert.equal(resolvedTheme.displayName, "默认模式");
  assert.equal(resolvedTheme.defaultHomeLayoutPreset, "simpleList");
  assert.deepEqual(resolvedTheme.shell, {
    primaryActionPlacement: "bottomRight",
    tabBarPreset: "rightFab",
  });
  assert.deepEqual(resolvedTheme.detail, {
    dayLayoutPreset: "immersiveMapSheet",
    layoutPreset: "standard",
  });
  assert.equal(resolvedTheme.tokens.id, "default");
  assert.equal(resolvedTheme.tokens.colors.primary, "#111111");
  assert.equal(resolvedTheme.tokens.colors.background, "#F3F4F6");
  assert.equal(
    resolvedTheme.tokens.colors.ticket.featured.heroBackground,
    "#F3F4F6",
  );
  assert.equal(
    resolvedTheme.tokens.colors.ticket.featured.heroMutedText,
    "#565656",
  );
  assert.equal(resolvedTheme.recipes.card.elevated.shadow, undefined);
  assert.equal(resolvedTheme.recipes.button.secondary.borderColor, "#8A9099");
  assert.equal(resolvedTheme.recipes.button.secondary.borderWidth, 1.5);
  assert.equal(resolvedTheme.tokens.colors.success, "#111111");
  assert.equal(resolvedTheme.tokens.colors.status.traveling.text, "#111111");
  assert.equal(resolvedTheme.tokens.routeMap.route.color, "#2563EB");
  assert.deepEqual(
    resolvedTheme.tokens.routeMap.route.estimatedPattern,
    [10, 8],
  );

  const darkTheme = resolveTheme({
    classicPaletteId: "warm",
    colorScheme: "dark",
    themeId: "default",
  });
  assert.equal(darkTheme.tokens.routeMap.route.color, "#60A5FA");
});

test("trip detail layout presets control overview module order", () => {
  assert.deepEqual(resolveTripDetailOverviewLayout("standard").moduleOrder, [
    "summary",
    "quickStats",
    "notebook",
    "route",
    "travelInfo",
  ]);
  assert.deepEqual(
    resolveTripDetailOverviewLayout("itineraryFirst").moduleOrder,
    ["summary", "route", "quickStats", "notebook", "travelInfo"],
  );
  assert.deepEqual(
    resolveTripDetailOverviewLayout("journalFirst").moduleOrder,
    ["summary", "notebook", "route", "quickStats", "travelInfo"],
  );
});

test("home layout presets control trip list module order", () => {
  assert.deepEqual(resolveTripListHomeLayout("simpleList").moduleOrder, [
    "featuredTrip",
    "todayPlan",
    "allTrips",
  ]);
  assert.deepEqual(resolveTripListHomeLayout("todayFirst").moduleOrder, [
    "todayPlan",
    "featuredTrip",
    "allTrips",
  ]);
  assert.deepEqual(resolveTripListHomeLayout("dashboard").moduleOrder, [
    "todayPlan",
    "featuredTrip",
    "allTrips",
  ]);
});

test("page layout presets expose skin-controlled structure options", () => {
  assert.deepEqual(resolveProfileLayoutPreset("standard"), {
    heroTreatment: "standard",
    loginPanelPlacement: "afterHero",
    presetId: "standard",
    quickActionDensity: "standard",
  });
  assert.equal(
    resolveProfileLayoutPreset("compact").quickActionDensity,
    "compact",
  );

  assert.deepEqual(resolveAgentConversationLayoutPreset("standard"), {
    chatColumnWidth: "standard",
    contentGap: 14,
    inputDockDensity: "standard",
    presetId: "standard",
  });
  assert.equal(
    resolveAgentConversationLayoutPreset("dense").inputDockDensity,
    "compact",
  );

  assert.deepEqual(resolveTripFormLayoutPreset("standard"), {
    cardDensity: "standard",
    contentGap: 16,
    presetId: "standard",
    sectionGap: 16,
  });
  assert.equal(resolveTripFormLayoutPreset("compact").cardDensity, "compact");

  assert.deepEqual(resolveTripDetailDayLayoutPreset("immersiveMapSheet"), {
    mapLayer: "immersiveBackground",
    presetId: "immersiveMapSheet",
    sheetContentMode: "auto",
    timelineDensity: "standard",
  });
  assert.equal(
    resolveTripDetailDayLayoutPreset("timelineFirst").sheetContentMode,
    "timeline",
  );
});

test("skin ui catalog covers all skin system layers with stable ids", () => {
  const expectedLayers: SkinCatalogLayer[] = [
    "shell",
    "page-layout",
    "page-module",
    "ui-foundation",
    "interaction-state",
    "motion",
    "preview",
  ];
  const layers = new Set(skinUiCatalog.map((group) => group.layer));
  const ids = skinUiCatalog.flatMap((group) => [
    group.id,
    ...group.items.map((item) => item.id),
  ]);

  for (const layer of expectedLayers) {
    assert.equal(layers.has(layer), true);
  }

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(getSkinCatalogItemById("shell.tab-bar")?.status, "ready");
  assert.equal(getSkinCatalogItemById("page.home")?.status, "ready");
  assert.equal(getSkinCatalogItemById("page.trip-detail")?.status, "ready");
  assert.equal(getSkinCatalogItemById("page.profile")?.status, "ready");
  assert.equal(
    getSkinCatalogItemById("page.agent-conversation")?.status,
    "ready",
  );
  assert.equal(getSkinCatalogItemById("page.trip-new")?.status, "ready");
  assert.equal(getSkinCatalogItemById("page.trip-edit")?.status, "ready");
  assert.equal(
    getSkinCatalogItemById("module.trip-detail.day-immersive")?.status,
    "ready",
  );
  assert.equal(getSkinCatalogItemById("ui.dialog-modal")?.status, "ready");
  assert.equal(getSkinCatalogItemById("ui.feedback")?.status, "ready");
  assert.equal(getSkinCatalogItemById("state.pressed")?.status, "ready");
  assert.equal(getSkinCatalogItemById("motion.soft-3d")?.status, "todo");
  assert.equal(getSkinCatalogItemById("preview.theme-lab")?.status, "ready");
});
