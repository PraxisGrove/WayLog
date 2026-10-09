import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultTripRoutePreference,
  createTripRouteSegmentFetchPlan,
  getPreferredTripRouteMode,
  getRouteModePendingKey,
  getRouteRetryDelayMs,
  getRouteSegmentWithCache,
  getTripRoutePreference,
  hasRouteModeResult,
  parseRouteModePendingKey,
  saveTripRoutePreference,
  type Trip,
  type TripDay,
  type TripDayRouteSegment,
  type TripRouteMode,
  type TripRoutePreference,
  type TripRouteSegmentResult,
} from "@/features/trips";
import { createDiagnosticLogger } from "@/features/diagnostics";
const tripRouteSegmentsHookLogger = createDiagnosticLogger(
  "trip-route-segments-hook",
);
type UseTripRouteSegmentsParams = {
  isOverviewSelected: boolean;
  selectedDay?: TripDay;
  selectedDaySegments: TripDayRouteSegment[];
  trip: Trip | null;
};

export function useTripRouteSegments({
  isOverviewSelected,
  selectedDay,
  selectedDaySegments,
  trip,
}: UseTripRouteSegmentsParams) {
  const [routeSegmentResults, setRouteSegmentResults] = useState<
    Record<string, TripRouteSegmentResult>
  >({});
  const [routeSegmentModes, setRouteSegmentModes] = useState<
    Record<string, TripRouteMode>
  >({});
  const [routeModePendingCounts, setRouteModePendingCounts] = useState<
    Record<string, number>
  >({});
  const [routeModePendingIntents, setRouteModePendingIntents] = useState<
    Record<string, boolean>
  >({});
  const [routePreference, setRoutePreference] = useState<TripRoutePreference>(
    defaultTripRoutePreference,
  );
  const [routePreferenceError, setRoutePreferenceError] = useState("");

  const lastAppliedRoutePreferenceRef = useRef<TripRoutePreference>(
    defaultTripRoutePreference,
  );
  const lastRouteFetchSnapshotsRef = useRef<Record<string, string>>({});
  const routeRetryAttemptsRef = useRef<Record<string, number>>({});
  const routeRetryTimersRef = useRef<
    Record<string, ReturnType<typeof setTimeout>>
  >({});
  const routeSegmentResultsRef = useRef<Record<string, TripRouteSegmentResult>>(
    {},
  );
  const isRouteSegmentHookMountedRef = useRef(true);

  const incrementRouteModePending = useCallback(
    (segmentId: string, mode: TripRouteMode) => {
      const pendingKey = getRouteModePendingKey(segmentId, mode);

      setRouteModePendingCounts((currentCounts) => ({
        ...currentCounts,
        [pendingKey]: (currentCounts[pendingKey] ?? 0) + 1,
      }));
    },
    [],
  );

  const decrementRouteModePending = useCallback(
    (segmentId: string, mode: TripRouteMode) => {
      const pendingKey = getRouteModePendingKey(segmentId, mode);

      setRouteModePendingCounts((currentCounts) => {
        const currentCount = currentCounts[pendingKey] ?? 0;

        if (currentCount <= 1) {
          const nextCounts = { ...currentCounts };
          delete nextCounts[pendingKey];
          return nextCounts;
        }

        return {
          ...currentCounts,
          [pendingKey]: currentCount - 1,
        };
      });
    },
    [],
  );

  const markRouteModePendingIntent = useCallback(
    (segmentId: string, mode: TripRouteMode) => {
      const pendingKey = getRouteModePendingKey(segmentId, mode);

      setRouteModePendingIntents((currentIntents) => ({
        ...currentIntents,
        [pendingKey]: true,
      }));
    },
    [],
  );

  const clearRouteModePendingIntent = useCallback(
    (segmentId: string, mode: TripRouteMode) => {
      const pendingKey = getRouteModePendingKey(segmentId, mode);

      setRouteModePendingIntents((currentIntents) => {
        if (!currentIntents[pendingKey]) {
          return currentIntents;
        }

        const nextIntents = { ...currentIntents };
        delete nextIntents[pendingKey];
        return nextIntents;
      });
    },
    [],
  );

  const resetRouteFetchSnapshot = useCallback(() => {
    lastRouteFetchSnapshotsRef.current = {};
  }, []);

  const clearRoutePreferenceError = useCallback(() => {
    setRoutePreferenceError("");
  }, []);

  const updateRoutePreference = useCallback(
    (nextPreference: TripRoutePreference) => {
      setRoutePreference(nextPreference);
      setRoutePreferenceError("");

      saveTripRoutePreference(nextPreference).catch((preferenceError) => {
        tripRouteSegmentsHookLogger.warn(
          "legacy.warn",
          { args: ["Failed to save route preference.", preferenceError] },
          "Legacy warning captured",
        );
        setRoutePreferenceError("偏好保存失败，请稍后再试");
      });
    },
    [],
  );

  useEffect(() => {
    routeSegmentResultsRef.current = routeSegmentResults;
  }, [routeSegmentResults]);

  useEffect(() => {
    setRouteModePendingIntents((currentIntents) => {
      let didChange = false;
      const nextIntents = { ...currentIntents };

      Object.keys(nextIntents).forEach((pendingKey) => {
        const parsedPendingKey = parseRouteModePendingKey(pendingKey);

        if (
          !parsedPendingKey ||
          hasRouteModeResult(
            routeSegmentResults[parsedPendingKey.segmentId],
            parsedPendingKey.mode,
          )
        ) {
          delete nextIntents[pendingKey];
          didChange = true;
        }
      });

      return didChange ? nextIntents : currentIntents;
    });
  }, [routeSegmentResults]);

  const isDayRouteLoading = useMemo(() => {
    if (!selectedDay || isOverviewSelected) {
      return false;
    }

    if (selectedDaySegments.length === 0) {
      return false;
    }

    const allLoaded = selectedDaySegments.every((segment) => {
      const result = routeSegmentResults[segment.id];
      const selectedMode =
        routeSegmentModes[segment.id] ??
        (result
          ? getPreferredTripRouteMode(result.entry.modeOptions, routePreference)
          : undefined);

      return Boolean(
        result &&
          result.entry.status === "ready" &&
          selectedMode &&
          result.entry.modeOptions.some(
            (option) => option.mode === selectedMode,
          ),
      );
    });

    return !allLoaded;
  }, [
    isOverviewSelected,
    routePreference,
    routeSegmentModes,
    routeSegmentResults,
    selectedDay,
    selectedDaySegments,
  ]);

  useEffect(() => {
    let isActive = true;

    void getTripRoutePreference()
      .then((preference) => {
        if (isActive) {
          setRoutePreference(preference);
        }
      })
      .catch((preferenceError) => {
        tripRouteSegmentsHookLogger.warn(
          "legacy.warn",
          { args: ["Failed to load route preference.", preferenceError] },
          "Legacy warning captured",
        );
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (lastAppliedRoutePreferenceRef.current === routePreference) {
      return;
    }

    lastAppliedRoutePreferenceRef.current = routePreference;

    setRouteSegmentModes((currentModes) => {
      let didChange = false;
      const nextModes = { ...currentModes };

      Object.entries(routeSegmentResults).forEach(([segmentId, result]) => {
        const preferredMode = getPreferredTripRouteMode(
          result.entry.modeOptions,
          routePreference,
        );

        if (preferredMode && !nextModes[segmentId]) {
          nextModes[segmentId] = preferredMode;
          didChange = true;
        }
      });

      return didChange ? nextModes : currentModes;
    });
  }, [routePreference, routeSegmentResults]);

  useEffect(() => {
    if (!trip?.routeModeOverrides) return;
    setRouteSegmentModes((currentModes) => ({
      ...trip.routeModeOverrides,
      ...currentModes,
    }));
  }, [trip?.routeModeOverrides]);

  useEffect(() => {
    isRouteSegmentHookMountedRef.current = true;
    lastRouteFetchSnapshotsRef.current = {};
    Object.values(routeRetryTimersRef.current).forEach((timer) => {
      clearTimeout(timer);
    });
    routeRetryTimersRef.current = {};
    routeRetryAttemptsRef.current = {};
    setRouteModePendingCounts({});
    setRouteModePendingIntents({});

    return () => {
      isRouteSegmentHookMountedRef.current = false;
      Object.values(routeRetryTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      routeRetryTimersRef.current = {};
      routeRetryAttemptsRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!selectedDay) {
      Object.values(routeRetryTimersRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      routeRetryTimersRef.current = {};
      routeRetryAttemptsRef.current = {};
      setRouteSegmentResults({});
      setRouteModePendingCounts({});
      setRouteModePendingIntents({});
      lastRouteFetchSnapshotsRef.current = {};
      return;
    }

    const fetchPlan = createTripRouteSegmentFetchPlan({
      currentResults: routeSegmentResultsRef.current,
      previousFetchSnapshots: lastRouteFetchSnapshotsRef.current,
      routeSegmentModes,
      segments: selectedDaySegments,
    });

    if (
      fetchPlan.removedSegmentIds.length === 0 &&
      fetchPlan.segmentsToFetch.length === 0
    ) {
      return;
    }

    const changedSegmentIds = new Set([
      ...fetchPlan.removedSegmentIds,
      ...fetchPlan.segmentsToFetch.map((item) => item.segment.id),
    ]);
    changedSegmentIds.forEach((segmentId) => {
      const timer = routeRetryTimersRef.current[segmentId];

      if (timer) {
        clearTimeout(timer);
        delete routeRetryTimersRef.current[segmentId];
      }

      delete routeRetryAttemptsRef.current[segmentId];
    });
    lastRouteFetchSnapshotsRef.current = fetchPlan.nextFetchSnapshots;
    routeSegmentResultsRef.current = fetchPlan.retainedResults;
    setRouteSegmentResults(fetchPlan.retainedResults);

    if (fetchPlan.segmentsToFetch.length === 0) {
      return;
    }

    const clearRouteRetry = (segmentId: string) => {
      const timer = routeRetryTimersRef.current[segmentId];

      if (timer) {
        clearTimeout(timer);
        delete routeRetryTimersRef.current[segmentId];
      }

      delete routeRetryAttemptsRef.current[segmentId];
    };

    const shouldRetryRouteResult = (
      segmentId: string,
      result: TripRouteSegmentResult,
      selectedModeOverride?: TripRouteMode,
    ) => {
      const activeMode = selectedModeOverride ?? routeSegmentModes[segmentId];

      return (
        result.entry.status === "unavailable" ||
        Boolean(
          activeMode &&
            !result.entry.modeOptions.some(
              (option) => option.mode === activeMode,
            ),
        )
      );
    };

    const scheduleRouteRetry = (
      segment: TripDayRouteSegment,
      fetchKey: string,
    ) => {
      const currentAttempt = routeRetryAttemptsRef.current[segment.id] ?? 0;

      if (routeRetryTimersRef.current[segment.id]) {
        return;
      }

      routeRetryAttemptsRef.current[segment.id] = currentAttempt + 1;
      routeRetryTimersRef.current[segment.id] = setTimeout(() => {
        delete routeRetryTimersRef.current[segment.id];

        void (async () => {
          if (
            !isRouteSegmentHookMountedRef.current ||
            lastRouteFetchSnapshotsRef.current[segment.id] !== fetchKey
          ) {
            return;
          }

          const activeMode = routeSegmentModes[segment.id];
          const shouldTrackPending = Boolean(
            activeMode &&
              !hasRouteModeResult(
                routeSegmentResultsRef.current[segment.id],
                activeMode,
              ),
          );

          if (shouldTrackPending && activeMode) {
            incrementRouteModePending(segment.id, activeMode);
            clearRouteModePendingIntent(segment.id, activeMode);
          }

          try {
            const retryResult = await getRouteSegmentWithCache(segment, {
              forceRefresh: true,
              mode: activeMode,
              reason: activeMode ? "user" : "auto",
            });

            if (
              !isRouteSegmentHookMountedRef.current ||
              lastRouteFetchSnapshotsRef.current[segment.id] !== fetchKey
            ) {
              return;
            }

            setRouteSegmentResults((currentResults) => ({
              ...currentResults,
              [segment.id]: retryResult,
            }));

            if (retryResult.entry.diagnosticMessage) {
              tripRouteSegmentsHookLogger.warn(
                "legacy.warn",
                {
                  args: [
                    "Route segment diagnostic (retry).",
                    {
                      diagnosticMessage: retryResult.entry.diagnosticMessage,
                      fromLabel: retryResult.entry.fromLabel,
                      segmentId: segment.id,
                      toLabel: retryResult.entry.toLabel,
                    },
                  ],
                },
                "Legacy warning captured",
              );
            }

            const preferredMode = getPreferredTripRouteMode(
              retryResult.entry.modeOptions,
              routePreference,
            );

            if (preferredMode) {
              setRouteSegmentModes((currentModes) =>
                currentModes[segment.id]
                  ? currentModes
                  : {
                      ...currentModes,
                      [segment.id]: preferredMode,
                    },
              );
            }

            if (
              shouldRetryRouteResult(
                segment.id,
                retryResult,
                preferredMode ?? routeSegmentModes[segment.id],
              )
            ) {
              scheduleRouteRetry(segment, fetchKey);
            } else {
              clearRouteRetry(segment.id);
            }
          } catch (retryError) {
            tripRouteSegmentsHookLogger.warn(
              "legacy.warn",
              { args: ["Failed to retry route segment preview.", retryError] },
              "Legacy warning captured",
            );

            if (
              isRouteSegmentHookMountedRef.current &&
              lastRouteFetchSnapshotsRef.current[segment.id] === fetchKey
            ) {
              scheduleRouteRetry(segment, fetchKey);
            }
          } finally {
            if (shouldTrackPending && activeMode) {
              decrementRouteModePending(segment.id, activeMode);
            }
          }
        })();
      }, getRouteRetryDelayMs(currentAttempt));
    };

    void (async () => {
      for (const planItem of fetchPlan.segmentsToFetch) {
        if (
          !isRouteSegmentHookMountedRef.current ||
          lastRouteFetchSnapshotsRef.current[planItem.segment.id] !==
            planItem.fetchKey
        ) {
          return;
        }

        const segment = planItem.segment;
        const selectedMode = planItem.selectedMode;
        const shouldTrackPending = Boolean(
          selectedMode &&
            !hasRouteModeResult(
              routeSegmentResultsRef.current[segment.id],
              selectedMode,
            ),
        );

        if (shouldTrackPending && selectedMode) {
          incrementRouteModePending(segment.id, selectedMode);
          clearRouteModePendingIntent(segment.id, selectedMode);
        }

        try {
          const result = await getRouteSegmentWithCache(segment, {
            mode: selectedMode,
            reason: selectedMode ? "user" : "auto",
          });

          if (
            !isRouteSegmentHookMountedRef.current ||
            lastRouteFetchSnapshotsRef.current[segment.id] !== planItem.fetchKey
          ) {
            return;
          }

          setRouteSegmentResults((currentResults) => ({
            ...currentResults,
            [segment.id]: result,
          }));

          if (result.entry.diagnosticMessage) {
            tripRouteSegmentsHookLogger.warn(
              "legacy.warn",
              {
                args: [
                  "Route segment diagnostic.",
                  {
                    diagnosticMessage: result.entry.diagnosticMessage,
                    fromLabel: result.entry.fromLabel,
                    segmentId: segment.id,
                    toLabel: result.entry.toLabel,
                  },
                ],
              },
              "Legacy warning captured",
            );
          }

          const defaultMode = getPreferredTripRouteMode(
            result.entry.modeOptions,
            routePreference,
          );

          if (defaultMode) {
            setRouteSegmentModes((currentModes) =>
              currentModes[segment.id]
                ? currentModes
                : {
                    ...currentModes,
                    [segment.id]: defaultMode,
                  },
            );
          }

          if (
            shouldRetryRouteResult(
              segment.id,
              result,
              defaultMode ?? routeSegmentModes[segment.id],
            )
          ) {
            scheduleRouteRetry(segment, planItem.fetchKey);
          } else {
            clearRouteRetry(segment.id);
          }
        } catch (routeError) {
          tripRouteSegmentsHookLogger.warn(
            "legacy.warn",
            { args: ["Failed to load route segment preview.", routeError] },
            "Legacy warning captured",
          );
          scheduleRouteRetry(segment, planItem.fetchKey);
        } finally {
          if (shouldTrackPending && selectedMode) {
            decrementRouteModePending(segment.id, selectedMode);
          }
        }
      }
    })();

    return undefined;
  }, [
    clearRouteModePendingIntent,
    decrementRouteModePending,
    incrementRouteModePending,
    routePreference,
    routeSegmentModes,
    selectedDay,
    selectedDaySegments,
  ]);

  return {
    clearRoutePreferenceError,
    isDayRouteLoading,
    markRouteModePendingIntent,
    resetRouteFetchSnapshot,
    routeModePendingCounts,
    routeModePendingIntents,
    routePreference,
    routePreferenceError,
    routeSegmentModes,
    routeSegmentResults,
    setRouteSegmentModes,
    updateRoutePreference,
  };
}
