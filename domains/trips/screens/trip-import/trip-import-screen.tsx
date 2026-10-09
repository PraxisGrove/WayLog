import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createDiagnosticLogger } from "@/features/diagnostics";
import {
  addTripImportSource,
  formatTripDestination,
  getTripsWithSeed,
  type Trip,
  type TripImportSource,
} from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";
import { useScreenContentStyle } from "@/shared/ui/screen-content";
import { ScreenHeader } from "@/shared/ui/screen-header";

const tripImportScreenLogger = createDiagnosticLogger("trip-import-screen");
type ImportMode = TripImportSource["sourceType"];

const importModes: {
  detail: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  type: ImportMode;
}[] = [
  {
    type: "link",
    title: "粘贴链接",
    detail: "攻略 / 笔记 / 清单",
    icon: "link",
  },
  {
    type: "text",
    title: "导入文字",
    detail: "复制来的行程草稿",
    icon: "article",
  },
  {
    type: "image",
    title: "导入图片",
    detail: "截图 / 菜单 / 票据",
    icon: "image",
  },
];

const modeLabels: Record<ImportMode, string> = {
  link: "链接",
  text: "文字",
  image: "图片",
};

function getDefaultTripId(trips: Trip[]) {
  return (
    trips.find((trip) => trip.status === "旅途中")?.id ??
    trips.find((trip) => trip.status === "计划中")?.id ??
    trips[0]?.id ??
    ""
  );
}

function prioritizeTrip(trips: Trip[], tripId?: string) {
  if (!tripId) {
    return trips;
  }

  const tripIndex = trips.findIndex((trip) => trip.id === tripId);

  if (tripIndex <= 0) {
    return trips;
  }

  const nextTrips = [...trips];
  const [trip] = nextTrips.splice(tripIndex, 1);
  return [trip, ...nextTrips];
}

type TripImportScreenProps = {
  createdTripId?: string;
};

