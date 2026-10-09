import type { TripExpenseCategory } from "./types";

export type TripCurrencyCode =
  | "CNY"
  | "USD"
  | "EUR"
  | "JPY"
  | "HKD"
  | "MOP"
  | "GBP"
  | "KRW"
  | "SGD"
  | "THB"
  | "MYR"
  | "TWD";

export type TripCurrencyMeta = {
  code: TripCurrencyCode;
  decimalPlaces: number;
  label: string;
  locale: string;
  symbol: string;
};

export const DEFAULT_TRIP_CURRENCY_CODE: TripCurrencyCode = "CNY";

export const tripCurrencyCatalog: TripCurrencyMeta[] = [
  {
    code: "CNY",
    decimalPlaces: 2,
    label: "人民币",
    locale: "zh-CN",
    symbol: "¥",
  },
  {
    code: "USD",
    decimalPlaces: 2,
    label: "美元",
    locale: "en-US",
    symbol: "$",
  },
  {
    code: "EUR",
    decimalPlaces: 2,
    label: "欧元",
    locale: "de-DE",
    symbol: "€",
  },
  {
    code: "JPY",
    decimalPlaces: 0,
    label: "日元",
    locale: "ja-JP",
    symbol: "¥",
  },
  {
    code: "HKD",
    decimalPlaces: 2,
    label: "港币",
    locale: "zh-HK",
    symbol: "HK$",
  },
  {
    code: "MOP",
    decimalPlaces: 2,
    label: "澳门元",
    locale: "zh-MO",
    symbol: "MOP$",
  },
  {
    code: "GBP",
    decimalPlaces: 2,
    label: "英镑",
    locale: "en-GB",
    symbol: "£",
  },
  {
    code: "KRW",
    decimalPlaces: 0,
    label: "韩元",
    locale: "ko-KR",
    symbol: "₩",
  },
  {
    code: "SGD",
    decimalPlaces: 2,
    label: "新加坡元",
    locale: "en-SG",
    symbol: "S$",
  },
  {
    code: "THB",
    decimalPlaces: 2,
    label: "泰铢",
    locale: "th-TH",
    symbol: "฿",
  },
  {
    code: "MYR",
    decimalPlaces: 2,
    label: "马来西亚林吉特",
    locale: "ms-MY",
    symbol: "RM",
  },
  {
    code: "TWD",
    decimalPlaces: 2,
    label: "新台币",
    locale: "zh-TW",
    symbol: "NT$",
  },
];

export const tripCurrencyCodes = tripCurrencyCatalog.map((item) => item.code);

export const tripExpenseWarningRatioOptions = [0.6, 0.7, 0.8, 0.9] as const;

export const defaultPinnedExpenseCategories: TripExpenseCategory[] = [
  "餐饮",
  "交通",
  "住宿",
];

const legacyCurrencySymbolMap: Record<string, TripCurrencyCode> = {
  $: "USD",
  HK$: "HKD",
  MOP$: "MOP",
  NT$: "TWD",
  RM: "MYR",
  "¥": "CNY",
  "￥": "CNY",
  "£": "GBP",
  "€": "EUR",
  "₩": "KRW",
  "฿": "THB",
};

const currencyMetaMap = new Map(
  tripCurrencyCatalog.map((item) => [item.code, item]),
);

function isTripCurrencyCode(value: string): value is TripCurrencyCode {
  return tripCurrencyCodes.includes(value as TripCurrencyCode);
}

export function normalizeTripCurrencyCode(value: unknown): TripCurrencyCode {
  if (typeof value !== "string") {
    return DEFAULT_TRIP_CURRENCY_CODE;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return DEFAULT_TRIP_CURRENCY_CODE;
  }

  if (isTripCurrencyCode(trimmedValue as TripCurrencyCode)) {
    return trimmedValue as TripCurrencyCode;
  }

  const upperValue = trimmedValue.toUpperCase();

  if (isTripCurrencyCode(upperValue as TripCurrencyCode)) {
    return upperValue as TripCurrencyCode;
  }

  return legacyCurrencySymbolMap[trimmedValue] ?? DEFAULT_TRIP_CURRENCY_CODE;
}

export function getTripCurrencyMeta(
  code: string | undefined,
): TripCurrencyMeta {
  const fallback = currencyMetaMap.get(DEFAULT_TRIP_CURRENCY_CODE);
  if (!fallback) {
    throw new Error("默认货币配置缺失");
  }

  return currencyMetaMap.get(normalizeTripCurrencyCode(code)) ?? fallback;
}

export function formatTripCurrencyAmount(
  value: number | undefined,
  currencyCode?: string,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "待记录";
  }

  const meta = getTripCurrencyMeta(currencyCode);
  const amount = Math.round(value * 100) / 100;

  const formatter = new Intl.NumberFormat(meta.locale, {
    currency: meta.code,
    maximumFractionDigits: meta.decimalPlaces,
    minimumFractionDigits: Number.isInteger(amount)
      ? 0
      : Math.min(2, meta.decimalPlaces),
    style: "currency",
  });

  return formatter.format(amount);
}

export function getTripCurrencyDisplayLabel(currencyCode?: string): string {
  const meta = getTripCurrencyMeta(currencyCode);
  return `${meta.label} · ${meta.code}`;
}
