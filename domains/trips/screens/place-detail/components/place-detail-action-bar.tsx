import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  Text,
  View,
} from "react-native";

import { useAppTheme } from "@/shared/theme/use-app-theme";

import { BottomActionButton } from "../place-detail-components";
import type { createPlaceDetailStyles } from "../trip-place-detail.styles";

type PlaceDetailActionBarProps = {
  canRefreshAmapDetails: boolean;
  isCurrentPlaceFavorited: boolean;
  isFavoritePlaceDetail: boolean;
  isMoreMenuMounted: boolean;
  isRefreshingAmap: boolean;
  moreMenuProgress: Animated.Value;
  moreMenuRight: number;
  onCloseMoreMenu: () => void;
  onFavoriteToggle: () => void;
  onOpenExpenses: () => void;
  onOpenNavigation: () => void;
  onOpenPlaceNoteFromMenu: () => void;
  onRefreshAmapFromMenu: () => void;
  onToggleMoreMenu: () => void;
  placeNotePreview: string;
  styles: ReturnType<typeof createPlaceDetailStyles>;
};

export function PlaceDetailActionBar({
  canRefreshAmapDetails,
  isCurrentPlaceFavorited,
  isFavoritePlaceDetail,
  isMoreMenuMounted,
  isRefreshingAmap,
  moreMenuProgress,
  moreMenuRight,
  onCloseMoreMenu,
  onFavoriteToggle,
  onOpenExpenses,
  onOpenNavigation,
  onOpenPlaceNoteFromMenu,
  onRefreshAmapFromMenu,
  onToggleMoreMenu,
  placeNotePreview,
  styles,
}: PlaceDetailActionBarProps) {
  const theme = useAppTheme();

  return (
    <>
      {isMoreMenuMounted ? (
        <>
          <Pressable
            accessibilityLabel="关闭更多操作"
            accessibilityRole="button"
            onPress={onCloseMoreMenu}
            style={styles.moreMenuBackdrop}
          />
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.moreMenu,
              {
                right: moreMenuRight,
                opacity: moreMenuProgress,
                transform: [
                  {
                    translateX: moreMenuProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                  {
                    translateY: moreMenuProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                  {
                    scale: moreMenuProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.moreMenuTitle}>更多操作</Text>
            {!isFavoritePlaceDetail ? (
              <Pressable
                accessibilityLabel={
                  placeNotePreview ? "编辑地点备注" : "添加地点备注"
                }
                accessibilityRole="button"
                onPress={onOpenPlaceNoteFromMenu}
                style={({ pressed }) => [
                  styles.moreMenuItem,
                  pressed && styles.moreMenuItemPressed,
                ]}
              >
                <View style={styles.moreMenuItemIcon}>
                  <MaterialIcons
                    name="edit-note"
                    size={20}
                    color={theme.colors.primary}
                  />
                </View>
                <View style={styles.moreMenuItemCopy}>
                  <Text style={styles.moreMenuItemTitle}>
                    {placeNotePreview ? "编辑备注" : "添加备注"}
                  </Text>
                  <Text style={styles.moreMenuItemHint}>
                    记录这个地点的私人提醒
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={18}
                  color={theme.colors.textSubtle}
                />
              </Pressable>
            ) : null}
            {canRefreshAmapDetails ? (
              <Pressable
                accessibilityLabel={
                  isRefreshingAmap
                    ? "正在刷新高德数据"
                    : "从数据库或高德刷新详情数据"
                }
                accessibilityRole="button"
                disabled={isRefreshingAmap}
                onPress={onRefreshAmapFromMenu}
                style={({ pressed }) => [
                  styles.moreMenuItem,
                  pressed && styles.moreMenuItemPressed,
                  isRefreshingAmap && styles.moreMenuItemDisabled,
                ]}
              >
                <View style={styles.moreMenuItemIcon}>
                  {isRefreshingAmap ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                    />
                  ) : (
                    <MaterialIcons
                      name="refresh"
                      size={20}
                      color={theme.colors.primary}
                    />
                  )}
                </View>
                <View style={styles.moreMenuItemCopy}>
                  <Text style={styles.moreMenuItemTitle}>
                    {isRefreshingAmap ? "正在刷新" : "刷新高德数据"}
                  </Text>
                  <Text style={styles.moreMenuItemHint}>
                    {isRefreshingAmap
                      ? "请稍候，完成后自动同步"
                      : "优先复用一个月内缓存"}
                  </Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={18}
                  color={theme.colors.textSubtle}
                />
              </Pressable>
            ) : !isFavoritePlaceDetail ? null : (
              <Text style={styles.moreMenuEmptyText}>暂无可用操作</Text>
            )}
          </Animated.View>
        </>
      ) : null}
      <View
        style={[
          styles.bottomActionBar,
          {
            backgroundColor: theme.colors.glassStrong,
            borderColor: theme.colors.glassBorder,
          },
        ]}
      >
        <BottomActionButton
          icon={isCurrentPlaceFavorited ? "star" : "star-border"}
          label={isCurrentPlaceFavorited ? "已收藏" : "收藏"}
          onPress={onFavoriteToggle}
          styles={styles}
        />
        <BottomActionButton
          icon="receipt-long"
          label="开销"
          onPress={isFavoritePlaceDetail ? undefined : onOpenExpenses}
          styles={styles}
        />
        <BottomActionButton
          icon="navigation"
          label="导航"
          onPress={onOpenNavigation}
          styles={styles}
        />
        <BottomActionButton
          accessibilityExpanded={isMoreMenuMounted}
          icon="more-horiz"
          isActive={isMoreMenuMounted}
          label="更多"
          onPress={onToggleMoreMenu}
          styles={styles}
        />
      </View>
    </>
  );
}
