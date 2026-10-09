import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Linking, Platform } from "react-native";
import {
  buildNativeMapRouteUrls,
  createRouteInputFromSegment,
  getAvailableMapUrlCandidates,
  getPreferredTripRouteMode,
  getUserVisibleRouteMessage,
  hasRouteModeResult,
  isRouteModePending,
  prioritizeDefaultNavigationCandidates,
  type Trip,
  type TripDayRouteSegment,
  type TripRouteMode,
  type TripRoutePreference,
  type TripRouteSegmentResult,
} from "@/features/trips";
import type { RouteSegmentActionTarget } from "../../routes/types";
import { createDiagnosticLogger } from "@/features/diagnostics";
const tripRouteActionsLogger = createDiagnosticLogger("trip-route-actions");
type UseRouteActionsParams = {
  allDaySegments: Record<string, TripDayRouteSegment[]>;
  clearRoutePreferenceError: () => void;
  markRouteModePendingIntent: (segmentId: string, mode: TripRouteMode) => void;
  persistTripUpdate: (
    nextTrip: Trip,
    fallbackTrip: Trip,
    errorMessage?: string,
  ) => Promise<boolean>;
  resetRouteFetchSnapshot: () => void;
  routeModePendingCounts: Record<string, number>;
  routeModePendingIntents: Record<string, boolean>;
  routePreference: TripRoutePreference;
  routeSegmentModes: Record<string, TripRouteMode>;
  routeSegmentResults: Record<string, TripRouteSegmentResult>;
  selectedDayId?: string;
  selectedDaySegments: TripDayRouteSegment[];
  setActionError: (message: string) => void;
  setRouteSegmentModes: Dispatch<SetStateAction<Record<string, TripRouteMode>>>;
  trip: Trip | null;
};

