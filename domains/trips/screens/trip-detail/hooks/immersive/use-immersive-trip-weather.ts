import { useEffect, useState } from "react";

import type { Trip } from "@/features/trips";
import { getTripWeather, type TripWeatherOverview } from "@/features/weather";

type UseTripWeatherParams = {
  trip: Trip | null;
};

export function useImmersiveTripWeather({ trip }: UseTripWeatherParams) {
  const [tripWeather, setTripWeather] = useState<
    TripWeatherOverview | undefined
  >();

  useEffect(() => {
    if (!trip) {
      setTripWeather(undefined);
      return undefined;
    }

    let isActive = true;

    const loadTripWeather = async () => {
      const weather = await getTripWeather(trip);

      if (isActive) {
        setTripWeather(weather);
      }
    };

    void loadTripWeather();

    return () => {
      isActive = false;
    };
  }, [trip]);

  return {
    tripWeather,
  };
}
