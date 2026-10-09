import type { ResolvedDesignTokens } from "../design-tokens";
import type { ComponentRecipes } from "../types";

export function createClassicRecipes(
  tokens: ResolvedDesignTokens,
): ComponentRecipes {
  return {
    badge: {
      danger: {
        backgroundColor: tokens.colors.dangerSoft,
        borderColor: tokens.colors.dangerBorder,
        color: tokens.colors.danger,
        radius: tokens.radius.pill,
      },
      info: {
        backgroundColor: tokens.colors.infoSoft,
        borderColor: tokens.colors.infoBorder,
        color: tokens.colors.info,
        radius: tokens.radius.pill,
      },
      success: {
        backgroundColor: tokens.colors.successSoft,
        borderColor: tokens.colors.successBorder,
        color: tokens.colors.success,
        radius: tokens.radius.pill,
      },
      warning: {
        backgroundColor: tokens.colors.warningSoft,
        borderColor: tokens.colors.warningBorder,
        color: tokens.colors.warning,
        radius: tokens.radius.pill,
      },
    },
    button: {
      danger: {
        backgroundColor: tokens.colors.danger,
        color: tokens.colors.onPrimary,
        minHeight: 46,
        radius: tokens.radius.md,
      },
      ghost: {
        backgroundColor: "transparent",
        color: tokens.colors.primary,
        minHeight: 42,
        radius: tokens.radius.md,
      },
      primary: {
        backgroundColor: tokens.colors.primary,
        color: tokens.colors.onPrimary,
        minHeight: 46,
        radius: tokens.radius.md,
      },
      secondary: {
        backgroundColor: tokens.colors.primarySoft,
        borderColor: tokens.colors.primaryBorder,
        borderWidth: 1,
        color: tokens.colors.primary,
        minHeight: 44,
        radius: tokens.radius.md,
      },
    },
    card: {
      default: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.lg,
      },
      elevated: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.lg,
        shadow: tokens.shadow.card,
      },
      profile: {
        backgroundColor: tokens.colors.glassStrong,
        borderColor: tokens.colors.glassBorder,
        borderWidth: 1,
        radius: tokens.radius.xl,
        shadow: tokens.shadow.floating,
      },
      ticket: {
        backgroundColor: tokens.colors.ticket.background,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.lg,
        shadow: tokens.shadow.card,
      },
    },
    dialog: {
      default: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.lg,
        shadow: tokens.shadow.sheet,
      },
      elevated: {
        backgroundColor: tokens.colors.glassStrong,
        borderColor: tokens.colors.glassBorder,
        borderWidth: 1,
        radius: tokens.radius.xl,
        shadow: tokens.shadow.floating,
      },
    },
    feedback: {
      danger: {
        backgroundColor: tokens.colors.dangerSoft,
        borderColor: tokens.colors.dangerBorder,
        borderWidth: 1,
        color: tokens.colors.danger,
        radius: tokens.radius.md,
      },
      info: {
        backgroundColor: tokens.colors.infoSoft,
        borderColor: tokens.colors.infoBorder,
        borderWidth: 1,
        color: tokens.colors.info,
        radius: tokens.radius.md,
      },
      success: {
        backgroundColor: tokens.colors.successSoft,
        borderColor: tokens.colors.successBorder,
        borderWidth: 1,
        color: tokens.colors.success,
        radius: tokens.radius.md,
      },
      warning: {
        backgroundColor: tokens.colors.warningSoft,
        borderColor: tokens.colors.warningBorder,
        borderWidth: 1,
        color: tokens.colors.warning,
        radius: tokens.radius.md,
      },
    },
    input: {
      default: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        color: tokens.colors.text,
        minHeight: 46,
        radius: tokens.radius.md,
      },
      error: {
        backgroundColor: tokens.colors.dangerSoft,
        borderColor: tokens.colors.dangerBorder,
        borderWidth: 1,
        color: tokens.colors.text,
        minHeight: 46,
        radius: tokens.radius.md,
      },
      search: {
        backgroundColor: tokens.colors.surfaceMuted,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        color: tokens.colors.text,
        minHeight: 44,
        radius: tokens.radius.pill,
      },
    },
    listRow: {
      default: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.md,
      },
      navigation: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.md,
      },
      selectable: {
        backgroundColor: tokens.colors.surfaceMuted,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.md,
      },
    },
    sheet: {
      default: {
        backgroundColor: tokens.colors.surface,
        borderColor: tokens.colors.border,
        borderWidth: 1,
        radius: tokens.radius.xl,
        shadow: tokens.shadow.sheet,
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
        shadow: tokens.shadow.card,
      },
    },
  };
}
