import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export type HapticFeedback =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

export function triggerHaptic(feedback: HapticFeedback) {
  if (Platform.OS === "web") {
    return;
  }

  const request =
    feedback === "selection"
      ? Haptics.selectionAsync()
      : feedback === "success"
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : feedback === "warning"
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : feedback === "error"
            ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            : Haptics.impactAsync(
                feedback === "light"
                  ? Haptics.ImpactFeedbackStyle.Light
                  : feedback === "medium"
                    ? Haptics.ImpactFeedbackStyle.Medium
                    : Haptics.ImpactFeedbackStyle.Heavy,
              );

  void request.catch(() => {
    // Haptics can be unavailable when battery saving or system settings disable it.
  });
}
