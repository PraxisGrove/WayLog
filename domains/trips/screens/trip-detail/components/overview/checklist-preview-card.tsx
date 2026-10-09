import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  type GestureResponderEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import type { TripChecklistItem } from "@/features/trips";
import { skinSlotAdapterIds } from "@/shared/theme/skin-slot-registry";
import type { AppTheme } from "@/shared/theme/theme";
import type { createStyles } from "../../trip-detail.styles";

type ChecklistPreviewCardProps = {
  adapterId?: string;
  completedCount: number;
  items: TripChecklistItem[];
  onOpenChecklist: () => void;
  onTouchCancel: () => void;
  onTouchEnd: () => void;
  onTouchMove: (event: GestureResponderEvent) => void;
  onTouchStart: (event: GestureResponderEvent) => void;
  styles: ReturnType<typeof createStyles>;
  theme: AppTheme;
};

export function ChecklistPreviewCard({
  adapterId,
  completedCount,
  items,
  onOpenChecklist,
  onTouchCancel,
  onTouchEnd,
  onTouchMove,
  onTouchStart,
  styles,
  theme,
}: ChecklistPreviewCardProps) {
  const isWireframe =
    adapterId === skinSlotAdapterIds.tripDetailChecklistPreview.default;

  return (
    <View
      style={[
        styles.squareOverviewCard,
        styles.notebookPreviewCard,
        isWireframe && styles.wireframeNotebookPreviewCard,
      ]}
    >
      {isWireframe ? null : <View style={styles.notebookPreviewBinding} />}
      <Pressable
        accessibilityLabel="打开出行清单"
        accessibilityRole="button"
        onPress={onOpenChecklist}
        style={({ pressed }) => [
          styles.notebookPreviewHeaderButton,
          isWireframe && styles.wireframeNotebookPreviewHeaderButton,
          pressed && styles.squareOverviewHeaderPressed,
        ]}
      >
        <Text
          style={[
            styles.notebookPreviewTitle,
            isWireframe && styles.wireframeNotebookPreviewTitle,
          ]}
        >
          出行清单
        </Text>
        <Text
          style={[
            styles.notebookPreviewCount,
            isWireframe && styles.wireframeNotebookPreviewCount,
          ]}
        >
          {completedCount}/{items.length}
        </Text>
      </Pressable>
      <ScrollView
        contentContainerStyle={styles.notebookPreviewLinesContent}
        nestedScrollEnabled
        onTouchCancel={onTouchCancel}
        onTouchEnd={onTouchEnd}
        onTouchMove={onTouchMove}
        onTouchStart={onTouchStart}
        showsVerticalScrollIndicator={false}
        style={[
          styles.notebookPreviewLines,
          isWireframe && styles.wireframeNotebookPreviewLines,
        ]}
      >
        {items.map((item) => (
          <Pressable
            accessibilityLabel={`打开出行清单，${item.title}`}
            accessibilityRole="button"
            key={item.id}
            onPress={onOpenChecklist}
            style={({ pressed }) => [
              styles.notebookPreviewRow,
              isWireframe && styles.wireframeNotebookPreviewRow,
              pressed && styles.notebookPreviewRowPressed,
            ]}
          >
            <MaterialIcons
              name={item.isCompleted ? "check-box" : "check-box-outline-blank"}
              size={15}
              color={
                item.isCompleted
                  ? theme.colors.primary
                  : theme.colors.textSubtle
              }
            />
            <Text
              numberOfLines={1}
              style={[
                styles.notebookPreviewItem,
                isWireframe && styles.wireframeNotebookPreviewItem,
                item.isCompleted && styles.notebookPreviewItemDone,
                isWireframe &&
                  item.isCompleted &&
                  styles.wireframeNotebookPreviewItemDone,
              ]}
            >
              {item.title}
            </Text>
          </Pressable>
        ))}
        {items.length === 0 ? (
          <Text style={styles.notebookPreviewEmpty}>还没有清单物品</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
