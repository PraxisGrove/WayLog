import type { ResolvedDesignTokens } from "../design-tokens";
import type { ComponentRecipes } from "../types";

export function createDefaultRecipes(
  tokens: ResolvedDesignTokens,
): ComponentRecipes {
  const noDecorativeBorder = {
    borderColor: "transparent",
    borderWidth: 0,
  };

  return {
    badge: {
      danger: {
        backgroundColor: tokens.colors.dangerSoft,
        borderColor: tokens.colors.dangerBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.xs,
      },
      info: {
        backgroundColor: tokens.colors.infoSoft,
        borderColor: tokens.colors.infoBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.xs,
      },
      success: {
        backgroundColor: tokens.colors.successSoft,
        borderColor: tokens.colors.successBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.xs,
      },
      warning: {
        backgroundColor: tokens.colors.warningSoft,
        borderColor: tokens.colors.warningBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.xs,
      },
    },
    button: {
      danger: {
        backgroundColor: tokens.colors.dangerSoft,
        borderColor: tokens.colors.dangerBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        minHeight: 44,
        radius: tokens.radius.sm,
      },
      ghost: {
        backgroundColor: "transparent",
        color: tokens.colors.text,
        minHeight: 42,
        radius: tokens.radius.sm,
      },
      primary: {
        backgroundColor: tokens.colors.primary,
        color: tokens.colors.onPrimary,
        minHeight: 44,
        radius: tokens.radius.sm,
      },
      secondary: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.borderStrong,
        borderWidth: 1.5,
        color: tokens.colors.text,
        minHeight: 44,
        radius: tokens.radius.sm,
      },
    },
    card: {
      default: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.sm,
      },
      elevated: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.sm,
      },
      profile: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.sm,
      },
      ticket: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.sm,
      },
    },
    dialog: {
      default: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.lg,
      },
      elevated: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.lg,
      },
    },
    feedback: {
      danger: {
        backgroundColor: tokens.colors.dangerSoft,
        borderColor: tokens.colors.dangerBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.sm,
      },
      info: {
        backgroundColor: tokens.colors.infoSoft,
        borderColor: tokens.colors.infoBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.sm,
      },
      success: {
        backgroundColor: tokens.colors.successSoft,
        borderColor: tokens.colors.successBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.sm,
      },
      warning: {
        backgroundColor: tokens.colors.warningSoft,
        borderColor: tokens.colors.warningBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        radius: tokens.radius.sm,
      },
    },
    input: {
      default: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        color: tokens.colors.text,
        minHeight: 44,
        radius: tokens.radius.sm,
      },
      error: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.dangerBorder,
        borderWidth: 1.5,
        color: tokens.colors.text,
        minHeight: 44,
        radius: tokens.radius.sm,
      },
      search: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        color: tokens.colors.text,
        minHeight: 44,
        radius: tokens.radius.sm,
      },
    },
    listRow: {
      default: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.sm,
      },
      navigation: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.sm,
      },
      selectable: {
        backgroundColor: tokens.colors.surfaceMuted,
        ...noDecorativeBorder,
        radius: tokens.radius.sm,
      },
    },
    sheet: {
      default: {
        backgroundColor: tokens.colors.surface,
        ...noDecorativeBorder,
        radius: tokens.radius.lg,
      },
    },
    surface: {
      default: {
        backgroundColor: tokens.colors.background,
        color: tokens.colors.text,
      },
      muted: {
        backgroundColor: tokens.colors.surfaceMuted,
        color: tokens.colors.text,
      },
      raised: {
        backgroundColor: tokens.colors.surface,
        color: tokens.colors.text,
      },
    },
  };
}
