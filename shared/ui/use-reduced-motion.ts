import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion() {
  const [isReducedMotionEnabled, setIsReducedMotionEnabled] = useState(false);

  useEffect(() => {
    let isActive = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((isEnabled) => {
        if (isActive) {
          setIsReducedMotionEnabled(isEnabled);
        }
      })
      .catch(() => {
        // 某些平台不提供该系统设置，保持默认动效即可。
      });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setIsReducedMotionEnabled,
    );

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, []);

  return isReducedMotionEnabled;
}
