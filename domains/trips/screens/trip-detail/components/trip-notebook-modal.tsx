import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { TripPoiNoteLine } from "@/features/trips";
import type { AppTheme } from "@/shared/theme/theme";
import { useAppTheme } from "@/shared/theme/use-app-theme";

const TRIP_NOTEBOOK_RULE_LINE_COUNT = 18;
const TRIP_NOTEBOOK_TEXTAREA_MIN_HEIGHT = 258;
const TRIP_NOTEBOOK_TEXTAREA_MAX_HEIGHT = 620;
const TRIP_NOTEBOOK_RULE_LINE_HEIGHT = 40;
const TRIP_NOTEBOOK_POI_INITIAL_COUNT = 5;
const tripNotebookRuleLineKeys = Array.from(
  { length: 40 },
  (_, index) => `rule-line-${index + 1}`,
);

type TripNotebookModalProps = {
  initialNote?: string;
  onRequestClose: () => void;
  onSave: (note: string) => Promise<string | undefined> | string | undefined;
  poiNoteLines: TripPoiNoteLine[];
  visible: boolean;
};

export function TripNotebookModal({
  initialNote,
  onRequestClose,
  onSave,
  poiNoteLines,
  visible,
}: TripNotebookModalProps) {
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const modalAnim = useRef(new Animated.Value(0)).current;
  const contentTaskRef = useRef<{ cancel: () => void } | null>(null);
  const latestInitialNoteRef = useRef(initialNote ?? "");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [inputHeight, setInputHeight] = useState(
    TRIP_NOTEBOOK_TEXTAREA_MIN_HEIGHT,
  );
  const [isContentReady, setContentReady] = useState(false);
  const [isPoiExpanded, setPoiExpanded] = useState(false);
  const [isSaving, setSaving] = useState(false);

  useEffect(() => {
    latestInitialNoteRef.current = initialNote ?? "";
  }, [initialNote]);

  useEffect(() => {
    if (!visible) {
      modalAnim.stopAnimation();
      modalAnim.setValue(0);
      contentTaskRef.current?.cancel();
      contentTaskRef.current = null;
      setContentReady(false);
      setPoiExpanded(false);
      setSaving(false);
      return;
    }

    setDraft(latestInitialNoteRef.current);
    setError("");
    setInputHeight(TRIP_NOTEBOOK_TEXTAREA_MIN_HEIGHT);
    setContentReady(false);
    setPoiExpanded(false);
    setSaving(false);
    modalAnim.setValue(0);

    Animated.timing(modalAnim, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        return;
      }

      contentTaskRef.current = InteractionManager.runAfterInteractions(() => {
        setContentReady(true);
      });
    });

    return () => {
      contentTaskRef.current?.cancel();
      contentTaskRef.current = null;
    };
  }, [modalAnim, visible]);

  const closeWithAnimation = () => {
    if (isSaving) {
      return;
    }

    contentTaskRef.current?.cancel();
    contentTaskRef.current = null;

    Animated.timing(modalAnim, {
      duration: 160,
      easing: Easing.in(Easing.cubic),
      toValue: 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setContentReady(false);
        onRequestClose();
      }
    });
  };

  const saveNotebook = async () => {
    if (isSaving) {
      return;
    }

    setSaving(true);
    setError("");

    const saveError = await onSave(draft);

    if (saveError) {
      setError(saveError);
      setSaving(false);
      return;
    }

    setSaving(false);
    closeWithAnimation();
  };

  const visiblePoiNoteLines = isPoiExpanded
    ? poiNoteLines
    : poiNoteLines.slice(0, TRIP_NOTEBOOK_POI_INITIAL_COUNT);
  const hiddenPoiNoteCount = Math.max(
    0,
    poiNoteLines.length - visiblePoiNoteLines.length,
  );

  return (
    <Modal
      animationType="none"
      onRequestClose={closeWithAnimation}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modalOverlay}
      >
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: modalAnim,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 14) + 8,
              paddingTop: Math.max(insets.top, 16) + 18,
              transform: [
                {
                  translateY: modalAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.topBar}>
            <Pressable
              accessibilityLabel="取消编辑行程记事本"
              accessibilityRole="button"
              disabled={isSaving}
              hitSlop={8}
              onPress={closeWithAnimation}
              style={({ pressed }) => [
                styles.iconButton,
                isSaving && styles.iconButtonDisabled,
                pressed && !isSaving && styles.iconButtonPressed,
              ]}
            >
              <MaterialIcons name="close" size={21} color="#6c5136" />
            </Pressable>
            <Pressable
              accessibilityLabel="保存行程记事本"
              accessibilityRole="button"
              disabled={isSaving || !isContentReady}
              onPress={() => {
                void saveNotebook();
              }}
              style={({ pressed }) => [
                styles.saveButton,
                (isSaving || !isContentReady) && styles.saveButtonDisabled,
                pressed &&
                  isContentReady &&
                  !isSaving &&
                  styles.saveButtonPressed,
              ]}
            >
              <Text style={styles.saveText}>
                {isSaving ? "保存中" : "保存"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.paperPage}>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>TRIP NOTEBOOK</Text>
            </View>

            {isContentReady ? (
              <ScrollView
                contentContainerStyle={styles.contentInner}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={styles.content}
              >
                <View style={styles.editorCard}>
                  <View style={styles.inputRuleLines}>
                    {tripNotebookRuleLineKeys
                      .slice(
                        0,
                        Math.max(
                          TRIP_NOTEBOOK_RULE_LINE_COUNT,
                          Math.ceil(
                            inputHeight / TRIP_NOTEBOOK_RULE_LINE_HEIGHT,
                          ),
                        ),
                      )
                      .map((ruleLineKey) => (
                        <View key={ruleLineKey} style={styles.ruleLine} />
                      ))}
                  </View>
                  <TextInput
                    multiline
                    onContentSizeChange={(event) => {
                      const nextHeight = Math.min(
                        TRIP_NOTEBOOK_TEXTAREA_MAX_HEIGHT,
                        Math.max(
                          TRIP_NOTEBOOK_TEXTAREA_MIN_HEIGHT,
                          event.nativeEvent.contentSize.height + 12,
                        ),
                      );
                      setInputHeight(nextHeight);
                    }}
                    onChangeText={(value) => {
                      setDraft(value);
                      setError("");
                    }}
                    placeholder="写下整趟行程的提醒、灵感、重要事项..."
                    placeholderTextColor="rgba(105, 79, 45, 0.46)"
                    scrollEnabled={
                      inputHeight >= TRIP_NOTEBOOK_TEXTAREA_MAX_HEIGHT
                    }
                    style={[styles.textArea, { height: inputHeight }]}
                    textAlignVertical="top"
                    value={draft}
                  />
                </View>

                <View style={styles.poiBlock}>
                  <View style={styles.poiHeader}>
                    <Text style={styles.poiTitle}>地点备注汇总</Text>
                    <Text style={styles.poiCount}>
                      {poiNoteLines.length} 条
                    </Text>
                  </View>
                  <View style={styles.poiList}>
                    {poiNoteLines.length > 0 ? (
                      <>
                        {visiblePoiNoteLines.map((line) => (
                          <View
                            key={`${line.dayId}-${line.itemId}`}
                            style={styles.poiLine}
                          >
                            <Text numberOfLines={1} style={styles.poiName}>
                              {line.placeName}
                            </Text>
                            <Text style={styles.poiText}>{line.note}</Text>
                          </View>
                        ))}
                        {hiddenPoiNoteCount > 0 || isPoiExpanded ? (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                              setPoiExpanded((isExpanded) => !isExpanded)
                            }
                            style={({ pressed }) => [
                              styles.poiToggle,
                              pressed && styles.poiTogglePressed,
                            ]}
                          >
                            <Text style={styles.poiToggleText}>
                              {isPoiExpanded
                                ? "收起"
                                : `展开 ${hiddenPoiNoteCount} 条`}
                            </Text>
                            <MaterialIcons
                              name={
                                isPoiExpanded ? "expand-less" : "expand-more"
                              }
                              size={18}
                              color="#866842"
                            />
                          </Pressable>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.poiEmpty}>
                        还没有地点备注。可以在地点详情或地点编辑里添加。
                      </Text>
                    )}
                  </View>
                </View>

                {error ? (
                  <View style={styles.inlineError}>
                    <Text style={styles.inlineErrorText}>{error}</Text>
                  </View>
                ) : null}
              </ScrollView>
            ) : (
              <View style={styles.loadingContent}>
                <ActivityIndicator color="#9f6a2d" />
              </View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(46, 39, 31, 0.24)",
    },
    sheet: {
      flex: 1,
      paddingHorizontal: 18,
      backgroundColor: "#fff4d9",
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 12,
    },
    iconButton: {
      alignItems: "center",
      justifyContent: "center",
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "rgba(255, 251, 239, 0.78)",
      shadowColor: "#6c5136",
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 0.1,
      shadowRadius: 14,
      elevation: 2,
    },
    iconButtonPressed: {
      backgroundColor: "#f4e2b8",
    },
    iconButtonDisabled: {
      opacity: 0.72,
    },
    saveButton: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
      borderRadius: 999,
      backgroundColor: "#9f6a2d",
      shadowColor: "#7f4f21",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 18,
      elevation: 3,
    },
    saveButtonDisabled: {
      opacity: 0.72,
    },
    saveButtonPressed: {
      backgroundColor: "#875620",
    },
    saveText: {
      color: "#fff8e9",
      fontSize: 14,
      fontWeight: "900",
    },
    header: {
      marginBottom: 10,
    },
    eyebrow: {
      color: "#866842",
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
    },
    paperPage: {
      position: "relative",
      flex: 1,
      overflow: "hidden",
      paddingTop: 14,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      flexGrow: 1,
      paddingBottom: 8,
    },
    loadingContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingBottom: 80,
    },
    editorCard: {
      position: "relative",
      minHeight: TRIP_NOTEBOOK_TEXTAREA_MIN_HEIGHT,
      overflow: "hidden",
      paddingHorizontal: 0,
      paddingTop: 2,
      paddingBottom: 8,
      borderWidth: 0,
    },
    inputRuleLines: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 34,
      gap: TRIP_NOTEBOOK_RULE_LINE_HEIGHT - 1,
      pointerEvents: "none",
    },
    ruleLine: {
      height: 1,
      backgroundColor: "rgba(178, 132, 82, 0.18)",
    },
    textArea: {
      position: "relative",
      zIndex: 1,
      minHeight: TRIP_NOTEBOOK_TEXTAREA_MIN_HEIGHT,
      color: "#4b3a27",
      backgroundColor: "transparent",
      fontSize: 18,
      fontWeight: "600",
      lineHeight: TRIP_NOTEBOOK_RULE_LINE_HEIGHT,
      outlineStyle: "solid",
      outlineWidth: 0,
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 0,
      textAlignVertical: "top",
    },
    poiBlock: {
      gap: 10,
      marginTop: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(155, 108, 55, 0.15)",
      borderLeftWidth: 4,
      borderLeftColor: "#caa96a",
      backgroundColor: "rgba(255, 250, 236, 0.78)",
    },
    poiHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    poiTitle: {
      color: "#4d3a24",
      fontSize: 16,
      fontWeight: "900",
    },
    poiCount: {
      color: "#866842",
      fontSize: 12,
      fontWeight: "900",
    },
    poiList: {
      gap: 0,
    },
    poiLine: {
      gap: 4,
      paddingTop: 10,
      paddingBottom: 2,
      borderTopWidth: 1,
      borderTopColor: "rgba(121, 85, 45, 0.14)",
    },
    poiName: {
      color: "#4d3a24",
      fontSize: 14,
      fontWeight: "900",
    },
    poiText: {
      color: "#6e5741",
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "600",
    },
    poiEmpty: {
      color: "#80644a",
      fontSize: 13,
      lineHeight: 20,
      fontWeight: "600",
    },
    poiToggle: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      marginTop: 8,
      borderRadius: 10,
      backgroundColor: "rgba(157, 106, 45, 0.08)",
    },
    poiTogglePressed: {
      backgroundColor: "rgba(157, 106, 45, 0.14)",
    },
    poiToggleText: {
      color: "#866842",
      fontSize: 13,
      fontWeight: "900",
    },
    inlineError: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.colors.dangerSoft,
      borderWidth: 1,
      borderColor: theme.colors.dangerBorder,
    },
    inlineErrorText: {
      color: theme.colors.danger,
      fontSize: 13,
      fontWeight: "600",
    },
  });
}
