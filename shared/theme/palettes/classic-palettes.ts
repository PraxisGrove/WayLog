/**
 * WayLog classic palettes.
 *
 * Classic palettes control the current simple-mode brand and decorative
 * colors. Stable semantic colors such as success, warning and danger live in
 * shared/theme/semantic-colors.ts so their meaning does not change with a
 * palette.
 */

export type ClassicPaletteModeColors = {
  focusRing: string;
  navigation: {
    activeBackground: string;
    activeBorder: string;
    floatingBorder: string;
  };
  onPrimary: string;
  primary: string;
  primaryBorder: string;
  primaryPressed: string;
  primarySoft: string;
  ticket: {
    background: string;
    dash: string;
    featured: {
      accentText: string;
      dashColor: string;
      heroBackground: string;
      heroMutedText: string;
      heroPattern: string;
      heroText: string;
      paperBackground: string;
      paperPressed: string;
      paperText: string;
      punchBorder: string;
      statBackground: string;
    };
    pressed: string;
    stub: string;
    stubPressed: string;
  };
};

export type ClassicPalette = {
  description: string;
  emoji: string;
  id: string;
  modes: {
    dark: ClassicPaletteModeColors;
    light: ClassicPaletteModeColors;
  };
  name: string;
};

const featuredMeasurements = {
  dashSegmentLength: 14,
  dashSegmentThickness: 2,
  seamHeight: 30,
  seamSplitY: 15,
} as const;