export function useRouteActions({
  allDaySegments,
  clearRoutePreferenceError,
  markRouteModePendingIntent,
  persistTripUpdate,
  resetRouteFetchSnapshot,
  routeModePendingCounts,
  routeModePendingIntents,
  routePreference,
  routeSegmentModes,
  routeSegmentResults,
  selectedDayId,
  selectedDaySegments,
  setActionError,
  setRouteSegmentModes,
  trip,
}: UseRouteActionsParams) {
  const [activeRouteSegmentTarget, setActiveRouteSegmentTarget] = useState<
    RouteSegmentActionTarget | undefined
  >();
  const [isEditingRoutePreference, setEditingRoutePreference] = useState(false);
  const [routeNavigationError, setRouteNavigationError] = useState("");

  const activeRouteSegment = useMemo(() => {
    if (!activeRouteSegmentTarget) {
      return undefined;
    }

    return allDaySegments[activeRouteSegmentTarget.dayId]?.find(
      (segment) => segment.id === activeRouteSegmentTarget.segmentId,
    );
  }, [activeRouteSegmentTarget, allDaySegments]);

  const activeRouteSegmentResult = activeRouteSegment
    ? routeSegmentResults[activeRouteSegment.id]
    : undefined;

  const activeRouteSegmentMode: TripRouteMode = activeRouteSegment
    ? (routeSegmentModes[activeRouteSegment.id] ??
      (activeRouteSegmentResult
        ? getPreferredTripRouteMode(
            activeRouteSegmentResult.entry.modeOptions,
            routePreference,
          )
        : undefined) ??
      "driving")
    : "driving";

  const isActiveRouteSegmentModePending = isRouteModePending(
    routeModePendingCounts,
    routeModePendingIntents,
    activeRouteSegment?.id,
    activeRouteSegmentMode,
  );

  const activeRouteUserMessage = getUserVisibleRouteMessage(
    activeRouteSegmentResult,
    activeRouteSegmentMode,
    isActiveRouteSegmentModePending,
  );

  const closeRouteSegmentActions = useCallback(() => {
    setActiveRouteSegmentTarget(undefined);
    setEditingRoutePreference(false);
    clearRoutePreferenceError();
    setRouteNavigationError("");
  }, [clearRoutePreferenceError]);

  useEffect(() => {
    if (activeRouteSegmentTarget && !activeRouteSegment) {
      closeRouteSegmentActions();
    }
  }, [activeRouteSegment, activeRouteSegmentTarget, closeRouteSegmentActions]);

  const openRouteSegmentActions = useCallback(
    (segment: TripDayRouteSegment, dayId = selectedDayId ?? "") => {
      setActiveRouteSegmentTarget({
        dayId,
        segmentId: segment.id,
      });
      setRouteNavigationError("");
      setActionError("");
    },
    [selectedDayId, setActionError],
  );

  const selectRouteSegmentMode = useCallback(
    (segmentId: string, mode: TripRouteMode) => {
      setRouteSegmentModes((currentModes) => ({
        ...currentModes,
        [segmentId]: mode,
      }));

      if (trip) {
        const nextTrip: Trip = {
          ...trip,
          routeModeOverrides: {
            ...trip.routeModeOverrides,
            [segmentId]: mode,
          },
          updatedAt: new Date().toISOString(),
        };
        void persistTripUpdate(nextTrip, trip, "保存交通方式失败");
      }

      const segment = selectedDaySegments.find((item) => item.id === segmentId);
      const currentResult = routeSegmentResults[segmentId];
      const shouldShowPending = Boolean(
        segment && !hasRouteModeResult(currentResult, mode),
      );

      if (shouldShowPending && segment) {
        resetRouteFetchSnapshot();
        markRouteModePendingIntent(segment.id, mode);
      }

      setRouteNavigationError("");
    },
    [
      markRouteModePendingIntent,
      persistTripUpdate,
      resetRouteFetchSnapshot,
      routeSegmentResults,
      selectedDaySegments,
      setRouteSegmentModes,
      trip,
    ],
  );

  const openRoutePreferenceEditor = useCallback(() => {
    setEditingRoutePreference(true);
    clearRoutePreferenceError();
  }, [clearRoutePreferenceError]);

  const closeRoutePreferenceEditor = useCallback(() => {
    setEditingRoutePreference(false);
    clearRoutePreferenceError();
  }, [clearRoutePreferenceError]);

  const openNavigationUrl = useCallback(
    async (url: string): Promise<boolean> => {
      try {
        if (Platform.OS === "web") {
          const webWindow = globalThis.window;
          webWindow?.open(url, "_blank", "noopener,noreferrer");
          return Boolean(webWindow);
        }

        await Linking.openURL(url);
        return true;
      } catch (openError) {
        tripRouteActionsLogger.warn(
          "legacy.warn",
          { args: ["Failed to open route navigation map.", openError] },
          "Legacy warning captured",
        );
        return false;
      }
    },
    [],
  );

  const startActiveRouteNavigation = useCallback(async () => {
    if (!activeRouteSegment) {
      return;
    }

    const routeInput = createRouteInputFromSegment(
      activeRouteSegment,
      activeRouteSegmentResult,
    );
    const candidates = prioritizeDefaultNavigationCandidates(
      buildNativeMapRouteUrls(routeInput, activeRouteSegmentMode, Platform.OS),
      Platform.OS,
    );
    const availableCandidates =
      Platform.OS === "web"
        ? candidates
        : await getAvailableMapUrlCandidates(candidates, Linking.canOpenURL);
    const launchCandidates =
      availableCandidates.length > 0 ? availableCandidates : candidates;

    if (launchCandidates.length === 0) {
      setRouteNavigationError(
        "当前路线缺少可用的导航目标，请先补充地点坐标或地址",
      );
      return;
    }

    if (availableCandidates.length === 0 && Platform.OS !== "web") {
      setRouteNavigationError(
        "未能确认已安装地图，可以直接选择一个地图尝试打开",
      );
    } else {
      setRouteNavigationError("");
    }

    for (const candidate of launchCandidates) {
      const didOpen = await openNavigationUrl(candidate.url);

      if (didOpen) {
        closeRouteSegmentActions();
        return;
      }
    }

    if (launchCandidates.length > 0) {
      setRouteNavigationError(
        `${launchCandidates[0]?.label}暂时打不开，请稍后重试`,
      );
    }
  }, [
    activeRouteSegment,
    activeRouteSegmentMode,
    activeRouteSegmentResult,
    closeRouteSegmentActions,
    openNavigationUrl,
  ]);

  return {
    activeRouteSegment,
    activeRouteSegmentMode,
    activeRouteSegmentResult,
    activeRouteUserMessage,
    closeRoutePreferenceEditor,
    closeRouteSegmentActions,
    isActiveRouteSegmentModePending,
    isEditingRoutePreference,
    openRoutePreferenceEditor,
    openRouteSegmentActions,
    routeNavigationError,
    selectRouteSegmentMode,
    startActiveRouteNavigation,
  };
}
