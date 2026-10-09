import {
  type AmapWeatherCast,
  isAmapWebServiceConfigured,
  queryAmapWeatherForecast,
  reverseGeocodeAmapCoordinate,
} from "../trips/amap";
import { createDiagnosticLogger } from "../diagnostics";
import {
  addDaysToDateKey,
  compareDateKeys,
  createDateKey,
  parseDateKey,
} from "../trips/date";
import { getPlaceForTripDayItem } from "../trips/day-items";
import { getSortedTripDayItems } from "../trips/format";
import type { Trip, TripDay, TripPlace } from "../trips/types";

const weatherLogger = createDiagnosticLogger("weather");

export type TripWeatherCondition =
  | "sunny"
  | "cloudy"
  | "rain"
  | "storm"
  | "hot"
  | "windy"
  | "foggy";

export type TripWeatherSource = {
  label: string;
  type: "amap" | "mock" | "open-meteo";
};

export type TripWeatherLocation = {
  amapAdcode?: string;
  area?: string;
  latitude: number;
  longitude: number;
  name: string;
  placeId?: string;
};

export type TripWeatherDayForecast = {
  id: string;
  condition: TripWeatherCondition;
  conditionLabel: string;
  dateKey?: string;
  dayId: string;
  dayIndex: number;
  label: string;
  location?: TripWeatherLocation;
  precipitationChance: number;
  riskLabels: string[];
  source: TripWeatherSource;
  summary: string;
  suggestion: string;
  temperatureHigh: number;
  temperatureLow: number;
  uvIndex: number;
  windLevel: string;
};

export type TripWeatherOverview = {
  current: TripWeatherDayForecast;
  days: TripWeatherDayForecast[];
  destination: string;
  generatedAt: string;
  headline: string;
  source: TripWeatherSource;
  suggestion: string;
};

type MockWeatherPreset = Omit<
  TripWeatherDayForecast,
  | "dateKey"
  | "dayId"
  | "dayIndex"
  | "id"
  | "label"
  | "location"
  | "source"
  | "temperatureHigh"
  | "temperatureLow"
> & {
  baseHigh: number;
  baseLow: number;
};

type OpenMeteoDailyForecast = {
  precipitation_probability_max?: (number | null)[];
  temperature_2m_max?: (number | null)[];
  temperature_2m_min?: (number | null)[];
  time?: string[];
  uv_index_max?: (number | null)[];
  weather_code?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
};

type OpenMeteoForecastResponse = {
  daily?: OpenMeteoDailyForecast;
};

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const openMeteoForecastCache = new Map<
  string,
  Promise<TripWeatherDayForecast | undefined>
>();

const amapForecastCache = new Map<
  string,
  Promise<TripWeatherDayForecast | undefined>
>();

const amapAdcodeCache = new Map<string, Promise<string | undefined>>();

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const amapSource: TripWeatherSource = {
  label: "高德天气",
  type: "amap",
};

const openMeteoSource: TripWeatherSource = {
  label: "Open-Meteo",
  type: "open-meteo",
};

const mockWeatherSource: TripWeatherSource = {
  label: "本地模拟",
  type: "mock",
};

export function getTripWeatherSourceBadgeLabel(
  source: TripWeatherSource,
): string | undefined {
  return source.type === "mock" ? "预测" : undefined;
}

function formatSignedTemperature(temperature: number): string {
  return temperature < 0 ? `负${Math.abs(temperature)}` : `${temperature}`;
}

