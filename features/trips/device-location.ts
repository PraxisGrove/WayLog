import type { TripGeoCoordinate } from "./types";

type DeviceGeolocation = {
  getCurrentPosition: (
    success: (position: {
      coords: { latitude: number; longitude: number };
    }) => void,
    error?: (error: unknown) => void,
    options?: {
      enableHighAccuracy?: boolean;
      maximumAge?: number;
      timeout?: number;
    },
  ) => void;
};

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getDeviceGeolocation(): DeviceGeolocation | undefined {
  return (
    globalThis as typeof globalThis & {
      navigator?: { geolocation?: DeviceGeolocation };
    }
  ).navigator?.geolocation;
}

function getBrowserDeviceCoordinates(
  geolocation: DeviceGeolocation,
): Promise<TripGeoCoordinate> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) {
          reject(new Error("Device geolocation returned invalid coordinates."));
          return;
        }

        resolve({ latitude, longitude });
      },
      reject,
      {
        enableHighAccuracy: true,
        maximumAge: 60 * 1000,
        timeout: 10 * 1000,
      },
    );
  });
}

async function getExpoDeviceCoordinates(): Promise<TripGeoCoordinate> {
  const Location = await import("expo-location");
  const permission = await Location.requestForegroundPermissionsAsync();

  if (!permission.granted) {
    throw new Error("Device location permission was not granted.");
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  const { latitude, longitude } = position.coords;

  if (!isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) {
    throw new Error("Device location returned invalid coordinates.");
  }

  return { latitude, longitude };
}

export function getCurrentDeviceCoordinates(): Promise<TripGeoCoordinate> {
  const geolocation = getDeviceGeolocation();

  if (geolocation) {
    return getBrowserDeviceCoordinates(geolocation);
  }

  return getExpoDeviceCoordinates();
}
