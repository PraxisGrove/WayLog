import type { Trip, TripPlace } from "./types";

type TripDestinationSource = Pick<Trip, "destination" | "places">;

const destinationSeparator = " · ";

const directControlledCities = ["北京市", "上海市", "天津市", "重庆市"];

const ignoredLocationLabels = new Set([
  "中国",
  "中华人民共和国",
  "自定义地点",
  "高德地图地点",
  "地址信息待补充",
  "稍后补充详细地址",
]);

function cleanLocationText(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/[()（）【】[\]]/g, "")
    .trim();
}

function cleanDestinationListText(value: string): string {
  return getDelimitedLocationParts(value).join(destinationSeparator);
}

function isIgnoredLocationPart(value: string): boolean {
  return !value || ignoredLocationLabels.has(value) || /^\d+$/.test(value);
}

function isProvinceLevelName(value: string): boolean {
  return (
    value.endsWith("省") ||
    value.endsWith("自治区") ||
    value.endsWith("特别行政区")
  );
}

function isPrefectureLevelName(value: string): boolean {
  return (
    directControlledCities.includes(value) ||
    value.endsWith("自治州") ||
    value.endsWith("地区") ||
    value.endsWith("盟") ||
    (value.endsWith("市") && !isProvinceLevelName(value))
  );
}

function getDelimitedLocationParts(value: string): string[] {
  return value
    .split(/[·,，、|/\\>-]+/)
    .map(cleanLocationText)
    .filter((part) => !isIgnoredLocationPart(part));
}

function getPrefectureFromParts(value: string): string | undefined {
  const parts = getDelimitedLocationParts(value);

  if (parts.length <= 1) {
    return undefined;
  }

  const directCity = parts.find((part) =>
    directControlledCities.includes(part),
  );

  if (directCity) {
    return directCity;
  }

  return parts.find(
    (part) => isPrefectureLevelName(part) && !isProvinceLevelName(part),
  );
}

function getPrefectureFromCompactText(value: string): string | undefined {
  const compactValue = cleanLocationText(value);
  const directCity = directControlledCities.find((city) =>
    compactValue.includes(city),
  );

  if (directCity) {
    return directCity;
  }

  const afterProvinceMatch =
    /(?:省|自治区|特别行政区)(.{2,30}?(?:自治州|地区|盟|市))/.exec(
      compactValue,
    );

  if (afterProvinceMatch?.[1]) {
    return afterProvinceMatch[1];
  }

  const leadingPrefectureMatch = /^(.{2,20}?(?:自治州|地区|盟|市))/.exec(
    compactValue,
  );

  return leadingPrefectureMatch?.[1];
}

function inferPrefectureDestination(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const fromParts = getPrefectureFromParts(value);

  if (fromParts) {
    return fromParts;
  }

  return getPrefectureFromCompactText(value);
}

function inferTripPlaceDestination(place: TripPlace): string | undefined {
  return [place.area, place.address, place.note]
    .map(inferPrefectureDestination)
    .find((destination): destination is string => Boolean(destination));
}

export function inferTripDestinationsFromPlaces(places: TripPlace[]): string[] {
  const destinationNames = new Set<string>();

  places.forEach((place) => {
    const destination = inferTripPlaceDestination(place);

    if (destination) {
      destinationNames.add(destination);
    }
  });

  return [...destinationNames];
}

export function inferTripDestinationFromPlaces(places: TripPlace[]): string {
  return cleanDestinationListText(
    inferTripDestinationsFromPlaces(places).join(destinationSeparator),
  );
}

export function resolveTripDestination(trip: TripDestinationSource): string {
  return (
    inferTripDestinationFromPlaces(trip.places) ||
    cleanDestinationListText(trip.destination)
  );
}

export function formatTripDestination(
  trip: TripDestinationSource,
  fallback = "目的地未定",
): string {
  return resolveTripDestination(trip) || fallback;
}
