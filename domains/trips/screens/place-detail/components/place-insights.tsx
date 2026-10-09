import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Text, View } from "react-native";
import { useAppTheme } from "@/shared/theme/use-app-theme";

import type { createPlaceDetailStyles } from "../trip-place-detail.styles";
export function InsightPair({
  cautions,
  highlights,
  styles,
}: {
  cautions?: string[];
  highlights?: string[];
  styles: ReturnType<typeof createPlaceDetailStyles>;
}) {
  const highlightItems = highlights?.length ? highlights : ["亮点待记录"];
  const cautionItems = cautions?.length ? cautions : ["避坑待记录"];

  return (
    <View style={styles.insightGrid}>
      <InsightBox
        icon="sentiment-satisfied-alt"
        items={highlightItems}
        styles={styles}
        title="值得去"
        tone="good"
      />
      <InsightBox
        icon="report-problem"
        items={cautionItems}
        styles={styles}
        title="要注意"
        tone="caution"
      />
    </View>
  );
}

export function InsightBox({
  icon,
  items,
  styles,
  title,
  tone,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  items: string[];
  styles: ReturnType<typeof createPlaceDetailStyles>;
  title: string;
  tone: "caution" | "good";
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.insightBox,
        tone === "good" ? styles.insightBoxGood : styles.insightBoxCaution,
      ]}
    >
      <View style={styles.insightTitleRow}>
        <MaterialIcons
          name={icon}
          size={18}
          color={tone === "good" ? theme.colors.success : theme.colors.warning}
        />
        <Text style={styles.insightTitle}>{title}</Text>
      </View>
      {items.slice(0, 3).map((item) => (
        <Text key={item} style={styles.insightText}>
          {item}
        </Text>
      ))}
    </View>
  );
}
