import { useEffect, useRef, useState } from "react";
import { InteractionManager } from "react-native";
import { type Trip, type TripPlace, updateTrip } from "@/features/trips";
import { fetchNewPlaceImages } from "@/features/trips/image-api";
import {
  getLLMPlaceSummary,
  type LLMPlaceSummary,
  shouldGeneratePlaceSummary,
} from "@/features/trips/llm";
import {
  getPlaceCache,
  updateExternalImagesInCache,
  updateLLMInCache,
} from "@/features/trips/place-cache";
import { fetchPoiFromCloud, syncPoiToCloud } from "@/features/trips/poi-cache";
import type { TripPlaceExternalImage } from "@/features/trips/types";
import {
  fetchQuickWeatherByCoordinates,
  getTripPlaceWeatherForecast,
  type TripWeatherDayForecast,
} from "@/features/weather";
import { createDiagnosticLogger } from "@/features/diagnostics";
const placeDetailEnrichmentLogger = createDiagnosticLogger(
  "place-detail-enrichment",
);
type PlaceScheduleEntry = {
  day: Trip["days"][number];
  item: Trip["days"][number]["items"][number];
};

type UsePlaceDetailEnrichmentParams = {
  activeScheduleEntry?: PlaceScheduleEntry;
  isSeedIntro: boolean;
  place?: TripPlace;
  setFavoritePlace: (place: TripPlace | undefined) => void;
  setTrip: (trip: Trip | null) => void;
  trip: Trip | null;
};