export function TripImportScreen({
  createdTripId: createdTripIdParam,
}: TripImportScreenProps) {
  const router = useRouter();
  const theme = useAppTheme();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [mode, setMode] = useState<ImportMode>("link");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceContent, setSourceContent] = useState("");
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId),
    [selectedTripId, trips],
  );
  const requiresContent = mode !== "image";

  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenContentStyle = useScreenContentStyle();

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const localTrips = prioritizeTrip(
        await getTripsWithSeed(),
        createdTripIdParam,
      );
      setTrips(localTrips);
      setSelectedTripId((currentId) => {
        if (
          createdTripIdParam &&
          localTrips.some((trip) => trip.id === createdTripIdParam)
        ) {
          return createdTripIdParam;
        }

        if (currentId && localTrips.some((trip) => trip.id === currentId)) {
          return currentId;
        }

        return getDefaultTripId(localTrips);
      });
    } catch (loadError) {
      tripImportScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to load trips for import.", loadError] },
        "Legacy warning captured",
      );
      setError("读取本地行程失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, [createdTripIdParam]);

  useFocusEffect(
    useCallback(() => {
      loadTrips();
    }, [loadTrips]),
  );

  const saveImportSource = async () => {
    const trimmedTitle = sourceTitle.trim();
    const trimmedContent = sourceContent.trim();

    if (!selectedTrip) {
      setError("请先创建一趟行程");
      return;
    }

    if (!trimmedTitle) {
      setError("请先填写来源标题");
      return;
    }

    if (requiresContent && !trimmedContent) {
      setError(mode === "link" ? "请先粘贴攻略链接" : "请先粘贴行程文字");
      return;
    }

    setSaving(true);
    setError("");
    setSavedMessage("");

    try {
      const updatedTrip = await addTripImportSource(selectedTrip.id, {
        title: trimmedTitle,
        sourceType: mode,
        status: mode === "image" ? "占位" : "待解析",
      });

      if (!updatedTrip) {
        setError("没有找到要导入的行程");
        return;
      }

      setTrips((currentTrips) =>
        currentTrips.map((trip) =>
          trip.id === updatedTrip.id ? updatedTrip : trip,
        ),
      );
      setSourceTitle("");
      setSourceContent("");
      setSavedMessage(`已保存到「${updatedTrip.title}」`);
    } catch (saveError) {
      tripImportScreenLogger.warn(
        "legacy.warn",
        { args: ["Failed to save import source.", saveError] },
        "Legacy warning captured",
      );
      setError("保存导入来源失败，请稍后再试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={16}
        style={styles.keyboardRoot}
      >
        <ScrollView
          contentContainerStyle={[screenContentStyle, styles.content]}
          keyboardShouldPersistTaps="handled"
        >
          <ScreenHeader
            onBack={() => router.back()}
            subtitle="先收进素材箱"
            title="导入攻略"
          />

          {isLoading ? (
            <View style={[styles.card, styles.loadingCard]}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.mutedText}>正在读取本地行程</Text>
            </View>
          ) : trips.length === 0 ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>还没有可导入的行程</Text>
              <Text style={styles.mutedText}>
                先新建一趟行程，再把攻略素材放进去。
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/trips/new",
                    params: { returnTo: "/trips/import" },
                  })
                }
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && { backgroundColor: theme.colors.primaryPressed },
                ]}
              >
                <Text style={styles.primaryButtonText}>新建行程</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.label}>导入到</Text>
                <ScrollView
                  contentContainerStyle={styles.tripSelector}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  <Pressable
                    accessibilityLabel="新建行程"
                    accessibilityRole="button"
                    onPress={() => {
                      setSavedMessage("");
                      router.push({
                        pathname: "/trips/new",
                        params: { returnTo: "/trips/import" },
                      });
                    }}
                    style={({ pressed }) => [
                      styles.addTripButton,
                      pressed && {
                        backgroundColor: theme.colors.surfacePressed,
                      },
                    ]}
                  >
                    <MaterialIcons
                      name="add"
                      size={28}
                      color={theme.colors.primary}
                    />
                  </Pressable>
                  {trips.map((trip) => {
                    const isSelected = trip.id === selectedTripId;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={trip.id}
                        onPress={() => {
                          setSelectedTripId(trip.id);
                          setSavedMessage("");
                        }}
                        style={({ pressed }) => [
                          styles.tripPill,
                          isSelected && {
                            backgroundColor: theme.colors.primarySoft,
                            borderColor: theme.colors.primarySoft,
                          },
                          pressed && {
                            backgroundColor: theme.colors.surfacePressed,
                          },
                        ]}
                      >
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.tripPillTitle,
                            isSelected && { color: theme.colors.primary },
                          ]}
                        >
                          {trip.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.tripPillMeta}>
                          {formatTripDestination(trip)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>来源类型</Text>
                <View style={styles.modeGrid}>
                  {importModes.map((item) => {
                    const isSelected = item.type === mode;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={item.type}
                        onPress={() => {
                          setMode(item.type);
                          setError("");
                          setSavedMessage("");
                        }}
                        style={({ pressed }) => [
                          styles.modeButton,
                          isSelected && {
                            backgroundColor: theme.colors.primarySoft,
                            borderColor: theme.colors.primarySoft,
                          },
                          pressed && {
                            backgroundColor: theme.colors.surfacePressed,
                          },
                        ]}
                      >
                        <MaterialIcons
                          name={item.icon}
                          size={22}
                          color={
                            isSelected
                              ? theme.colors.primary
                              : theme.colors.textMuted
                          }
                        />
                        <Text style={styles.modeTitle}>{item.title}</Text>
                        <Text numberOfLines={1} style={styles.modeDetail}>
                          {item.detail}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.label}>来源标题</Text>
                <TextInput
                  onChangeText={(value) => {
                    setSourceTitle(value);
                    setError("");
                    setSavedMessage("");
                  }}
                  placeholder="例如：西安城墙和兵马俑路线笔记"
                  placeholderTextColor={theme.colors.textSubtle}
                  returnKeyType="next"
                  style={styles.input}
                  value={sourceTitle}
                />

                {mode === "image" ? (
                  <View style={styles.uploadPlaceholder}>
                    <View style={styles.uploadIcon}>
                      <MaterialIcons
                        name="image"
                        size={24}
                        color={theme.colors.primary}
                      />
                    </View>
                    <View style={styles.uploadCopy}>
                      <Text style={styles.uploadTitle}>图片素材</Text>
                      <Text style={styles.mutedText}>
                        图片选择器后续接入，本次先保存一个图片导入入口。
                      </Text>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.label}>
                      {mode === "link" ? "攻略链接" : "行程文字"}
                    </Text>
                    <TextInput
                      autoCapitalize="none"
                      keyboardType={mode === "link" ? "url" : "default"}
                      multiline={mode === "text"}
                      onChangeText={(value) => {
                        setSourceContent(value);
                        setError("");
                        setSavedMessage("");
                      }}
                      placeholder={
                        mode === "link"
                          ? "https://..."
                          : "粘贴攻略、聊天记录或行程草稿"
                      }
                      placeholderTextColor={theme.colors.textSubtle}
                      style={[styles.input, mode === "text" && styles.textArea]}
                      textAlignVertical={mode === "text" ? "top" : "center"}
                      value={sourceContent}
                    />
                  </>
                )}

                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                {savedMessage ? (
                  <Text style={styles.successText}>{savedMessage}</Text>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={saveImportSource}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    isSaving && styles.primaryButtonDisabled,
                    pressed && { backgroundColor: theme.colors.primaryPressed },
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSaving ? "保存中" : `保存${modeLabels[mode]}来源`}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>已收集素材</Text>
                  <Text style={styles.countText}>
                    {selectedTrip?.importSources.length ?? 0} 条
                  </Text>
                </View>

                {selectedTrip && selectedTrip.importSources.length > 0 ? (
                  <View style={styles.sourceList}>
                    {selectedTrip.importSources.slice(0, 5).map((source) => (
                      <View key={source.id} style={styles.sourceRow}>
                        <View style={styles.sourceIcon}>
                          <MaterialIcons
                            name="folder-open"
                            size={18}
                            color={theme.colors.primary}
                          />
                        </View>
                        <View style={styles.sourceCopy}>
                          <Text style={styles.sourceTitle}>{source.title}</Text>
                          <Text style={styles.mutedText}>
                            {modeLabels[source.sourceType]} · {source.status}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyBlock}>
                    <Text style={styles.sourceTitle}>还没有导入素材</Text>
                    <Text style={styles.mutedText}>
                      保存后会先放在这里，之后再接解析和路线整理。
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.surfaceMuted,
    },
    keyboardRoot: {
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
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    card: {
      gap: 10,
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    loadingCard: {
      minHeight: 112,
      alignItems: "center",
      justifyContent: "center",
    },
    rowBetween: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    cardTitle: {
      color: theme.colors.text,
      fontSize: 18,
      fontWeight: "700",
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontWeight: "700",
    },
    mutedText: {
      color: theme.colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    tripSelector: {
      alignItems: "center",
      gap: 8,
      paddingRight: 4,
    },
    addTripButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 64,
      height: 64,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      backgroundColor: theme.colors.primarySoft,
    },
    tripPill: {
      width: 150,
      gap: 3,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    tripPillTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    tripPillMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    modeGrid: {
      flexDirection: "row",
      gap: 8,
    },
    modeButton: {
      flex: 1,
      minHeight: 86,
      alignItems: "flex-start",
      justifyContent: "center",
      gap: 4,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },
    modeTitle: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    modeDetail: {
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
    },
    input: {
      minHeight: 46,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      color: theme.colors.text,
      fontSize: 15,
      backgroundColor: theme.colors.surface,
    },
    textArea: {
      minHeight: 132,
      lineHeight: 21,
    },
    uploadPlaceholder: {
      minHeight: 84,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.primarySoft,
      backgroundColor: theme.colors.primarySoft,
    },
    uploadIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.primarySoft,
    },
    uploadCopy: {
      flex: 1,
      gap: 3,
    },
    uploadTitle: {
      color: theme.colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    successText: {
      color: theme.colors.success,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 18,
    },
    primaryButton: {
      minHeight: 46,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
      borderRadius: 8,
      backgroundColor: theme.colors.primary,
    },
    primaryButtonDisabled: {
      opacity: 0.68,
    },
    primaryButtonText: {
      color: theme.colors.onPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    countText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    sourceList: {
      gap: 12,
    },
    sourceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sourceIcon: {
      alignItems: "center",
      justifyContent: "center",
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.primarySoft,
    },
    sourceCopy: {
      flex: 1,
      gap: 2,
    },
    sourceTitle: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    emptyBlock: {
      gap: 4,
    },
  });
}
