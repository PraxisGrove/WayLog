import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { memo, useCallback, useRef, useState } from "react";
import type { GestureResponderEvent } from "react-native";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  createTripPlaceFromFavoritePlace,
  type FavoritePlaceRecord,
  getFavoritePlaces,
  removeFavoritePlaceById,
  setPendingPlaceDetail,
} from "@/features/trips";
import { PlaceLogo } from "@/shared/places/place-logo";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { ConfirmDialog } from "@/shared/ui/confirm-dialog";
import { useScreenContentStyle } from "@/shared/ui/screen-content";
import { ScreenHeader } from "@/shared/ui/screen-header";

const favoritePlaceListScreenLogger = createDiagnosticLogger(
  "favorite-place-list-screen",
);
function formatFavoritePlaceMeta(place: FavoritePlaceRecord): string {
  return [place.category, place.area, place.address]
    .filter(Boolean)
    .join(" · ");
}

function formatFavoritedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "已收藏";
  }

  return `${date.getMonth() + 1} 月 ${date.getDate()} 日收藏`;
}

const SWIPE_OPEN_OFFSET_X = 42;
const SWIPE_CLOSE_OFFSET_X = 96;
const SWIPE_VERTICAL_FAIL_OFFSET_Y = 8;
const SWIPE_OPEN_THRESHOLD = 50;
const SWIPE_PRESS_SUPPRESS_DISTANCE_X = 24;
const SWIPE_PRESS_SUPPRESS_MS = 650;

type FavoritePlaceRowProps = {
  onDelete: (place: FavoritePlaceRecord) => void;
  onPress: (placeId: string) => void;
  place: FavoritePlaceRecord;
};

const FavoritePlaceRow = memo(function FavoritePlaceRow({
  onDelete,
  onPress,
  place,
}: FavoritePlaceRowProps) {
  const theme = useAppTheme();
  const swipeableRef = useRef<Swipeable | null>(null);
  const pressStartRef = useRef({ x: 0, y: 0 });
  const suppressPressUntilRef = useRef(0);

  const closeSwipeable = () => {
    swipeableRef.current?.close();
  };

  const suppressNextPress = () => {
    suppressPressUntilRef.current = Date.now() + SWIPE_PRESS_SUPPRESS_MS;
  };

  const handlePressIn = (event: GestureResponderEvent) => {
    pressStartRef.current = {
      x: event.nativeEvent.pageX ?? 0,
      y: event.nativeEvent.pageY ?? 0,
    };
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    const moveX = Math.abs(
      (event.nativeEvent.pageX ?? 0) - pressStartRef.current.x,
    );
    const moveY = Math.abs(
      (event.nativeEvent.pageY ?? 0) - pressStartRef.current.y,
    );

    if (moveX > SWIPE_PRESS_SUPPRESS_DISTANCE_X && moveX > moveY) {
      suppressNextPress();
    }
  };

  const handlePress = () => {
    if (Date.now() < suppressPressUntilRef.current) {
      return;
    }

    onPress(place.id);
  };

  const renderSwipeActions = (
    progress: Animated.AnimatedInterpolation<number>,
  ) => {
    const actionAnimatedStyle = {
      opacity: progress.interpolate({
        inputRange: [0, 0.35, 1],
        outputRange: [0, 0.45, 1],
        extrapolate: "clamp",
      }),
      transform: [
        {
          translateX: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [26, 0],
            extrapolate: "clamp",
          }),
        },
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.96, 1],
            extrapolate: "clamp",
          }),
        },
      ],
    };

    return (
      <Animated.View style={[styles.swipeActions, actionAnimatedStyle]}>
        <Pressable
          accessibilityLabel={`删除${place.name}`}
          accessibilityRole="button"
          onPress={() => {
            closeSwipeable();
            onDelete(place);
          }}
          style={({ pressed }) => [
            styles.swipeDeleteAction,
            { backgroundColor: theme.colors.dangerSoft },
            pressed && { opacity: 0.8 },
          ]}
        >
          <MaterialIcons
            name="delete-outline"
            size={20}
            color={theme.colors.danger}
          />
          <Text
            style={[
              styles.swipeDeleteActionText,
              { color: theme.colors.danger },
            ]}
          >
            删除
          </Text>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      dragOffsetFromLeftEdge={SWIPE_CLOSE_OFFSET_X}
      dragOffsetFromRightEdge={SWIPE_OPEN_OFFSET_X}
      failOffsetY={[
        -SWIPE_VERTICAL_FAIL_OFFSET_Y,
        SWIPE_VERTICAL_FAIL_OFFSET_Y,
      ]}
      friction={1.18}
      onSwipeableOpenStartDrag={suppressNextPress}
      onSwipeableWillOpen={suppressNextPress}
      overshootFriction={12}
      overshootRight={false}
      renderRightActions={renderSwipeActions}
      rightThreshold={SWIPE_OPEN_THRESHOLD}
    >
      <Pressable
        accessibilityHint="查看地点详情，滑动可删除"
        accessibilityRole="button"
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.placeRow,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
          pressed && { backgroundColor: theme.colors.surfacePressed },
        ]}
      >
        <PlaceLogo
          category={place.category}
          iconKey={place.iconKey}
          size={44}
        />
        <View style={styles.placeCopy}>
          <Text
            numberOfLines={1}
            style={[styles.placeName, { color: theme.colors.text }]}
          >
            {place.name}
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.placeMeta, { color: theme.colors.textMuted }]}
          >
            {formatFavoritePlaceMeta(place)}
          </Text>
          <Text style={[styles.placeTime, { color: theme.colors.textSubtle }]}>
            {formatFavoritedAt(place.favoritedAt)}
          </Text>
        </View>
        <MaterialIcons
          name="chevron-right"
          size={22}
          color={theme.colors.textSubtle}
        />
      </Pressable>
    </Swipeable>
  );
});
FavoritePlaceRow.displayName = "FavoritePlaceRow";