export function usePlaceDetailEnrichment({
  activeScheduleEntry,
  isSeedIntro,
  place,
  setFavoritePlace,
  setTrip,
  trip,
}: UsePlaceDetailEnrichmentParams) {
  const [placeWeatherForecast, setPlaceWeatherForecast] = useState<
    TripWeatherDayForecast | undefined
  >();
  const [isWeatherLoading, setWeatherLoading] = useState(false);
  const [llmSummary, setLlmSummary] = useState<LLMPlaceSummary | null>(null);
  const [isLlmLoading, setIsLlmLoading] = useState(false);
  const [externalImages, setExternalImages] = useState<
    TripPlaceExternalImage[]
  >([]);
  const [isLoadingImages, setLoadingImages] = useState(false);
  const [isPostTransitionReady, setPostTransitionReady] = useState(false);
  const lastCloudSyncRef = useRef<string>("");

  useEffect(() => {
    setPostTransitionReady(false);
    setPlaceWeatherForecast(undefined);
    setWeatherLoading(false);
    setLlmSummary(null);
    setIsLlmLoading(false);
    setExternalImages([]);
    setLoadingImages(false);

    let frame: ReturnType<typeof requestAnimationFrame> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      frame = requestAnimationFrame(() => {
        setPostTransitionReady(true);
      });
    });

    return () => {
      task.cancel?.();
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPostTransitionReady || !place) return;

    const amapPoiId = place.externalRefs?.amapPoiId;
    if (!amapPoiId) return;

    const signature = `${amapPoiId}:${place.details ? "1" : "0"}:${place.photos ? "1" : "0"}`;
    if (lastCloudSyncRef.current === signature) return;
    lastCloudSyncRef.current = signature;

    let isActive = true;

    const syncAndHydrate = async () => {
      try {
        const hasAmapData =
          place.details &&
          (place.details.rating != null ||
            place.details.phone ||
            place.details.openingHours ||
            place.details.priceLevel);
        const needsEnrichment = !hasAmapData || !place.photos;

        if (needsEnrichment) {
          const cloudPlace = await fetchPoiFromCloud(amapPoiId);

          if (!isActive || !cloudPlace) return;

          const mergedDetails = cloudPlace.details
            ? { ...cloudPlace.details, ...place.details }
            : place.details;

          const needsUpdate =
            mergedDetails !== place.details ||
            (!place.photos && cloudPlace.photos);

          if (needsUpdate) {
            const enriched = {
              ...place,
              details: mergedDetails,
              photos: place.photos ?? cloudPlace.photos,
            };

            if (trip) {
              const nextTrip = {
                ...trip,
                places: trip.places.map((candidate) =>
                  candidate.id === place.id ? enriched : candidate,
                ),
              };
              setTrip(nextTrip);
              try {
                await updateTrip(nextTrip, {
                  expectedUpdatedAt: trip.updatedAt,
                });
              } catch {}
            } else {
              setFavoritePlace(enriched);
            }

            syncPoiToCloud(enriched).catch(() => {});
          }
        } else {
          syncPoiToCloud(place).catch(() => {});
        }
      } catch {}
    };

    void syncAndHydrate();

    return () => {
      isActive = false;
    };
  }, [isPostTransitionReady, place, setFavoritePlace, setTrip, trip]);

  useEffect(() => {
    if (!place) {
      setPlaceWeatherForecast(undefined);
      setWeatherLoading(false);
      return undefined;
    }

    if (!isPostTransitionReady) {
      setWeatherLoading(false);
      return undefined;
    }

    let isActive = true;

    const loadPlaceWeather = async () => {
      setWeatherLoading(true);

      try {
        let weather: TripWeatherDayForecast | undefined;

        if (trip && activeScheduleEntry) {
          weather = await getTripPlaceWeatherForecast(
            trip,
            place,
            activeScheduleEntry.day,
          );
        } else if (
          typeof place.latitude === "number" &&
          typeof place.longitude === "number"
        ) {
          weather = await fetchQuickWeatherByCoordinates(
            place.latitude,
            place.longitude,
            place.name,
          );
        }

        if (isActive) {
          setPlaceWeatherForecast(weather);
        }
      } catch (weatherError) {
        placeDetailEnrichmentLogger.warn(
          "legacy.warn",
          { args: ["Failed to load place detail weather.", weatherError] },
          "Legacy warning captured",
        );

        if (isActive) {
          setPlaceWeatherForecast(undefined);
        }
      } finally {
        if (isActive) {
          setWeatherLoading(false);
        }
      }
    };

    void loadPlaceWeather();

    return () => {
      isActive = false;
    };
  }, [activeScheduleEntry, isPostTransitionReady, place, trip]);

  useEffect(() => {
    if (!place) {
      setLlmSummary(null);
      setIsLlmLoading(false);
      return;
    }

    if (isSeedIntro) {
      setLlmSummary(null);
      setIsLlmLoading(false);
      return;
    }

    if (!isPostTransitionReady) {
      setIsLlmLoading(false);
      return;
    }

    let isActive = true;

    const loadIntro = async () => {
      try {
        const amapPoiId = place.externalRefs?.amapPoiId;

        if (amapPoiId) {
          const cached = await getPlaceCache(amapPoiId);

          if (!isActive) return;

          if (cached?.llm) {
            setLlmSummary(cached.llm as LLMPlaceSummary);
            return;
          }
        }

        const llmCacheKey = amapPoiId ?? place.id;
        const canGenerateSummary = shouldGeneratePlaceSummary({
          placeId: llmCacheKey,
          placeName: place.name,
          category: place.category,
          poiGroup: place.poiGroup,
        });

        if (!canGenerateSummary) {
          return;
        }

        if (isActive) setIsLlmLoading(true);
        const llm = await getLLMPlaceSummary(
          llmCacheKey,
          place.name,
          place.externalRefs?.amapCityName ?? place.area,
          undefined,
          place.category,
          place.address,
        );

        if (!isActive) return;

        if (llm) {
          if (amapPoiId) {
            await updateLLMInCache(amapPoiId, { text: llm.text });
          }
          setLlmSummary(llm);
        }
      } catch {
      } finally {
        if (isActive) setIsLlmLoading(false);
      }
    };

    void loadIntro();

    return () => {
      isActive = false;
    };
  }, [isPostTransitionReady, isSeedIntro, place]);

  useEffect(() => {
    if (!place) {
      setExternalImages([]);
      return;
    }

    if (!isPostTransitionReady) {
      setLoadingImages(false);
      return;
    }

    let isActive = true;

    const loadExternalImages = async () => {
      const amapPoiId = place.externalRefs?.amapPoiId;

      if (amapPoiId) {
        const cached = await getPlaceCache(amapPoiId);

        if (!isActive) return;

        if (cached?.externalImages && cached.externalImages.length > 0) {
          setExternalImages(cached.externalImages);
          return;
        }
      }

      setLoadingImages(true);

      try {
        const cachedUrls = place.photos?.map((photo) => photo.url) ?? [];
        const newImages = await fetchNewPlaceImages(
          place.name,
          place.area,
          cachedUrls,
        );

        if (!isActive) return;

        if (newImages.length > 0) {
          setExternalImages(newImages);

          if (amapPoiId) {
            await updateExternalImagesInCache(amapPoiId, newImages);
          }
        }
      } catch {
      } finally {
        if (isActive) {
          setLoadingImages(false);
        }
      }
    };

    void loadExternalImages();

    return () => {
      isActive = false;
    };
  }, [isPostTransitionReady, place]);

  return {
    externalImages,
    isLlmLoading,
    isLoadingImages,
    isPostTransitionReady,
    isWeatherLoading,
    llmSummary,
    placeWeatherForecast,
  };
}
