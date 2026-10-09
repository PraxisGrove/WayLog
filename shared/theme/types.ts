import type { ResolvedColorScheme } from "./color-scheme";
import type { ResolvedDesignTokens } from "./design-tokens";
import type { ClassicPalette } from "./palettes/classic-palettes";
import type { ThemeSkinPackConfig } from "./skin-slot-types";

export type ThemeId = "classic" | "default";

export type ThemeAccess = "free" | "premium" | "limited";

export type ThemeFamily = "classic" | "waylog";

export type HomeLayoutPresetId = "simpleList" | "todayFirst" | "dashboard";

export type HomeLayoutPresetPreference = "themeDefault" | HomeLayoutPresetId;

export type TripDetailLayoutPresetId =
  | "standard"
  | "itineraryFirst"
  | "journalFirst";

export type TripDetailLayoutPresetPreference =
  | "themeDefault"
  | TripDetailLayoutPresetId;

export type TripDetailDayLayoutPresetId =
  | "immersiveMapSheet"
  | "timelineFirst"
  | "compactTimeline";

export type ProfileLayoutPresetId = "standard" | "heroFirst" | "compact";

export type AgentConversationLayoutPresetId = "standard" | "focused" | "dense";

export type TripFormLayoutPresetId = "standard" | "guided" | "compact";

export type ShellTabBarPresetId = "centerAdd" | "rightFab";

export type ShellTabBarPresetPreference = "themeDefault" | ShellTabBarPresetId;

export type ShellPrimaryActionPlacement = "center" | "bottomRight";

export type ThemeShellConfig = {
  primaryActionPlacement: ShellPrimaryActionPlacement;
  tabBarPreset: ShellTabBarPresetId;
};

export type ThemeDetailConfig = {
  dayLayoutPreset: TripDetailDayLayoutPresetId;
  layoutPreset: TripDetailLayoutPresetId;
};

export type ThemeProfileConfig = {
  layoutPreset: ProfileLayoutPresetId;
};

export type ThemeAgentConfig = {
  conversationLayoutPreset: AgentConversationLayoutPresetId;
};

export type ThemeTripFormConfig = {
  layoutPreset: TripFormLayoutPresetId;
};

export type ComponentVariantRecipe = {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  color?: string;
  minHeight?: number;
  radius?: number;
  shadow?: ResolvedDesignTokens["shadow"][keyof ResolvedDesignTokens["shadow"]];
};

export type ComponentRecipes = {
  badge: {
    danger: ComponentVariantRecipe;
    info: ComponentVariantRecipe;
    success: ComponentVariantRecipe;
    warning: ComponentVariantRecipe;
  };
  button: {
    danger: ComponentVariantRecipe;
    ghost: ComponentVariantRecipe;
    primary: ComponentVariantRecipe;
    secondary: ComponentVariantRecipe;
  };
  card: {
    default: ComponentVariantRecipe;
    elevated: ComponentVariantRecipe;
    profile: ComponentVariantRecipe;
    ticket: ComponentVariantRecipe;
  };
  dialog: {
    default: ComponentVariantRecipe;
    elevated: ComponentVariantRecipe;
  };
  feedback: {
    danger: ComponentVariantRecipe;
    info: ComponentVariantRecipe;
    success: ComponentVariantRecipe;
    warning: ComponentVariantRecipe;
  };
  input: {
    default: ComponentVariantRecipe;
    error: ComponentVariantRecipe;
    search: ComponentVariantRecipe;
  };
  listRow: {
    default: ComponentVariantRecipe;
    navigation: ComponentVariantRecipe;
    selectable: ComponentVariantRecipe;
  };
  sheet: {
    default: ComponentVariantRecipe;
  };
  surface: {
    default: ComponentVariantRecipe;
    muted: ComponentVariantRecipe;
    raised: ComponentVariantRecipe;
  };
};

export type ThemeDefinition = {
  access: ThemeAccess;
  agent: ThemeAgentConfig;
  defaultClassicPaletteId?: string;
  defaultHomeLayoutPreset: HomeLayoutPresetId;
  description: string;
  detail: ThemeDetailConfig;
  displayName: string;
  family: ThemeFamily;
  id: ThemeId;
  profile: ThemeProfileConfig;
  shell: ThemeShellConfig;
  skin: ThemeSkinPackConfig;
  tripForm: ThemeTripFormConfig;
};

export type ResolveThemeOptions = {
  classicPaletteId?: string;
  colorScheme: ResolvedColorScheme;
  themeId: ThemeId;
};

export type ResolvedTheme = ThemeDefinition & {
  classicPalette?: ClassicPalette;
  recipes: ComponentRecipes;
  tokens: ResolvedDesignTokens;
};
