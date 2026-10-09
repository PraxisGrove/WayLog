import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, Text, View } from "react-native";
import type { createStyles } from "../../trip-detail.styles";
import { TRIP_NOTEBOOK_PREVIEW_MAX_LINES } from "./constants";

type TripNotebookPreviewCardProps = {
  noteLineCount: number;
  onPress: () => void;
  previewLines: string[];
  styles: ReturnType<typeof createStyles>;
};

export function TripNotebookPreviewCard({
  noteLineCount,
  onPress,
  previewLines,
  styles,
}: TripNotebookPreviewCardProps) {
  return (
    <Pressable
      accessibilityLabel="打开行程记事本"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tripNotebookPreviewCard,
        pressed && styles.tripNotebookPreviewCardPressed,
      ]}
    >
      <View style={styles.tripNotebookPreviewPaper}>
        <View style={styles.tripNotebookPreviewHeader}>
          <View style={styles.tripNotebookPreviewIcon}>
            <MaterialIcons name="notes" size={19} color="#6c5136" />
          </View>
          <View style={styles.tripNotebookPreviewCopy}>
            <Text style={styles.tripNotebookPreviewTitle}>行程记事本</Text>
            <Text style={styles.tripNotebookPreviewMeta}>
              行程总备注 · {noteLineCount} 条地点备注
            </Text>
          </View>
          <View style={styles.tripNotebookPreviewArrow}>
            <MaterialIcons name="chevron-right" size={20} color="#7a5a34" />
          </View>
        </View>
        <View style={styles.tripNotebookPreviewLines}>
          {previewLines.length > 0 ? (
            previewLines
              .slice(0, TRIP_NOTEBOOK_PREVIEW_MAX_LINES)
              .map((line) => (
                <View key={line} style={styles.tripNotebookPreviewLineRow}>
                  <Text
                    numberOfLines={1}
                    style={styles.tripNotebookPreviewLine}
                  >
                    {line}
                  </Text>
                </View>
              ))
          ) : (
            <Text style={styles.tripNotebookPreviewEmpty}>
              写下整趟行程的提醒、灵感、重要事项
            </Text>
          )}
        </View>
        <View style={styles.tripNotebookPreviewFooter}>
          <Text style={styles.tripNotebookPreviewHint}>点按编辑</Text>
          <Text style={styles.tripNotebookPreviewCount}>
            {previewLines.length || 0} 条摘要
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
