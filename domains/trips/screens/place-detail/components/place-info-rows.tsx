import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import type { PlaceInfoLink } from "@/features/trips";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";

const linkIcons: Record<
  PlaceInfoLink["id"],
  keyof typeof MaterialIcons.glyphMap
> = {
  map: "map",
  source: "link",
  baidu_baike: "menu-book",
  dianping: "store",
  mafengwo: "flight",
  ctrip: "confirmation-number",
};

type DetailRowProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  value?: number | string;
};

type RecordMetricProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress?: () => void;
  value: string;
};
export function DetailRow({
  icon,
  label,
  styles,
  value,
}: DetailRowProps & { styles: ReturnType<typeof createPlaceDetailStyles> }) {
  const theme = useAppTheme();
  if (value === undefined || value === "") {
    return null;
  }

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <MaterialIcons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

export function PlaceholderDetailRow({
  icon,
  label,
  styles,
  visible = true,
}: Pick<DetailRowProps, "icon" | "label"> & {
  styles: ReturnType<typeof createPlaceDetailStyles>;
  visible?: boolean;
}) {
  const theme = useAppTheme();
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <MaterialIcons name={icon} size={18} color={theme.colors.primary} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.placeholderText}>待补充</Text>
      </View>
    </View>
  );
}

export function RecordMetric({
  icon,
  label,
  onPress,
  styles,
  value,
}: RecordMetricProps & { styles: ReturnType<typeof createPlaceDetailStyles> }) {
  const theme = useAppTheme();
  const metricContent = (
    <>
      <View style={styles.recordMetricIcon}>
        <MaterialIcons name={icon} size={17} color={theme.colors.primary} />
      </View>
      <Text style={styles.recordMetricValue}>{value}</Text>
      <Text style={styles.recordMetricLabel}>{label}</Text>
    </>
  );

  if (!onPress) {
    return <View style={styles.recordMetric}>{metricContent}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}，点击记录`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.recordMetric,
        pressed && { opacity: 0.7 },
      ]}
    >
      {metricContent}
    </Pressable>
  );
}

export function InfoLinkContent({
  link,
  styles,
}: {
  link: PlaceInfoLink;
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const theme = useAppTheme();
  return (
    <>
      <View style={styles.linkIcon}>
        <MaterialIcons
          name={linkIcons[link.id]}
          size={20}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.linkCopy}>
        <Text numberOfLines={1} style={styles.itemTitle}>
          {link.title}
        </Text>
        <Text numberOfLines={1} style={styles.mutedText}>
          {link.detail}
        </Text>
      </View>
      <MaterialIcons
        name="chevron-right"
        size={18}
        color={theme.colors.textSubtle}
      />
    </>
  );
}
