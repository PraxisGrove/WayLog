import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getProfileInitials } from "@/features/auth";
import type { AppTheme } from "@/shared/theme/theme";

import type { createProfileScreenStyles } from "../styles/profile-screen.styles";

export type ProfileEditorModalProps = {
  avatarImageTransform: {
    transform: (
      | { scale: number }
      | { translateX: number }
      | { translateY: number }
    )[];
  };
  avatarImageUri: string;
  bio: string;
  displayName: string;
  hasUploadedAvatar: boolean;
  hintText: string;
  isBusy: boolean;
  onChangeBio: (value: string) => void;
  onChangeDisplayName: (value: string) => void;
  onClose: () => void;
  onPickAvatar: () => void;
  onRemoveAvatar: () => void;
  onSave: () => void;
  profileLoginInputWebFocusStyle: object;
  styles: ReturnType<typeof createProfileScreenStyles>;
  theme: AppTheme;
  visible: boolean;
};

export function ProfileEditorModal({
  avatarImageTransform,
  avatarImageUri,
  bio,
  displayName,
  hasUploadedAvatar,
  hintText,
  isBusy,
  onChangeBio,
  onChangeDisplayName,
  onClose,
  onPickAvatar,
  onRemoveAvatar,
  onSave,
  profileLoginInputWebFocusStyle,
  styles,
  theme,
  visible,
}: ProfileEditorModalProps) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View
        style={[
          styles.profileEditorOverlay,
          { backgroundColor: theme.colors.overlay },
        ]}
      >
        <Pressable
          accessibilityLabel="关闭资料编辑"
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView
          testID="profile-editor-sheet"
          style={[
            styles.profileEditorSheet,
            {
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.profileEditorHeader,
              { borderBottomColor: theme.colors.border },
            ]}
          >
            <Pressable
              accessibilityLabel="取消编辑资料"
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onClose}
              style={({ pressed }) => [
                styles.profileEditorHeaderButton,
                { backgroundColor: theme.colors.surfaceMuted },
                pressed && { backgroundColor: theme.colors.surfacePressed },
              ]}
            >
              <MaterialIcons name="close" size={21} color={theme.colors.text} />
            </Pressable>
            <Text
              style={[styles.profileEditorTitle, { color: theme.colors.text }]}
            >
              编辑个人资料
            </Text>
            <Pressable
              accessibilityLabel="保存个人资料"
              accessibilityRole="button"
              disabled={isBusy}
              onPress={onSave}
              style={({ pressed }) => [
                styles.profileEditorSaveButton,
                { backgroundColor: theme.colors.primary },
                pressed && { backgroundColor: theme.colors.primaryPressed },
                isBusy && { opacity: 0.6 },
              ]}
            >
              <Text
                style={[
                  styles.profileEditorSaveText,
                  { color: theme.colors.onPrimary },
                ]}
              >
                {isBusy ? "保存中" : "保存"}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.profileEditorContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileEditorAvatarSection}>
              <Pressable
                accessibilityLabel="更换头像"
                accessibilityRole="button"
                disabled={isBusy}
                onPress={onPickAvatar}
                style={({ pressed }) => [
                  styles.profileEditorAvatarButton,
                  pressed && { opacity: 0.82 },
                ]}
              >
                <View
                  style={[
                    styles.profileEditorAvatar,
                    {
                      backgroundColor: theme.colors.primarySoft,
                      borderColor: theme.colors.surface,
                    },
                  ]}
                >
                  {hasUploadedAvatar ? (
                    <Image
                      accessibilityIgnoresInvertColors
                      source={{ uri: avatarImageUri }}
                      style={[
                        styles.profileEditorAvatarImage,
                        avatarImageTransform,
                      ]}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.profileEditorAvatarText,
                        { color: theme.colors.primary },
                      ]}
                    >
                      {getProfileInitials(displayName)}
                    </Text>
                  )}
                </View>
                <View
                  style={[
                    styles.profileEditorCameraBadge,
                    {
                      backgroundColor: theme.colors.primary,
                      borderColor: theme.colors.background,
                    },
                  ]}
                >
                  <MaterialIcons
                    name="photo-camera"
                    size={17}
                    color={theme.colors.onPrimary}
                  />
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isBusy}
                onPress={onPickAvatar}
                style={({ pressed }) => [
                  styles.profileEditorTextAction,
                  pressed && { opacity: 0.64 },
                ]}
              >
                <Text
                  style={[
                    styles.profileEditorTextActionLabel,
                    { color: theme.colors.primary },
                  ]}
                >
                  {hasUploadedAvatar ? "更换头像" : "上传头像"}
                </Text>
              </Pressable>
              {hasUploadedAvatar ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={isBusy}
                  onPress={onRemoveAvatar}
                  style={({ pressed }) => [
                    styles.profileEditorTextAction,
                    pressed && { opacity: 0.64 },
                  ]}
                >
                  <Text
                    style={[
                      styles.profileEditorRemoveLabel,
                      { color: theme.colors.danger },
                    ]}
                  >
                    移除头像
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View
              style={[
                styles.profileEditorFormCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.profileEditorField}>
                <Text
                  style={[
                    styles.profileEditorFieldLabel,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  名称
                </Text>
                <TextInput
                  autoCapitalize="none"
                  maxLength={40}
                  onChangeText={onChangeDisplayName}
                  placeholder="给自己起个名字"
                  placeholderTextColor={theme.colors.textSubtle}
                  style={[
                    styles.profileEditorInput,
                    profileLoginInputWebFocusStyle,
                    { color: theme.colors.text },
                  ]}
                  value={displayName}
                />
              </View>
              <View
                style={[
                  styles.profileEditorDivider,
                  { backgroundColor: theme.colors.border },
                ]}
              />
              <View style={styles.profileEditorField}>
                <View style={styles.profileEditorFieldHeading}>
                  <Text
                    style={[
                      styles.profileEditorFieldLabel,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    个人简介
                  </Text>
                  <Text
                    style={[
                      styles.profileEditorCounter,
                      { color: theme.colors.textSubtle },
                    ]}
                  >
                    {bio.length}/120
                  </Text>
                </View>
                <TextInput
                  maxLength={120}
                  multiline
                  onChangeText={onChangeBio}
                  placeholder="写下你的旅行偏好、常去城市或一句自我介绍"
                  placeholderTextColor={theme.colors.textSubtle}
                  style={[
                    styles.profileEditorInput,
                    styles.profileEditorBioInput,
                    profileLoginInputWebFocusStyle,
                    { color: theme.colors.text },
                  ]}
                  textAlignVertical="top"
                  value={bio}
                />
              </View>
            </View>

            <View
              style={[
                styles.profileEditorHint,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}
            >
              <MaterialIcons
                name="cloud-done"
                size={18}
                color={theme.colors.primary}
              />
              <Text
                style={[
                  styles.profileEditorHintText,
                  { color: theme.colors.textMuted },
                ]}
              >
                {hintText}
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
