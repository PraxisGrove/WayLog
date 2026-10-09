import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef } from "react";
import type { ScrollView } from "react-native";

const scrollPositionCache = new Map<string, number>();

export function useScrollPosition(pageKey: string) {
  const scrollViewRef = useRef<ScrollView>(null);
  const isRestoringRef = useRef(false);
  const hasRestoredRef = useRef(false);

  const saveScrollPosition = useCallback(
    (y: number) => {
      if (!isRestoringRef.current) {
        scrollPositionCache.set(pageKey, y);
      }
    },
    [pageKey],
  );

  useEffect(() => {
    const savedPosition = scrollPositionCache.get(pageKey) ?? 0;

    if (savedPosition > 0 && scrollViewRef.current && !hasRestoredRef.current) {
      hasRestoredRef.current = true;
      isRestoringRef.current = true;

      const frameId = requestAnimationFrame(() => {
        if (scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: savedPosition,
            animated: false,
          });
        }
        isRestoringRef.current = false;
      });

      return () => {
        cancelAnimationFrame(frameId);
      };
    }
  }, [pageKey]);

  useFocusEffect(
    useCallback(() => {
      const savedPosition = scrollPositionCache.get(pageKey) ?? 0;

      if (
        savedPosition > 0 &&
        scrollViewRef.current &&
        !hasRestoredRef.current
      ) {
        hasRestoredRef.current = true;
        isRestoringRef.current = true;

        const frameId = requestAnimationFrame(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollTo({
              y: savedPosition,
              animated: false,
            });
          }
          isRestoringRef.current = false;
        });

        return () => {
          cancelAnimationFrame(frameId);
          hasRestoredRef.current = false;
        };
      }

      return () => {
        hasRestoredRef.current = false;
      };
    }, [pageKey]),
  );

  const initialScrollY = scrollPositionCache.get(pageKey) ?? 0;

  return {
    scrollViewRef,
    saveScrollPosition,
    contentOffset: { x: 0, y: initialScrollY },
  };
}

export function clearScrollPosition(pageKey: string) {
  scrollPositionCache.delete(pageKey);
}

export function clearAllScrollPositions() {
  scrollPositionCache.clear();
}