export function FavoritePlaceListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const screenContentStyle = useScreenContentStyle();
  const [favoritePlaces, setFavoritePlaces] = useState<FavoritePlaceRecord[]>(
    [],
  );
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTargetPlace, setDeleteTargetPlace] = useState<
    FavoritePlaceRecord | undefined
  >();
  const [isConfirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadFavoritePlaces = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const localFavoritePlaces = await getFavoritePlaces();
      setFavoritePlaces(localFavoritePlaces);
    } catch (loadError) {
      favoritePlaceListScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to load favorite places.", loadError] },
        "Legacy warning captured",
      );
      setError("读取收藏地点失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavoritePlaces();
    }, [loadFavoritePlaces]),
  );

  const goBack = () => {
    router.back();
  };

  const openFavoritePlaceSearch = () => {
    router.push({
      pathname: "/search",
      params: { scope: "places" },
    });
  };

  const openPlaceDetail = useCallback(
    (placeId: string) => {
      const place = favoritePlaces.find(
        (candidate) => candidate.id === placeId,
      );
      if (place) {
        setPendingPlaceDetail(createTripPlaceFromFavoritePlace(place));
      }

      router.push({
        pathname: "/trips/place",
        params: {
          favoritePlaceId: placeId,
          returnTo: "favorite-places",
        },
      });
    },
    [favoritePlaces, router],
  );

  const askDeleteFavoritePlace = useCallback((place: FavoritePlaceRecord) => {
    setActionMessage("");
    setDeleteTargetPlace(place);
    setConfirmingDelete(true);
  }, []);

  const cancelDeleteFavoritePlace = () => {
    if (isDeleting) {
      return;
    }

    setConfirmingDelete(false);
    setDeleteTargetPlace(undefined);
  };

  const deleteSelectedFavoritePlace = async () => {
    if (!deleteTargetPlace || isDeleting) {
      return;
    }

    const placeToDelete = deleteTargetPlace;
    setDeleting(true);
    setActionMessage("");

    try {
      const nextPlaces = await removeFavoritePlaceById(placeToDelete.id);

      setFavoritePlaces(nextPlaces);
      setActionMessage(`已删除「${placeToDelete.name}」`);
      setDeleteTargetPlace(undefined);
      setConfirmingDelete(false);
    } catch (deleteError) {
      favoritePlaceListScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to delete favorite place.", deleteError] },
        "Legacy warning captured",
      );
      setActionMessage("删除收藏失败，请稍后再试");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[screenContentStyle, styles.content]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          onBack={goBack}
          subtitle={`已收藏 ${favoritePlaces.length} 个地点`}
          title="收藏地点"
        />

        <Pressable
          accessibilityRole="button"
          onPress={openFavoritePlaceSearch}
          style={({ pressed }) => [
            styles.addButton,
            {
              borderColor: theme.colors.primaryBorder,
              backgroundColor: theme.colors.primarySoft,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          <MaterialIcons
            name="add-location-alt"
            size={20}
            color={theme.colors.primary}
          />
          <Text style={[styles.addButtonText, { color: theme.colors.primary }]}>
            继续收藏地点
          </Text>
        </Pressable>

        {actionMessage ? (
          <View
            style={[
              styles.notice,
              {
                borderColor: theme.colors.primaryBorder,
                backgroundColor: theme.colors.primarySoft,
              },
            ]}
          >
            <MaterialIcons
              name="info-outline"
              size={17}
              color={theme.colors.primary}
            />
            <Text style={[styles.noticeText, { color: theme.colors.primary }]}>
              {actionMessage}
            </Text>
          </View>
        ) : null}

        {isLoading ? (
          <View
            style={[
              styles.card,
              styles.centerCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={[styles.mutedText, { color: theme.colors.textMuted }]}>
              正在读取收藏地点
            </Text>
          </View>
        ) : error ? (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              加载失败
            </Text>
            <Text style={[styles.mutedText, { color: theme.colors.textMuted }]}>
              {error}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={loadFavoritePlaces}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: theme.colors.primary },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  { color: theme.colors.onPrimary },
                ]}
              >
                重新加载
              </Text>
            </Pressable>
          </View>
        ) : favoritePlaces.length > 0 ? (
          <View style={styles.list}>
            {favoritePlaces.map((place) => (
              <FavoritePlaceRow
                key={place.id}
                onDelete={askDeleteFavoritePlace}
                onPress={openPlaceDetail}
                place={place}
              />
            ))}
          </View>
        ) : (
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              <MaterialIcons
                name="travel-explore"
                size={28}
                color={theme.colors.textSubtle}
              />
            </View>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              还没有收藏地点
            </Text>
            <Text style={[styles.mutedText, { color: theme.colors.textMuted }]}>
              先收藏一些景点、餐厅或酒店，后续可以在地图和行程里继续使用。
            </Text>
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        isProcessing={isDeleting}
        message={`确认删除「${deleteTargetPlace?.name ?? "这个地点"}」吗？删除后会从收藏地点列表移除。`}
        onCancel={cancelDeleteFavoritePlace}
        onConfirm={() => {
          void deleteSelectedFavoritePlace();
        }}
        title="删除收藏"
        visible={Boolean(deleteTargetPlace) && isConfirmingDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    paddingVertical: 20,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingTop: 8,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  addButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  notice: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  list: {
    gap: 10,
  },
  placeRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  placeRowPressed: {
    opacity: 0.8,
  },
  swipeActions: {
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "transparent",
    paddingVertical: 6,
    paddingLeft: 8,
  },
  swipeDeleteAction: {
    width: 62,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
  },
  swipeDeleteActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  placeCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  placeName: {
    fontSize: 17,
    fontWeight: "700",
  },
  placeMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  placeTime: {
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  centerCard: {
    minHeight: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  mutedText: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyIcon: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  primaryButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
