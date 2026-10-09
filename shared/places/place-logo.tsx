import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { StyleSheet, Text, View } from "react-native";

import {
  getFallbackPlaceKind,
  type TripPlaceCategory,
  type TripPlaceIconKey,
} from "@/features/trips";

type PlaceLogoProps = {
  category?: TripPlaceCategory;
  iconKey?: TripPlaceIconKey;
  size?: number;
};

type IconType = "material" | "emoji";

type PlaceLogoTheme = {
  backgroundColor: string;
  color: string;
  icon: string;
  iconType: IconType;
};

const iconThemes: Record<TripPlaceIconKey, PlaceLogoTheme> = {
  attraction: {
    icon: "🎡",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    iconType: "emoji",
  },
  landmark: {
    icon: "🏔️",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    iconType: "emoji",
  },
  museum: {
    icon: "🏛️",
    color: "#7C3AED",
    backgroundColor: "#F5F3FF",
    iconType: "emoji",
  },
  park: {
    icon: "park",
    color: "#059669",
    backgroundColor: "#ECFDF5",
    iconType: "material",
  },
  viewpoint: {
    icon: "🌅",
    color: "#0891B2",
    backgroundColor: "#ECFEFF",
    iconType: "emoji",
  },
  temple: {
    icon: "temple_buddhist",
    color: "#A16207",
    backgroundColor: "#FEFCE8",
    iconType: "material",
  },
  mountain: {
    icon: "terrain",
    color: "#059669",
    backgroundColor: "#ECFDF5",
    iconType: "material",
  },
  water: {
    icon: "water",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    iconType: "material",
  },
  sea: {
    icon: "🌊",
    color: "#0891B2",
    backgroundColor: "#ECFEFF",
    iconType: "emoji",
  },
  beach: {
    icon: "beach_access",
    color: "#CA8A04",
    backgroundColor: "#FEFCE8",
    iconType: "material",
  },
  island: {
    icon: "🏝️",
    color: "#10B981",
    backgroundColor: "#ECFDF5",
    iconType: "emoji",
  },
  zoo: {
    icon: "pets",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "material",
  },
  aquarium: {
    icon: "🐠",
    color: "#0284C7",
    backgroundColor: "#F0F9FF",
    iconType: "emoji",
  },
  themepark: {
    icon: "🎡",
    color: "#DB2777",
    backgroundColor: "#FDF2F8",
    iconType: "emoji",
  },
  ancient: {
    icon: "🏯",
    color: "#D97706",
    backgroundColor: "#FFFBEB",
    iconType: "emoji",
  },
  cave: {
    icon: "🕳️",
    color: "#78716C",
    backgroundColor: "#FAFAF9",
    iconType: "emoji",
  },

  restaurant: {
    icon: "🍴",
    color: "#DC2626",
    backgroundColor: "#FEF2F2",
    iconType: "emoji",
  },
  cafe: {
    icon: "☕",
    color: "#B45309",
    backgroundColor: "#FFF7ED",
    iconType: "emoji",
  },
  bar: {
    icon: "🍸",
    color: "#9333EA",
    backgroundColor: "#FAF5FF",
    iconType: "emoji",
  },
  hotpot: {
    icon: "🍲",
    color: "#DC2626",
    backgroundColor: "#FEF2F2",
    iconType: "emoji",
  },
  bbq: {
    icon: "🍖",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "emoji",
  },
  japanese: {
    icon: "🍣",
    color: "#E11D48",
    backgroundColor: "#FFF1F2",
    iconType: "emoji",
  },
  korean: {
    icon: "🍱",
    color: "#D97706",
    backgroundColor: "#FFFBEB",
    iconType: "emoji",
  },
  western: {
    icon: "🥩",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    iconType: "emoji",
  },
  seafood: {
    icon: "🦐",
    color: "#0891B2",
    backgroundColor: "#ECFEFF",
    iconType: "emoji",
  },
  buffet: {
    icon: "🍽️",
    color: "#CA8A04",
    backgroundColor: "#FEFCE8",
    iconType: "emoji",
  },
  noodles: {
    icon: "🍜",
    color: "#D97706",
    backgroundColor: "#FFFBEB",
    iconType: "emoji",
  },
  fastfood: {
    icon: "🍔",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "emoji",
  },
  tea: {
    icon: "🧋",
    color: "#059669",
    backgroundColor: "#ECFDF5",
    iconType: "emoji",
  },
  dessert: {
    icon: "🍰",
    color: "#DB2777",
    backgroundColor: "#FDF2F8",
    iconType: "emoji",
  },
  bakery: {
    icon: "🥐",
    color: "#D97706",
    backgroundColor: "#FFFBEB",
    iconType: "emoji",
  },

  hotel: {
    icon: "🏨",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    iconType: "emoji",
  },
  guesthouse: {
    icon: "🏠",
    color: "#0F766E",
    backgroundColor: "#F0FDFA",
    iconType: "emoji",
  },
  hostel: {
    icon: "🛏️",
    color: "#0F766E",
    backgroundColor: "#F0FDFA",
    iconType: "emoji",
  },
  camping: {
    icon: "🏕️",
    color: "#059669",
    backgroundColor: "#ECFDF5",
    iconType: "emoji",
  },
  villa: {
    icon: "🏡",
    color: "#D97706",
    backgroundColor: "#FFFBEB",
    iconType: "emoji",
  },
  resort: {
    icon: "pool",
    color: "#0284C7",
    backgroundColor: "#F0F9FF",
    iconType: "material",
  },

  airport: {
    icon: "local_airport",
    color: "#0284C7",
    backgroundColor: "#F0F9FF",
    iconType: "material",
  },
  train: {
    icon: "train",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    iconType: "material",
  },
  subway: {
    icon: "subway",
    color: "#16A34A",
    backgroundColor: "#F0FDF4",
    iconType: "material",
  },
  bus: {
    icon: "directions_bus",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "material",
  },
  car: {
    icon: "directions_car",
    color: "#475569",
    backgroundColor: "#F8FAFC",
    iconType: "material",
  },
  ferry: {
    icon: "directions_boat",
    color: "#0891B2",
    backgroundColor: "#ECFEFF",
    iconType: "material",
  },
  bike: {
    icon: "directions_bike",
    color: "#16A34A",
    backgroundColor: "#F0FDF4",
    iconType: "material",
  },
  taxi: {
    icon: "🚕",
    color: "#CA8A04",
    backgroundColor: "#FEFCE8",
    iconType: "emoji",
  },
  charging: {
    icon: "🔋",
    color: "#16A34A",
    backgroundColor: "#F0FDF4",
    iconType: "emoji",
  },
  gas: {
    icon: "⛽",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "emoji",
  },
  parking: {
    icon: "🅿️",
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
    iconType: "emoji",
  },

  shopping: {
    icon: "🛍️",
    color: "#C026D3",
    backgroundColor: "#FDF4FF",
    iconType: "emoji",
  },
  mall: {
    icon: "🏬",
    color: "#DB2777",
    backgroundColor: "#FDF2F8",
    iconType: "emoji",
  },
  supermarket: {
    icon: "🛒",
    color: "#D97706",
    backgroundColor: "#FFFBEB",
    iconType: "emoji",
  },
  market: {
    icon: "🏪",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "emoji",
  },
  electronics: {
    icon: "📱",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    iconType: "emoji",
  },
  clothing: {
    icon: "👕",
    color: "#8B5CF6",
    backgroundColor: "#F5F3FF",
    iconType: "emoji",
  },

  school: {
    icon: "🏫",
    color: "#7C3AED",
    backgroundColor: "#F5F3FF",
    iconType: "emoji",
  },
  university: {
    icon: "🎓",
    color: "#6D28D9",
    backgroundColor: "#EDE9FE",
    iconType: "emoji",
  },
  library: {
    icon: "📚",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    iconType: "emoji",
  },
  research: {
    icon: "🔬",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    iconType: "emoji",
  },

  hospital: {
    icon: "🏥",
    color: "#DC2626",
    backgroundColor: "#FEF2F2",
    iconType: "emoji",
  },
  clinic: {
    icon: "🩺",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "emoji",
  },
  pharmacy: {
    icon: "💊",
    color: "#059669",
    backgroundColor: "#ECFDF5",
    iconType: "emoji",
  },
  dentist: {
    icon: "🦷",
    color: "#0891B2",
    backgroundColor: "#ECFEFF",
    iconType: "emoji",
  },

  place: {
    icon: "place",
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
    iconType: "material",
  },
  bank: {
    icon: "🏦",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    iconType: "emoji",
  },
  atm: {
    icon: "local_atm",
    color: "#16A34A",
    backgroundColor: "#F0FDF4",
    iconType: "material",
  },
  insurance: {
    icon: "security",
    color: "#2563EB",
    backgroundColor: "#EFF6FF",
    iconType: "material",
  },
  delivery: {
    icon: "📦",
    color: "#EA580C",
    backgroundColor: "#FFF7ED",
    iconType: "emoji",
  },
  laundry: {
    icon: "local_laundry_service",
    color: "#0891B2",
    backgroundColor: "#ECFEFF",
    iconType: "material",
  },
  beauty: {
    icon: "💇",
    color: "#DB2777",
    backgroundColor: "#FDF2F8",
    iconType: "emoji",
  },
  repair: {
    icon: "🔧",
    color: "#78716C",
    backgroundColor: "#FAFAF9",
    iconType: "emoji",
  },
  government: {
    icon: "⚖️",
    color: "#475569",
    backgroundColor: "#F8FAFC",
    iconType: "emoji",
  },
  embassy: {
    icon: "flag",
    color: "#DC2626",
    backgroundColor: "#FEF2F2",
    iconType: "material",
  },
  toilet: {
    icon: "wc",
    color: "#6B7280",
    backgroundColor: "#F9FAFB",
    iconType: "material",
  },
  residential: {
    icon: "🏘️",
    color: "#0F766E",
    backgroundColor: "#F0FDFA",
    iconType: "emoji",
  },
  office: {
    icon: "🏢",
    color: "#4F46E5",
    backgroundColor: "#EEF2FF",
    iconType: "emoji",
  },
};

export function getPlaceLogoTheme(
  iconKey?: TripPlaceIconKey,
  category?: TripPlaceCategory,
): PlaceLogoTheme {
  const resolvedIconKey = iconKey ?? getFallbackPlaceKind(category).iconKey;
  return iconThemes[resolvedIconKey] ?? iconThemes.place;
}

export function PlaceLogo({ category, iconKey, size = 38 }: PlaceLogoProps) {
  const theme = getPlaceLogoTheme(iconKey, category);
  const materialIconSize = Math.max(17, Math.round(size * 0.52));
  const emojiIconSize = Math.max(12, Math.round(size * 0.46));

  return (
    <View
      style={[
        styles.logo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.backgroundColor,
        },
      ]}
    >
      {theme.iconType === "material" ? (
        <MaterialIcons
          name={theme.icon as keyof typeof MaterialIcons.glyphMap}
          size={materialIconSize}
          color={theme.color}
        />
      ) : (
        <Text
          style={[
            styles.emoji,
            {
              width: size,
              height: size,
              fontSize: emojiIconSize,
              lineHeight: size,
            },
          ]}
        >
          {theme.icon}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  emoji: {
    includeFontPadding: false,
    textAlign: "center",
    textAlignVertical: "center",
  },
});