/** Five complete classic palettes, each with coordinated light and dark colors. */
export const CLASSIC_PALETTES: ClassicPalette[] = [
  {
    id: "warm",
    name: "陶橙",
    emoji: "橙",
    description: "赤陶、暖阳、旅途余晖",
    modes: {
      light: {
        primary: "#C2410C",
        primaryPressed: "#9A3412",
        primarySoft: "#FFF4E8",
        primaryBorder: "#FED7AA",
        onPrimary: "#FFFFFF",
        focusRing: "rgba(194, 65, 12, 0.28)",
        navigation: {
          activeBackground: "#FDE7D7",
          activeBorder: "#F7C5A5",
          floatingBorder: "rgba(255, 255, 255, 0.94)",
        },
        ticket: {
          background: "#FFFBF5",
          pressed: "#FFF2E5",
          stub: "#FCE1D2",
          stubPressed: "#F6CDB8",
          dash: "#B9A79D",
          featured: {
            heroBackground: "#33466F",
            heroMutedText: "#C7D5EB",
            heroPattern: "#6982AC",
            heroText: "#FFFFFF",
            paperBackground: "#FFFBF5",
            paperPressed: "#FFF1E5",
            paperText: "#20283A",
            statBackground: "#FFF0E8",
            accentText: "#9B6756",
            dashColor: "#C7B4A9",
            punchBorder: "#DABEB2",
          },
        },
      },
      dark: {
        primary: "#FB923C",
        primaryPressed: "#FDBA74",
        primarySoft: "#3D2417",
        primaryBorder: "#7C3E1D",
        onPrimary: "#271207",
        focusRing: "rgba(251, 146, 60, 0.34)",
        navigation: {
          activeBackground: "rgba(251, 146, 60, 0.20)",
          activeBorder: "rgba(251, 146, 60, 0.32)",
          floatingBorder: "rgba(251, 146, 60, 0.20)",
        },
        ticket: {
          background: "#211B1A",
          pressed: "#2D221E",
          stub: "#3B2118",
          stubPressed: "#4B2A1D",
          dash: "#776056",
          featured: {
            heroBackground: "#283B63",
            heroMutedText: "#B8C9E4",
            heroPattern: "#607AA6",
            heroText: "#FFFFFF",
            paperBackground: "#211B2A",
            paperPressed: "#2D2538",
            paperText: "#F5EDF8",
            statBackground: "#2B2338",
            accentText: "#C9AFC5",
            dashColor: "#62576F",
            punchBorder: "#6E5C7B",
          },
        },
      },
    },
  },
  {
    id: "nature",
    name: "松绿",
    emoji: "绿",
    description: "山野、青岚、雨后松林",
    modes: {
      light: {
        primary: "#047857",
        primaryPressed: "#065F46",
        primarySoft: "#ECFDF5",
        primaryBorder: "#A7F3D0",
        onPrimary: "#FFFFFF",
        focusRing: "rgba(4, 120, 87, 0.26)",
        navigation: {
          activeBackground: "#DDF7EA",
          activeBorder: "#B7E7D0",
          floatingBorder: "rgba(255, 255, 255, 0.94)",
        },
        ticket: {
          background: "#F7FCF8",
          pressed: "#EAF7EE",
          stub: "#D9F3E5",
          stubPressed: "#C3E8D4",
          dash: "#9DB9AA",
          featured: {
            heroBackground: "#28574E",
            heroMutedText: "#C1DDD6",
            heroPattern: "#5E8B80",
            heroText: "#FFFFFF",
            paperBackground: "#F7FCF8",
            paperPressed: "#EAF7EE",
            paperText: "#172B27",
            statBackground: "#E8F6ED",
            accentText: "#50786A",
            dashColor: "#A9C2B5",
            punchBorder: "#B5D2C1",
          },
        },
      },
      dark: {
        primary: "#34D399",
        primaryPressed: "#6EE7B7",
        primarySoft: "#10372C",
        primaryBorder: "#1D6A4E",
        onPrimary: "#08241B",
        focusRing: "rgba(52, 211, 153, 0.30)",
        navigation: {
          activeBackground: "rgba(52, 211, 153, 0.18)",
          activeBorder: "rgba(52, 211, 153, 0.30)",
          floatingBorder: "rgba(52, 211, 153, 0.18)",
        },
        ticket: {
          background: "#17241F",
          pressed: "#1D3028",
          stub: "#15392C",
          stubPressed: "#1B4938",
          dash: "#557569",
          featured: {
            heroBackground: "#204E46",
            heroMutedText: "#B7D9D1",
            heroPattern: "#52877B",
            heroText: "#FFFFFF",
            paperBackground: "#182722",
            paperPressed: "#21342C",
            paperText: "#EAF8F2",
            statBackground: "#20362E",
            accentText: "#A5C9BB",
            dashColor: "#4F6D62",
            punchBorder: "#527B6B",
          },
        },
      },
    },
  },
  {
    id: "ocean",
    name: "海蓝",
    emoji: "蓝",
    description: "海湾、晴空、沿岸长风",
    modes: {
      light: {
        primary: "#0369A1",
        primaryPressed: "#075985",
        primarySoft: "#EAF7FF",
        primaryBorder: "#BAE6FD",
        onPrimary: "#FFFFFF",
        focusRing: "rgba(3, 105, 161, 0.26)",
        navigation: {
          activeBackground: "#DDEFF9",
          activeBorder: "#B8DDED",
          floatingBorder: "rgba(255, 255, 255, 0.94)",
        },
        ticket: {
          background: "#F7FBFD",
          pressed: "#E9F4F9",
          stub: "#DCEFF7",
          stubPressed: "#C7E2EE",
          dash: "#9DB2BE",
          featured: {
            heroBackground: "#214F74",
            heroMutedText: "#C3DCEC",
            heroPattern: "#5C87A8",
            heroText: "#FFFFFF",
            paperBackground: "#F7FBFD",
            paperPressed: "#EAF4F9",
            paperText: "#172A38",
            statBackground: "#E8F3F8",
            accentText: "#527487",
            dashColor: "#A7BDC8",
            punchBorder: "#B4CFDA",
          },
        },
      },
      dark: {
        primary: "#38BDF8",
        primaryPressed: "#7DD3FC",
        primarySoft: "#12354A",
        primaryBorder: "#1D6282",
        onPrimary: "#06202D",
        focusRing: "rgba(56, 189, 248, 0.32)",
        navigation: {
          activeBackground: "rgba(56, 189, 248, 0.18)",
          activeBorder: "rgba(56, 189, 248, 0.30)",
          floatingBorder: "rgba(56, 189, 248, 0.18)",
        },
        ticket: {
          background: "#17242C",
          pressed: "#1D303A",
          stub: "#153447",
          stubPressed: "#1A4359",
          dash: "#526F7F",
          featured: {
            heroBackground: "#1D4768",
            heroMutedText: "#B7D7E8",
            heroPattern: "#4D80A1",
            heroText: "#FFFFFF",
            paperBackground: "#17262F",
            paperPressed: "#1E333E",
            paperText: "#ECF8FC",
            statBackground: "#1E3541",
            accentText: "#A7C5D3",
            dashColor: "#4E6E7D",
            punchBorder: "#52798A",
          },
        },
      },
    },
  },
  {
    id: "lavender",
    name: "暮紫",
    emoji: "紫",
    description: "暮色、鸢尾、灵感微光",
    modes: {
      light: {
        primary: "#7C3AED",
        primaryPressed: "#6D28D9",
        primarySoft: "#F5F1FF",
        primaryBorder: "#DDD0FE",
        onPrimary: "#FFFFFF",
        focusRing: "rgba(124, 58, 237, 0.25)",
        navigation: {
          activeBackground: "#ECE5FC",
          activeBorder: "#D8CAF8",
          floatingBorder: "rgba(255, 255, 255, 0.94)",
        },
        ticket: {
          background: "#FBF9FF",
          pressed: "#F2EDFC",
          stub: "#EAE1FA",
          stubPressed: "#DCCFF4",
          dash: "#AFA5BF",
          featured: {
            heroBackground: "#4A3F78",
            heroMutedText: "#D5CCEC",
            heroPattern: "#8275AD",
            heroText: "#FFFFFF",
            paperBackground: "#FBF9FF",
            paperPressed: "#F1ECFA",
            paperText: "#282238",
            statBackground: "#EFE9FA",
            accentText: "#746588",
            dashColor: "#BBB0C8",
            punchBorder: "#C9BBDC",
          },
        },
      },
      dark: {
        primary: "#A78BFA",
        primaryPressed: "#C4B5FD",
        primarySoft: "#302653",
        primaryBorder: "#58449A",
        onPrimary: "#1D1536",
        focusRing: "rgba(167, 139, 250, 0.32)",
        navigation: {
          activeBackground: "rgba(167, 139, 250, 0.18)",
          activeBorder: "rgba(167, 139, 250, 0.30)",
          floatingBorder: "rgba(167, 139, 250, 0.18)",
        },
        ticket: {
          background: "#211E2B",
          pressed: "#2B2739",
          stub: "#31284C",
          stubPressed: "#40345F",
          dash: "#6B617C",
          featured: {
            heroBackground: "#423765",
            heroMutedText: "#D0C7E5",
            heroPattern: "#786A9C",
            heroText: "#FFFFFF",
            paperBackground: "#221E2E",
            paperPressed: "#2D283C",
            paperText: "#F6F1FC",
            statBackground: "#2E2840",
            accentText: "#C2B5D3",
            dashColor: "#635A73",
            punchBorder: "#716382",
          },
        },
      },
    },
  },
  {
    id: "cherry",
    name: "樱粉",
    emoji: "粉",
    description: "春樱、花信、轻盈柔光",
    modes: {
      light: {
        primary: "#BE185D",
        primaryPressed: "#9D174D",
        primarySoft: "#FFF0F6",
        primaryBorder: "#FBCFE8",
        onPrimary: "#FFFFFF",
        focusRing: "rgba(190, 24, 93, 0.24)",
        navigation: {
          activeBackground: "#F9E2EC",
          activeBorder: "#F3C5D9",
          floatingBorder: "rgba(255, 255, 255, 0.94)",
        },
        ticket: {
          background: "#FFF9FB",
          pressed: "#FCECF3",
          stub: "#F8DDE9",
          stubPressed: "#F1C9DB",
          dash: "#B9A3AD",
          featured: {
            heroBackground: "#70405A",
            heroMutedText: "#E8CDD9",
            heroPattern: "#A9758C",
            heroText: "#FFFFFF",
            paperBackground: "#FFF9FB",
            paperPressed: "#FCECF2",
            paperText: "#34232B",
            statBackground: "#F9E8EF",
            accentText: "#8B6172",
            dashColor: "#C6AFB9",
            punchBorder: "#D7BBC7",
          },
        },
      },
      dark: {
        primary: "#F472B6",
        primaryPressed: "#F9A8D4",
        primarySoft: "#47223A",
        primaryBorder: "#853D68",
        onPrimary: "#2A1020",
        focusRing: "rgba(244, 114, 182, 0.31)",
        navigation: {
          activeBackground: "rgba(244, 114, 182, 0.18)",
          activeBorder: "rgba(244, 114, 182, 0.30)",
          floatingBorder: "rgba(244, 114, 182, 0.18)",
        },
        ticket: {
          background: "#291D24",
          pressed: "#36252E",
          stub: "#432337",
          stubPressed: "#552C45",
          dash: "#78606C",
          featured: {
            heroBackground: "#653B53",
            heroMutedText: "#E7CAD8",
            heroPattern: "#9D6C83",
            heroText: "#FFFFFF",
            paperBackground: "#2A1E26",
            paperPressed: "#382832",
            paperText: "#FCF1F6",
            statBackground: "#3A2932",
            accentText: "#D1B1C0",
            dashColor: "#715A66",
            punchBorder: "#806370",
          },
        },
      },
    },
  },
];

export const DEFAULT_CLASSIC_PALETTE_ID = "warm";

export function getClassicPaletteById(id: string): ClassicPalette {
  return (
    CLASSIC_PALETTES.find((palette) => palette.id === id) ?? CLASSIC_PALETTES[0]
  );
}

export function getClassicPaletteMode(
  palette: ClassicPalette,
  mode: "dark" | "light",
) {
  return {
    ...palette.modes[mode],
    ticket: {
      ...palette.modes[mode].ticket,
      featured: {
        ...palette.modes[mode].ticket.featured,
        ...featuredMeasurements,
      },
    },
  };
}