export function formatTemperatureRange(
  temperatureLow: number,
  temperatureHigh: number,
): string {
  return `${formatSignedTemperature(temperatureLow)}–${formatSignedTemperature(temperatureHigh)}°C`;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

const MOCK_WEATHER_PRESETS: MockWeatherPreset[] = [
  {
    condition: "sunny",
    conditionLabel: "晴朗",
    precipitationChance: 12,
    riskLabels: ["防晒"],
    summary: "阳光充足，适合城市漫步、观景和户外拍照。",
    suggestion: "午后注意防晒，户外点位可以放在上午或傍晚。",
    baseHigh: 29,
    baseLow: 20,
    uvIndex: 7,
    windLevel: "2级",
  },
  {
    condition: "cloudy",
    conditionLabel: "多云",
    precipitationChance: 28,
    riskLabels: ["轻装"],
    summary: "云量较多，体感舒适，适合安排长时间步行。",
    suggestion: "全天节奏可以保持正常，适合把户外景点串起来。",
    baseHigh: 26,
    baseLow: 18,
    uvIndex: 4,
    windLevel: "3级",
  },
  {
    condition: "rain",
    conditionLabel: "小雨",
    precipitationChance: 68,
    riskLabels: ["雨具", "室内优先"],
    summary: "可能出现阵雨，户外停留时间不宜排得太满。",
    suggestion: "建议把展馆、餐厅、购物等室内安排放到下午。",
    baseHigh: 23,
    baseLow: 17,
    uvIndex: 2,
    windLevel: "3级",
  },
  {
    condition: "storm",
    conditionLabel: "雷阵雨",
    precipitationChance: 82,
    riskLabels: ["改期预案", "交通确认"],
    summary: "午后可能有强降雨或雷电，交通和户外活动需要留余量。",
    suggestion: "户外景点尽量提前，长距离移动前确认交通状态。",
    baseHigh: 28,
    baseLow: 22,
    uvIndex: 3,
    windLevel: "5级",
  },
  {
    condition: "hot",
    conditionLabel: "晴热",
    precipitationChance: 18,
    riskLabels: ["补水", "防晒"],
    summary: "白天偏热，正午暴晒时段适合降低户外强度。",
    suggestion: "把户外步行放在早晚，午间安排咖啡馆或商场休息。",
    baseHigh: 34,
    baseLow: 25,
    uvIndex: 8,
    windLevel: "2级",
  },
  {
    condition: "windy",
    conditionLabel: "有风",
    precipitationChance: 22,
    riskLabels: ["防风"],
    summary: "风感明显，开阔地、海边或山地体感会更冷。",
    suggestion: "观景点适合缩短停留，随身准备轻薄外套。",
    baseHigh: 21,
    baseLow: 14,
    uvIndex: 5,
    windLevel: "5级",
  },
  {
    condition: "foggy",
    conditionLabel: "薄雾",
    precipitationChance: 35,
    riskLabels: ["能见度"],
    summary: "早晚能见度一般，适合放慢移动节奏。",
    suggestion: "日出、远眺和自驾安排留出机动时间。",
    baseHigh: 19,
    baseLow: 13,
    uvIndex: 2,
    windLevel: "2级",
  },
];

function hashString(value: string): number {
  return [...value].reduce((hash, character) => {
    return (hash * 31 + character.charCodeAt(0)) >>> 0;
  }, 17);
}

function formatForecastLabel(
  dateKey: string | undefined,
  day: TripDay,
): string {
  if (!dateKey) {
    return day.title || `第${day.dayIndex}天`;
  }

  const dateParts = parseDateKey(dateKey);

  if (!dateParts) {
    return day.title || dateKey;
  }

  return `${dateParts.month}月${dateParts.day}日`;
}

function getForecastDateKey(trip: Trip, day: TripDay): string | undefined {
  if (!trip.startDate) {
    return undefined;
  }

  return addDaysToDateKey(trip.startDate, day.dayIndex - 1);
}

function hasCoordinates(
  place: TripPlace | undefined,
): place is TripPlace & { latitude: number; longitude: number } {
  return (
    typeof place?.latitude === "number" && typeof place.longitude === "number"
  );
}

function getTripDayWeatherLocation(
  trip: Trip,
  day: TripDay,
): TripWeatherLocation | undefined {
  const sortedItems = getSortedTripDayItems(day.items);

  for (const item of sortedItems) {
    const place = getPlaceForTripDayItem(trip, item);

    if (hasCoordinates(place)) {
      return {
        amapAdcode: place.externalRefs?.amapAdcode,
        area: place.area,
        latitude: place.latitude,
        longitude: place.longitude,
        name: place.name,
        placeId: place.id,
      };
    }
  }

  return undefined;
}

function createMockDayForecast(
  trip: Trip,
  day: TripDay,
): TripWeatherDayForecast {
  const dateKey = getForecastDateKey(trip, day);
  const location = getTripDayWeatherLocation(trip, day);
  const seed = hashString(
    `${location?.name ?? (trip.destination || trip.title)}-${dateKey ?? day.id}-${day.dayIndex}`,
  );
  const preset =
    MOCK_WEATHER_PRESETS[seed % MOCK_WEATHER_PRESETS.length] ??
    MOCK_WEATHER_PRESETS[0];
  if (!preset) {
    throw new Error("模拟天气配置不能为空");
  }
  const temperatureOffset = (seed % 5) - 2;

  return {
    condition: preset.condition,
    conditionLabel: preset.conditionLabel,
    dateKey,
    dayId: day.id,
    dayIndex: day.dayIndex,
    id: `mock-weather-${trip.id}-${day.id}`,
    label: formatForecastLabel(dateKey, day),
    location,
    precipitationChance: Math.min(
      95,
      Math.max(5, preset.precipitationChance + (seed % 9) - 4),
    ),
    riskLabels: preset.riskLabels,
    source: mockWeatherSource,
    summary: preset.summary,
    suggestion: location
      ? preset.suggestion
      : `${preset.suggestion} 保存地点坐标后可获取当地天气。`,
    temperatureHigh: preset.baseHigh + temperatureOffset,
    temperatureLow: preset.baseLow + temperatureOffset,
    uvIndex: preset.uvIndex,
    windLevel: preset.windLevel,
  };
}

function pickCurrentForecast(
  days: TripWeatherDayForecast[],
): TripWeatherDayForecast {
  const todayKey = createDateKey();
  const todayForecast = days.find((day) => day.dateKey === todayKey);

  if (todayForecast) {
    return todayForecast;
  }

  const fallbackForecast = days[0];
  if (!fallbackForecast) {
    throw new Error("天气预报列表不能为空");
  }

  return (
    days.find(
      (day) => day.dateKey && compareDateKeys(day.dateKey, todayKey) > 0,
    ) ?? fallbackForecast
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function getConditionLabel(condition: TripWeatherCondition): string {
  switch (condition) {
    case "sunny":
      return "晴朗";
    case "cloudy":
      return "多云";
    case "rain":
      return "降雨";
    case "storm":
      return "雷雨";
    case "hot":
      return "晴热";
    case "windy":
      return "有风";
    case "foggy":
      return "薄雾";
  }
}

function getConditionFromWeatherCode(
  weatherCode: number,
  temperatureHigh: number,
): TripWeatherCondition {
  if (weatherCode === 95 || weatherCode === 96 || weatherCode === 99) {
    return "storm";
  }

  if (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  ) {
    return "rain";
  }

  if (weatherCode >= 71 && weatherCode <= 86) {
    return "rain";
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return "foggy";
  }

  if (temperatureHigh >= 33 && (weatherCode === 0 || weatherCode === 1)) {
    return "hot";
  }

  if (weatherCode === 0 || weatherCode === 1) {
    return "sunny";
  }

  return "cloudy";
}

function formatWindLevel(windSpeedKmh: number): string {
  if (windSpeedKmh < 6) {
    return "1级";
  }

  if (windSpeedKmh < 12) {
    return "2级";
  }

  if (windSpeedKmh < 20) {
    return "3级";
  }

  if (windSpeedKmh < 29) {
    return "4级";
  }

  if (windSpeedKmh < 39) {
    return "5级";
  }

  if (windSpeedKmh < 50) {
    return "6级";
  }

  return "7级+";
}

function buildRiskLabels(
  condition: TripWeatherCondition,
  precipitationChance: number,
  uvIndex: number,
  windSpeed: number,
): string[] {
  const labels: string[] = [];

  if (
    precipitationChance >= 55 ||
    condition === "rain" ||
    condition === "storm"
  ) {
    labels.push("雨具");
  }

  if (condition === "storm") {
    labels.push("交通确认");
  }

  if (uvIndex >= 6 || condition === "hot") {
    labels.push("防晒");
  }

  if (condition === "hot") {
    labels.push("补水");
  }

  if (windSpeed >= 29 || condition === "windy") {
    labels.push("防风");
  }

  if (condition === "foggy") {
    labels.push("能见度");
  }

  return [...new Set(labels)];
}

function buildWeatherSuggestion(
  condition: TripWeatherCondition,
  precipitationChance: number,
  uvIndex: number,
): string {
  if (condition === "storm") {
    return "户外景点尽量提前，长距离移动前确认交通状态。";
  }

  if (condition === "rain" || precipitationChance >= 55) {
    return "把展馆、餐厅、购物等室内安排放到降雨概率较高的时段。";
  }

  if (condition === "hot") {
    return "把户外步行放在早晚，午间安排室内休息。";
  }

  if (uvIndex >= 6) {
    return "午后注意防晒，户外点位可以放在上午或傍晚。";
  }

  if (condition === "foggy") {
    return "日出、远眺和自驾安排留出机动时间。";
  }

  return "全天节奏可以保持正常，适合按当天路线推进。";
}

function getDailyNumberValue(
  values: (number | null)[] | undefined,
  index: number,
  fallback: number,
): number {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function normalizeAmapAdcode(value?: string): string | undefined {
  const adcode = value?.trim();
  return adcode && /^\d{6}$/.test(adcode) ? adcode : undefined;
}

function getAmapLocationCacheKey(location: TripWeatherLocation): string {
  return `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
}

function isLikelyDomesticCoordinate(
  location: Pick<TripWeatherLocation, "latitude" | "longitude">,
): boolean {
  return (
    location.latitude >= 3.5 &&
    location.latitude <= 53.6 &&
    location.longitude >= 73.3 &&
    location.longitude <= 135.1
  );
}

function shouldResolveAmapWeather(_location?: TripWeatherLocation): boolean {
  return false;
}

async function getAmapAdcodeForLocation(
  location: TripWeatherLocation,
): Promise<string | undefined> {
  const directAdcode = normalizeAmapAdcode(location.amapAdcode);

  if (directAdcode) {
    return directAdcode;
  }

  if (!isAmapWebServiceConfigured() || !isLikelyDomesticCoordinate(location)) {
    return undefined;
  }

  const cacheKey = getAmapLocationCacheKey(location);
  const cachedAdcode = amapAdcodeCache.get(cacheKey);

  if (cachedAdcode) {
    return cachedAdcode;
  }

  const adcodePromise = reverseGeocodeAmapCoordinate({
    latitude: location.latitude,
    longitude: location.longitude,
  }).then((result) => result?.adcode);

  amapAdcodeCache.set(cacheKey, adcodePromise);

  try {
    return await adcodePromise;
  } catch (error) {
    amapAdcodeCache.delete(cacheKey);
    throw error;
  }
}

function parseAmapNumber(value?: string, fallback = 0): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAmapWeatherText(cast: AmapWeatherCast): string {
  const dayWeather = cast.dayweather?.trim();
  const nightWeather = cast.nightweather?.trim();

  if (dayWeather && nightWeather && dayWeather !== nightWeather) {
    return `${dayWeather}转${nightWeather}`;
  }

  return dayWeather || nightWeather || "多云";
}

function getConditionFromAmapWeather(
  weatherText: string,
  temperatureHigh: number,
): TripWeatherCondition {
  if (/雷|暴|冰雹|强对流/.test(weatherText)) {
    return "storm";
  }

  if (/雨|雪|冻雨|阵雨|阵雪/.test(weatherText)) {
    return "rain";
  }

  if (/雾|霾|沙尘|浮尘|扬沙/.test(weatherText)) {
    return "foggy";
  }

  if (/风/.test(weatherText)) {
    return "windy";
  }

  if (temperatureHigh >= 33 && /晴|少云/.test(weatherText)) {
    return "hot";
  }

  if (/晴/.test(weatherText)) {
    return "sunny";
  }

  return "cloudy";
}

function getAmapPrecipitationChance(
  condition: TripWeatherCondition,
  weatherText: string,
): number {
  if (condition === "storm") {
    return 82;
  }

  if (/暴雨|大雨|大雪|暴雪|雨夹雪/.test(weatherText)) {
    return 76;
  }

  if (condition === "rain") {
    return 62;
  }

  if (condition === "foggy") {
    return 35;
  }

  if (condition === "cloudy") {
    return 28;
  }

  return condition === "hot" ? 18 : 12;
}

function getAmapUvIndex(condition: TripWeatherCondition): number {
  switch (condition) {
    case "hot":
      return 8;
    case "sunny":
      return 7;
    case "cloudy":
    case "windy":
      return 4;
    case "rain":
    case "storm":
    case "foggy":
      return 2;
  }
}

function getAmapWindPowerValue(power?: string): number {
  return parseAmapNumber(power, 0);
}

function getAmapWindSpeedKmh(cast: AmapWeatherCast): number {
  return (
    Math.max(
      getAmapWindPowerValue(cast.daypower),
      getAmapWindPowerValue(cast.nightpower),
    ) * 6
  );
}

function formatAmapWindPower(power?: string): string | undefined {
  const value = power?.trim();

  if (!value) {
    return undefined;
  }

  return value.includes("级") ? value : `${value}级`;
}

function formatAmapWindLevel(cast: AmapWeatherCast): string {
  const dayPower = formatAmapWindPower(cast.daypower);
  const nightPower = formatAmapWindPower(cast.nightpower);

  if (dayPower && nightPower && dayPower !== nightPower) {
    return `${dayPower}/${nightPower}`;
  }

  return dayPower ?? nightPower ?? "微风";
}

async function fetchAmapDayForecastByAdcode(
  trip: Trip,
  day: TripDay,
  dateKey: string,
  location: TripWeatherLocation,
  adcode: string,
): Promise<TripWeatherDayForecast | undefined> {
  const cacheKey = `${adcode}:${dateKey}`;
  const cachedForecast = amapForecastCache.get(cacheKey);

  if (cachedForecast) {
    return cachedForecast;
  }

  const forecastPromise = (async () => {
    const forecast = await queryAmapWeatherForecast(adcode);
    const cast = forecast?.casts.find((item) => item.date === dateKey);

    if (!cast) {
      return undefined;
    }

    const temperatureHigh = Math.round(parseAmapNumber(cast.daytemp, 24));
    const temperatureLow = Math.round(parseAmapNumber(cast.nighttemp, 16));
    const high = Math.max(temperatureHigh, temperatureLow);
    const low = Math.min(temperatureHigh, temperatureLow);
    const weatherText = getAmapWeatherText(cast);
    const condition = getConditionFromAmapWeather(weatherText, high);
    const precipitationChance = getAmapPrecipitationChance(
      condition,
      weatherText,
    );
    const uvIndex = getAmapUvIndex(condition);
    const windSpeed = getAmapWindSpeedKmh(cast);

    return {
      condition,
      conditionLabel: weatherText || getConditionLabel(condition),
      dateKey,
      dayId: day.id,
      dayIndex: day.dayIndex,
      id: `amap-weather-${trip.id}-${day.id}`,
      label: formatForecastLabel(dateKey, day),
      location: {
        ...location,
        amapAdcode: adcode,
        area:
          location.area ??
          [forecast?.province, forecast?.city].filter(Boolean).join(" "),
      },
      precipitationChance,
      riskLabels: buildRiskLabels(
        condition,
        precipitationChance,
        uvIndex,
        windSpeed,
      ),
      source: amapSource,
      summary: `${location.name} ${formatForecastLabel(dateKey, day)}：${weatherText}，${formatTemperatureRange(
        low,
        high,
      )}`,
      suggestion: buildWeatherSuggestion(
        condition,
        precipitationChance,
        uvIndex,
      ),
      temperatureHigh: high,
      temperatureLow: low,
      uvIndex,
      windLevel: formatAmapWindLevel(cast),
    };
  })();

  amapForecastCache.set(cacheKey, forecastPromise);

  try {
    return await forecastPromise;
  } catch (error) {
    amapForecastCache.delete(cacheKey);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

function buildOpenMeteoUrl(
  location: TripWeatherLocation,
  dateKey: string,
): string {
  const searchParams = new URLSearchParams({
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "uv_index_max",
      "wind_speed_10m_max",
    ].join(","),
    end_date: dateKey,
    latitude: location.latitude.toFixed(5),
    longitude: location.longitude.toFixed(5),
    start_date: dateKey,
    timezone: "auto",
    wind_speed_unit: "kmh",
  });

  return `${OPEN_METEO_FORECAST_URL}?${searchParams.toString()}`;
}

async function fetchOpenMeteoDayForecast(
  trip: Trip,
  day: TripDay,
  dateKey: string,
  location: TripWeatherLocation,
): Promise<TripWeatherDayForecast | undefined> {
  const cacheKey = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}:${dateKey}`;
  const cachedForecast = openMeteoForecastCache.get(cacheKey);

  if (cachedForecast) {
    return cachedForecast;
  }

  const forecastPromise = (async () => {
    const response = await fetch(buildOpenMeteoUrl(location, dateKey), {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo forecast failed with ${response.status}`);
    }

    const data = (await response.json()) as OpenMeteoForecastResponse;
    const daily = data.daily;
    const dayIndex = daily?.time?.indexOf(dateKey) ?? -1;

    if (!daily || dayIndex < 0) {
      return undefined;
    }

    const temperatureHigh = Math.round(
      getDailyNumberValue(daily.temperature_2m_max, dayIndex, 24),
    );
    const temperatureLow = Math.round(
      getDailyNumberValue(daily.temperature_2m_min, dayIndex, 16),
    );
    const precipitationChance = Math.round(
      getDailyNumberValue(daily.precipitation_probability_max, dayIndex, 0),
    );
    const uvIndex = Math.round(
      getDailyNumberValue(daily.uv_index_max, dayIndex, 0),
    );
    const windSpeed = getDailyNumberValue(
      daily.wind_speed_10m_max,
      dayIndex,
      0,
    );
    const weatherCode = Math.round(
      getDailyNumberValue(daily.weather_code, dayIndex, 3),
    );
    const condition = getConditionFromWeatherCode(weatherCode, temperatureHigh);
    const conditionLabel = getConditionLabel(condition);

    return {
      condition,
      conditionLabel,
      dateKey,
      dayId: day.id,
      dayIndex: day.dayIndex,
      id: `open-meteo-weather-${trip.id}-${day.id}`,
      label: formatForecastLabel(dateKey, day),
      location,
      precipitationChance,
      riskLabels: buildRiskLabels(
        condition,
        precipitationChance,
        uvIndex,
        windSpeed,
      ),
      source: openMeteoSource,
      summary: `${location.name} ${formatForecastLabel(dateKey, day)}：${conditionLabel}，${formatTemperatureRange(
        temperatureLow,
        temperatureHigh,
      )}`,
      suggestion: buildWeatherSuggestion(
        condition,
        precipitationChance,
        uvIndex,
      ),
      temperatureHigh,
      temperatureLow,
      uvIndex,
      windLevel: formatWindLevel(windSpeed),
    };
  })();

  openMeteoForecastCache.set(cacheKey, forecastPromise);

  try {
    return await forecastPromise;
  } catch (error) {
    openMeteoForecastCache.delete(cacheKey);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

async function createTripDayWeatherForecast(
  trip: Trip,
  day: TripDay,
): Promise<TripWeatherDayForecast> {
  const dateKey = getForecastDateKey(trip, day);
  const location = getTripDayWeatherLocation(trip, day);

  if (dateKey && location) {
    if (shouldResolveAmapWeather(location)) {
      try {
        const adcode = await getAmapAdcodeForLocation(location);
        const amapForecast = adcode
          ? await fetchAmapDayForecastByAdcode(
              trip,
              day,
              dateKey,
              location,
              adcode,
            )
          : undefined;

        if (amapForecast) {
          return amapForecast;
        }

        if (adcode) {
          return createMockDayForecast(trip, day);
        }
      } catch (error) {
        weatherLogger.warn(
          "amap.forecast.failed",
          { error },
          "Failed to fetch Amap weather forecast",
        );
        return createMockDayForecast(trip, day);
      }
    }

    try {
      const remoteForecast = await fetchOpenMeteoDayForecast(
        trip,
        day,
        dateKey,
        location,
      );

      if (remoteForecast) {
        return remoteForecast;
      }
    } catch (error) {
      weatherLogger.warn(
        "open-meteo.forecast.failed",
        { error },
        "Failed to fetch Open-Meteo forecast",
      );
    }
  }

  return createMockDayForecast(trip, day);
}

export async function getTripPlaceWeatherForecast(
  trip: Trip,
  place: TripPlace,
  day: TripDay | undefined,
): Promise<TripWeatherDayForecast | undefined> {
  const dateKey = day ? getForecastDateKey(trip, day) : undefined;

  if (!day || !dateKey || !hasCoordinates(place)) {
    return undefined;
  }

  const location: TripWeatherLocation = {
    amapAdcode: place.externalRefs?.amapAdcode,
    area: place.area,
    latitude: place.latitude,
    longitude: place.longitude,
    name: place.name,
    placeId: place.id,
  };

  try {
    if (shouldResolveAmapWeather(location)) {
      const adcode = await getAmapAdcodeForLocation(location);

      if (adcode) {
        return await fetchAmapDayForecastByAdcode(
          trip,
          day,
          dateKey,
          location,
          adcode,
        );
      }
    }

    return await fetchOpenMeteoDayForecast(trip, day, dateKey, location);
  } catch (error) {
    weatherLogger.warn(
      "place.forecast.failed",
      { error, placeId: place.id },
      "Failed to fetch place weather forecast",
    );
  }

  return undefined;
}

export async function fetchQuickWeatherByCoordinates(
  latitude: number,
  longitude: number,
  placeName: string,
): Promise<TripWeatherDayForecast | undefined> {
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return fetchOpenMeteoDayForecast(
    { id: "quick" } as Trip,
    { id: "today", dayIndex: 1, title: "今天", items: [] } as TripDay,
    dateKey,
    {
      latitude,
      longitude,
      name: placeName,
      placeId: `quick-${latitude}-${longitude}`,
    },
  );
}

export function getMockTripWeather(trip: Trip): TripWeatherOverview {
  const weatherDays =
    trip.days.length > 0
      ? trip.days
      : [
          {
            dayIndex: 1,
            id: `${trip.id}-weather-fallback-day`,
            items: [],
            title: "第一天",
          },
        ];
  const days = weatherDays.map((day) => createMockDayForecast(trip, day));
  const current = pickCurrentForecast(days);
  const destination = trip.destination || "目的地未定";
  const locationName = current.location?.name ?? destination;

  return {
    current,
    days,
    destination,
    generatedAt: new Date().toISOString(),
    headline: `${locationName} ${current.label}：${current.conditionLabel}，${formatTemperatureRange(
      current.temperatureLow,
      current.temperatureHigh,
    )}`,
    source: current.source,
    suggestion: current.suggestion,
  };
}

export async function getTripWeather(trip: Trip): Promise<TripWeatherOverview> {
  const weatherDays =
    trip.days.length > 0
      ? trip.days
      : [
          {
            dayIndex: 1,
            id: `${trip.id}-weather-fallback-day`,
            items: [],
            title: "第一天",
          },
        ];
  const days = await Promise.all(
    weatherDays.map((day) => createTripDayWeatherForecast(trip, day)),
  );
  const current = pickCurrentForecast(days);
  const destination = trip.destination || "目的地未定";
  const locationName = current.location?.name ?? destination;

  return {
    current,
    days,
    destination,
    generatedAt: new Date().toISOString(),
    headline: `${locationName} ${current.label}：${current.conditionLabel}，${formatTemperatureRange(
      current.temperatureLow,
      current.temperatureHigh,
    )}`,
    source: current.source,
    suggestion: current.suggestion,
  };
}
