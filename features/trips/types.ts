export type TripStatus = "计划中" | "旅途中" | "已完成";

export const tripPlaceCategories = [
  "景点",
  "餐厅",
  "酒店",
  "交通",
  "购物",
  "教育",
  "医疗",
  "其他",
] as const;

export type TripPlaceCategory = (typeof tripPlaceCategories)[number];

export function isTripPlaceCategory(
  value: unknown,
): value is TripPlaceCategory {
  return tripPlaceCategories.some((category) => category === value);
}

export type TripPlacePoiGroup =
  | "attraction"
  | "food"
  | "hotel"
  | "transport"
  | "shopping"
  | "education"
  | "medical"
  | "other";

export type TripPlaceIconKey =
  | "attraction"
  | "landmark"
  | "museum"
  | "park"
  | "viewpoint"
  | "temple"
  | "mountain"
  | "water"
  | "sea"
  | "beach"
  | "island"
  | "zoo"
  | "aquarium"
  | "themepark"
  | "ancient"
  | "cave"
  | "restaurant"
  | "cafe"
  | "bar"
  | "hotpot"
  | "bbq"
  | "japanese"
  | "korean"
  | "western"
  | "seafood"
  | "buffet"
  | "noodles"
  | "fastfood"
  | "tea"
  | "dessert"
  | "bakery"
  | "hotel"
  | "guesthouse"
  | "hostel"
  | "camping"
  | "villa"
  | "resort"
  | "airport"
  | "train"
  | "subway"
  | "bus"
  | "car"
  | "ferry"
  | "bike"
  | "taxi"
  | "charging"
  | "gas"
  | "parking"
  | "shopping"
  | "mall"
  | "supermarket"
  | "market"
  | "electronics"
  | "clothing"
  | "school"
  | "university"
  | "library"
  | "research"
  | "hospital"
  | "clinic"
  | "pharmacy"
  | "dentist"
  | "place"
  | "bank"
  | "atm" // ATM
  | "insurance"
  | "delivery"
  | "laundry"
  | "beauty"
  | "repair"
  | "government"
  | "embassy"
  | "toilet"
  | "residential"
  | "office";

export type TripPlaceExternalRefs = {
  amapAdcode?: string;
  amapCitycode?: string;
  amapCityName?: string;
  amapPoiId?: string;
  wikidataId?: string;
  sourceUrl?: string;
  mapUrl?: string;
};

export type TripPlacePhoto = {
  id: string;
  url: string;
  sourceLabel?: string;
  sourceUrl?: string;
  credit?: string;
  width?: number;
  height?: number;
  isCover?: boolean;
};

export type TripPlaceDetails = {
  summary?: string;
  highlights?: string[];
  cautions?: string[];
  openingHours?: string;
  phone?: string;
  website?: string;
  ticketInfo?: string;
  visitDuration?: string;
  rating?: number;
  ratingSource?: string;
  reviewCount?: number;
  plannedCount?: number;
  visitedCount?: number;
  priceLevel?: string;
};

export type TripPlaceLLM = {
  text: string;
};

export type TripPlaceExternalImage = {
  id: string;
  url: string;
  source?: string;
  author?: string;
  authorUrl?: string;
};

export type TripGeoCoordinate = {
  latitude: number;
  longitude: number;
};

export type TripPlaceMapBoundary = TripGeoCoordinate[][];

export type TripPlace = {
  id: string;
  name: string;
  category: TripPlaceCategory;
  isScheduled: boolean;
  address?: string;
  latitude?: number;
  longitude?: number;
  mapBoundary?: TripPlaceMapBoundary;
  note?: string;
  area?: string;
  iconKey?: TripPlaceIconKey;
  osmKey?: string;
  osmValue?: string;
  poiGroup?: TripPlacePoiGroup;
  poiType?: string;
  providerPlaceId?: string;
  provider?: string;
  externalRefs?: TripPlaceExternalRefs;
  photos?: TripPlacePhoto[];
  details?: TripPlaceDetails;
  llm?: TripPlaceLLM;
  externalImages?: TripPlaceExternalImage[];
};

export type TripPlaceRef = {
  id?: string;
  amapPoiId: string;
  category?: TripPlaceCategory;
  note?: string;
  isScheduled?: boolean;
  plannedCount?: number;
  visitedCount?: number;
  cautions?: string[];
};

export type TripTransport = {
  id: string;
  type: "航班" | "火车" | "自驾" | "巴士" | "其他";
  title: string;
  detail?: string;
  departureTime?: string;
  arrivalTime?: string;
  note?: string;
};

export type TripLodging = {
  id: string;
  name: string;
  address?: string;
  checkIn?: string;
  checkOut?: string;
  note?: string;
};

export type TripMemo = {
  id: string;
  title: string;
  detail?: string;
  pinned?: boolean;
};

export type TripImportSource = {
  id: string;
  title: string;
  sourceType: "link" | "text" | "image";
  status: "待解析" | "已导入" | "占位";
};

export type TripChecklistItem = {
  id: string;
  title: string;
  isCompleted: boolean;
};

export type TripExpenseCategory =
  | "交通"
  | "住宿"
  | "餐饮"
  | "门票"
  | "购物"
  | "活动"
  | "其他";

export type TripBudget = {
  amount?: number;
  currency: string;
};

export type TripExpense = {
  id: string;
  title: string;
  amount: number;
  category: TripExpenseCategory;
  currency: string;
  date?: string;
  dayId?: string;
  placeId?: string;
  placeName?: string;
  note?: string;
  paidBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type TripDayItem = {
  id: string;
  title: string;
  category?: TripPlaceCategory;
  time?: string;
  iconKey?: TripPlaceIconKey;
  placeId?: string;
  placeName?: string;
  note?: string;
  cost?: number;
  costRecordedAt?: string;
  recommendationReason?: string;
};

export type TripDay = {
  id: string;
  dayIndex: number;
  title: string;
  summary?: string;
  items: TripDayItem[];
};

export type Trip = {
  id: string;
  title: string;
  destination: string;
  currency: string;
  startDate?: string;
  endDate?: string;
  status: TripStatus;
  days: TripDay[];
  places: TripPlace[];
  transports: TripTransport[];
  lodgings: TripLodging[];
  generalNote?: string;
  memos: TripMemo[];
  checklistItems: TripChecklistItem[];
  budget?: TripBudget;
  expenses: TripExpense[];
  importSources: TripImportSource[];
  routeModeOverrides?: Record<
    string,
    "walking" | "cycling" | "transit" | "driving"
  >;
  createdAt: string;
  pinnedAt?: string;
  updatedAt: string;
};

export type CreateTripInput = {
  currency?: string;
  destination?: string;
  title: string;
  budget?: TripBudget;
  days?: TripDay[];
  endDate?: string;
  expenses?: TripExpense[];
  generalNote?: string;
  checklistItems?: TripChecklistItem[];
  lodgings?: TripLodging[];
  memos?: TripMemo[];
  places?: TripPlace[];
  startDate?: string;
  status?: TripStatus;
  transports?: TripTransport[];
};

export type CreateTripImportSourceInput = {
  title: string;
  sourceType: TripImportSource["sourceType"];
  status?: TripImportSource["status"];
};
