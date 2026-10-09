export const baseDesignTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 20,
    xl: 28,
    xxl: 36,
  },
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    pill: 999,
  },
  typography: {
    screenTitle: { fontSize: 32, lineHeight: 40 },
    cardTitle: { fontSize: 20, lineHeight: 28 },
    sectionTitle: { fontSize: 16, lineHeight: 24 },
    body: { fontSize: 15, lineHeight: 22 },
    caption: { fontSize: 13, lineHeight: 18 },
  },
  layout: {
    contentPadding: 20,
    maxContentWidth: 620,
    tabBarBaseHeight: 64,
    bottomActionClearance: 164,
  },
  motion: {
    duration: {
      fast: 120,
      normal: 200,
      slow: 320,
    },
    spring: {
      responsive: {
        damping: 18,
        stiffness: 420,
      },
      gentle: {
        damping: 20,
        stiffness: 260,
      },
    },
  },
} as const;
