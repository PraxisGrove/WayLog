import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Image,
  Modal,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import {
  type ComposedGesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { avatarCropZoomRange } from "@/features/auth";
import type { AppTheme } from "@/shared/theme/theme";

import {
  avatarCropPreviewSize,
  avatarCropSize,
  type createProfileScreenStyles,
} from "../styles/profile-screen.styles";
import type { PendingAvatarCrop } from "../types";

type ProfileAvatarCropModalProps = {
  avatarCropGesture: ComposedGesture | GestureType;
  isCroppingAvatar: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onPickAvatar: () => void;
  onReset: () => void;
  onRotate: () => void;
  onSetZoomTrackWidth: (width: number) => void;
  onZoomStep: (direction: "decrease" | "increase") => void;
  onZoomTrack: (positionX: number) => void;
  pendingAvatarCrop: PendingAvatarCrop | null;
  pendingAvatarDisplay: Pick<ViewStyle, "height" | "width"> | null;
  pendingAvatarTransform: {
    offsetX: number;
    offsetY: number;
    zoom: number;
  } | null;
  pendingAvatarZoomProgress: number;
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
};

export function ProfileAvatarCropModal({
  avatarCropGesture,
  isCroppingAvatar,
  onCancel,
  onConfirm,
  onPickAvatar,
  onReset,
  onRotate,
  onSetZoomTrackWidth,
  onZoomStep,
  onZoomTrack,
  pendingAvatarCrop,
  pendingAvatarDisplay,
  pendingAvatarTransform,
  pendingAvatarZoomProgress,
  styles,
  theme,
}: ProfileAvatarCropModalProps) {
  const avatarCropPreviewRatio = avatarCropPreviewSize / avatarCropSize;
  const pendingAvatarPreviewDisplay = pendingAvatarDisplay
    ? {
        height: Number(pendingAvatarDisplay.height) * avatarCropPreviewRatio,
        width: Number(pendingAvatarDisplay.width) * avatarCropPreviewRatio,
      }
    : null;

  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!isCroppingAvatar) {
          onCancel();
        }
      }}
      presentationStyle="fullScreen"
      visible={Boolean(pendingAvatarCrop)}
    >
      <SafeAreaView style={styles.cropModalRoot}>
        <View style={styles.cropModalHeader}>
          <Pressable
            accessibilityRole="button"
            disabled={isCroppingAvatar}
            onPress={onCancel}
            style={({ pressed }) => [
              styles.cropHeaderButton,
              styles.cropHeaderSecondaryButton,
              pressed && styles.cropHeaderSecondaryButtonPressed,
            ]}
          >
            <Text style={styles.cropHeaderButtonText}>取消</Text>
          </Pressable>
          <View style={styles.cropTitleGroup}>
            <Text style={styles.cropTitle}>调整头像</Text>
            <Text style={styles.cropTitleCaption}>圆形区域将作为最终头像</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={isCroppingAvatar}
            onPress={onConfirm}
            style={({ pressed }) => [
              styles.cropHeaderButton,
              { backgroundColor: theme.colors.primary },
              pressed && { backgroundColor: theme.colors.primaryPressed },
              isCroppingAvatar && { opacity: 0.6 },
            ]}
          >
            <Text
              style={[
                styles.cropConfirmText,
                { color: theme.colors.onPrimary },
              ]}
            >
              {isCroppingAvatar ? "处理中" : "完成"}
            </Text>
          </Pressable>
        </View>

        <View style={styles.cropStage}>
          <GestureDetector gesture={avatarCropGesture}>
            <View
              style={[
                styles.cropFrame,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              {pendingAvatarCrop &&
              pendingAvatarDisplay &&
              pendingAvatarTransform ? (
                <View pointerEvents="none" style={styles.cropImageLayer}>
                  <Image
                    accessibilityIgnoresInvertColors
                    source={{ uri: pendingAvatarCrop.sourceUri }}
                    style={[
                      styles.cropImage,
                      pendingAvatarDisplay,
                      {
                        transform: [
                          { translateX: pendingAvatarTransform.offsetX },
                          { translateY: pendingAvatarTransform.offsetY },
                          { scale: pendingAvatarTransform.zoom },
                        ],
                      },
                    ]}
                  />
                </View>
              ) : null}
              <View pointerEvents="none" style={styles.cropGrid}>
                <View style={[styles.cropGridVertical, { left: "33.333%" }]} />
                <View style={[styles.cropGridVertical, { left: "66.666%" }]} />
                <View style={[styles.cropGridHorizontal, { top: "33.333%" }]} />
                <View style={[styles.cropGridHorizontal, { top: "66.666%" }]} />
              </View>
              <View pointerEvents="none" style={styles.cropFrameOverlay} />
            </View>
          </GestureDetector>
        </View>

        {pendingAvatarCrop ? (
          <View
            style={[
              styles.cropControls,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View style={styles.cropPreviewRow}>
              <View
                style={[
                  styles.cropPreviewFrame,
                  { backgroundColor: theme.colors.surfaceMuted },
                ]}
              >
                {pendingAvatarPreviewDisplay && pendingAvatarTransform ? (
                  <View pointerEvents="none" style={styles.cropImageLayer}>
                    <Image
                      accessibilityIgnoresInvertColors
                      source={{ uri: pendingAvatarCrop.sourceUri }}
                      style={[
                        styles.cropImage,
                        pendingAvatarPreviewDisplay,
                        {
                          transform: [
                            {
                              translateX:
                                pendingAvatarTransform.offsetX *
                                avatarCropPreviewRatio,
                            },
                            {
                              translateY:
                                pendingAvatarTransform.offsetY *
                                avatarCropPreviewRatio,
                            },
                            { scale: pendingAvatarTransform.zoom },
                          ],
                        },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
              <View style={styles.cropPreviewCopy}>
                <Text
                  style={[
                    styles.cropPreviewTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  头像预览
                </Text>
                <Text
                  style={[styles.cropHint, { color: theme.colors.textMuted }]}
                >
                  拖动定位，双指捏合或拖动滑杆缩放。
                </Text>
              </View>
            </View>
            <View style={styles.scaleStepper}>
              <Pressable
                accessibilityLabel="缩小裁剪头像"
                accessibilityRole="button"
                disabled={
                  pendingAvatarCrop.zoom <= avatarCropZoomRange.min ||
                  isCroppingAvatar
                }
                onPress={() => onZoomStep("decrease")}
                style={({ pressed }) => [
                  styles.scaleButton,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    opacity:
                      pendingAvatarCrop.zoom <= avatarCropZoomRange.min
                        ? 0.46
                        : 1,
                  },
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <MaterialIcons
                  name="remove"
                  size={19}
                  color={theme.colors.text}
                />
              </Pressable>
              <View
                accessibilityLabel="头像缩放"
                accessibilityRole="adjustable"
                accessibilityValue={{
                  max: avatarCropZoomRange.max * 100,
                  min: avatarCropZoomRange.min * 100,
                  now: Math.round(pendingAvatarCrop.zoom * 100),
                  text: `${Math.round(pendingAvatarCrop.zoom * 100)}%`,
                }}
                onLayout={(event) =>
                  onSetZoomTrackWidth(event.nativeEvent.layout.width)
                }
                onMoveShouldSetResponder={() => !isCroppingAvatar}
                onResponderGrant={(event) =>
                  onZoomTrack(event.nativeEvent.locationX)
                }
                onResponderMove={(event) =>
                  onZoomTrack(event.nativeEvent.locationX)
                }
                onStartShouldSetResponder={() => !isCroppingAvatar}
                style={styles.scaleTrackTouchArea}
              >
                <View
                  style={[
                    styles.scaleTrack,
                    { backgroundColor: theme.colors.border },
                  ]}
                >
                  <View
                    style={[
                      styles.scaleTrackFill,
                      {
                        backgroundColor: theme.colors.primary,
                        width: `${pendingAvatarZoomProgress * 100}%`,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.scaleTrackThumb,
                      {
                        backgroundColor: theme.colors.primary,
                        left: `${pendingAvatarZoomProgress * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
              <Pressable
                accessibilityLabel="放大裁剪头像"
                accessibilityRole="button"
                disabled={
                  pendingAvatarCrop.zoom >= avatarCropZoomRange.max ||
                  isCroppingAvatar
                }
                onPress={() => onZoomStep("increase")}
                style={({ pressed }) => [
                  styles.scaleButton,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    opacity:
                      pendingAvatarCrop.zoom >= avatarCropZoomRange.max
                        ? 0.46
                        : 1,
                  },
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <MaterialIcons name="add" size={19} color={theme.colors.text} />
              </Pressable>
              <Text
                style={[styles.scaleValue, { color: theme.colors.textMuted }]}
              >
                {Math.round(pendingAvatarCrop.zoom * 100)}%
              </Text>
            </View>
            <View style={styles.cropToolRow}>
              <Pressable
                accessibilityRole="button"
                disabled={isCroppingAvatar}
                onPress={onPickAvatar}
                style={({ pressed }) => [
                  styles.cropToolButton,
                  { backgroundColor: theme.colors.surfaceMuted },
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <MaterialIcons
                  name="photo-library"
                  size={20}
                  color={theme.colors.text}
                />
                <Text
                  style={[styles.cropToolLabel, { color: theme.colors.text }]}
                >
                  换一张
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isCroppingAvatar}
                onPress={onRotate}
                style={({ pressed }) => [
                  styles.cropToolButton,
                  { backgroundColor: theme.colors.surfaceMuted },
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <MaterialIcons
                  name="rotate-right"
                  size={21}
                  color={theme.colors.text}
                />
                <Text
                  style={[styles.cropToolLabel, { color: theme.colors.text }]}
                >
                  旋转
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isCroppingAvatar}
                onPress={onReset}
                style={({ pressed }) => [
                  styles.cropToolButton,
                  { backgroundColor: theme.colors.surfaceMuted },
                  pressed && { backgroundColor: theme.colors.surfacePressed },
                ]}
              >
                <MaterialIcons
                  name="refresh"
                  size={21}
                  color={theme.colors.text}
                />
                <Text
                  style={[styles.cropToolLabel, { color: theme.colors.text }]}
                >
                  重置
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
