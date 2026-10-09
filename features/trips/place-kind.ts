import type {
  TripPlaceCategory,
  TripPlaceIconKey,
  TripPlacePoiGroup,
} from "./types";

type PlaceKindInput = {
  category?: TripPlaceCategory;
  name?: string;
  osmKey?: string;
  osmValue?: string;
  amapSecondary?: string;
};

type PlaceKind = {
  category: TripPlaceCategory;
  iconKey: TripPlaceIconKey;
  poiGroup: TripPlacePoiGroup;
  poiType: string;
};

const iconKeys: TripPlaceIconKey[] = [
  "attraction",
  "landmark",
  "museum",
  "park",
  "viewpoint",
  "temple",
  "mountain",
  "water",
  "sea",
  "beach",
  "island",
  "zoo",
  "aquarium",
  "themepark",
  "ancient",
  "cave",
  "restaurant",
  "cafe",
  "bar",
  "hotpot",
  "bbq",
  "japanese",
  "korean",
  "western",
  "seafood",
  "buffet",
  "noodles",
  "fastfood",
  "tea",
  "dessert",
  "bakery",
  "hotel",
  "guesthouse",
  "hostel",
  "camping",
  "villa",
  "resort",
  "airport",
  "train",
  "subway",
  "bus",
  "car",
  "ferry",
  "bike",
  "taxi",
  "charging",
  "gas",
  "parking",
  "shopping",
  "mall",
  "supermarket",
  "market",
  "electronics",
  "clothing",
  "school",
  "university",
  "library",
  "research",
  "hospital",
  "clinic",
  "pharmacy",
  "dentist",
  "place",
  "bank",
  "atm",
  "insurance",
  "delivery",
  "laundry",
  "beauty",
  "repair",
  "government",
  "embassy",
  "toilet",
  "residential",
  "office",
];

const poiGroups: TripPlacePoiGroup[] = [
  "attraction",
  "food",
  "hotel",
  "transport",
  "shopping",
  "education",
  "medical",
  "other",
];

const categoryFallbackKinds: Record<TripPlaceCategory, PlaceKind> = {
  景点: {
    category: "景点",
    iconKey: "attraction",
    poiGroup: "attraction",
    poiType: "attraction",
  },
  餐厅: {
    category: "餐厅",
    iconKey: "restaurant",
    poiGroup: "food",
    poiType: "restaurant",
  },
  酒店: {
    category: "酒店",
    iconKey: "hotel",
    poiGroup: "hotel",
    poiType: "hotel",
  },
  交通: {
    category: "交通",
    iconKey: "bus",
    poiGroup: "transport",
    poiType: "transport",
  },
  购物: {
    category: "购物",
    iconKey: "shopping",
    poiGroup: "shopping",
    poiType: "shop",
  },
  教育: {
    category: "教育",
    iconKey: "school",
    poiGroup: "education",
    poiType: "education",
  },
  医疗: {
    category: "医疗",
    iconKey: "hospital",
    poiGroup: "medical",
    poiType: "medical",
  },
  其他: {
    category: "其他",
    iconKey: "place",
    poiGroup: "other",
    poiType: "place",
  },
};

function buildPoiType(
  osmKey?: string,
  osmValue?: string,
  fallback = "place",
): string {
  if (osmKey && osmValue) {
    return `${osmKey}:${osmValue}`;
  }

  return osmValue ?? osmKey ?? fallback;
}

const poiTypeLabels: Record<string, string> = {
  "aeroway:aerodrome": "机场",
  "amenity:bar": "酒吧",
  "amenity:bus_station": "巴士站",
  "amenity:cafe": "咖啡馆",
  "amenity:car_rental": "租车点",
  "amenity:fast_food": "快餐",
  "amenity:ferry_terminal": "码头",
  "amenity:food_court": "美食广场",
  "amenity:parking": "停车场",
  "amenity:place_of_worship": "宗教场所",
  "amenity:pub": "酒馆",
  "amenity:restaurant": "餐厅",
  "historic:monument": "历史纪念地",
  "leisure:garden": "花园",
  "leisure:nature_reserve": "自然保护区",
  "leisure:park": "公园",
  "natural:water": "水域",
  "railway:station": "火车站",
  "railway:subway": "地铁站",
  "railway:subway_entrance": "地铁入口",
  "shop:department_store": "百货商店",
  "shop:mall": "商场",
  "shop:supermarket": "超市",
  "tourism:apartment": "公寓住宿",
  "tourism:aquarium": "水族馆",
  "tourism:attraction": "景点",
  "tourism:gallery": "美术馆",
  "tourism:guest_house": "旅馆",
  "tourism:hostel": "青旅",
  "tourism:hotel": "酒店",
  "tourism:motel": "汽车旅馆",
  "tourism:museum": "博物馆",
  "tourism:theme_park": "主题公园",
  "tourism:viewpoint": "观景点",
  "tourism:zoo": "动物园",
};

const fallbackPoiTypeLabels: Record<string, string> = {
  airport: "机场",
  attraction: "景点",
  cafe: "咖啡馆",
  hotel: "酒店",
  mall: "商场",
  museum: "博物馆",
  park: "公园",
  place: "地点",
  restaurant: "餐厅",
  shop: "购物",
  station: "车站",
  subway: "地铁站",
  temple: "宗教场所",
  transport: "交通",
  viewpoint: "观景点",
  school: "学校",
  university: "高等院校",
  library: "图书馆",
  research: "科研机构",
  education: "教育",
  bell_tower: "钟楼",
  drum_tower: "鼓楼",
  ancient_wall: "城墙",
  terra_cotta: "兵马俑",
  hot_springs: "温泉",
  muslim_street: "回民街",
  hospital: "医院",
  clinic: "诊所",
  pharmacy: "药房",
  medical: "医疗",
  mountain: "山岳",
  water: "水域",
  sea: "海",
  beach: "海滩",
  island: "岛屿",
  zoo: "动物园",
  aquarium: "水族馆",
  themepark: "游乐园",
  ancient: "古城",
  cave: "溶洞",
  hotpot: "火锅",
  bbq: "烧烤",
  japanese: "日料",
  korean: "韩餐",
  western: "西餐",
  seafood: "海鲜",
  buffet: "自助餐",
  noodles: "面馆",
  fastfood: "快餐",
  tea: "茶饮",
  dessert: "甜品",
  bakery: "面包店",
  hostel: "青旅",
  camping: "露营",
  villa: "别墅",
  resort: "度假村",
  ferry: "渡轮",
  bike: "自行车",
  taxi: "出租车",
  charging: "充电桩",
  gas: "加油站",
  parking: "停车场",
  supermarket: "超市",
  market: "集市",
  electronics: "电子产品",
  clothing: "服装",
  dentist: "牙科",
  bank: "银行",
  atm: "ATM",
  insurance: "保险",
  delivery: "快递",
  laundry: "洗衣",
  beauty: "美容",
  repair: "维修",
  government: "政府",
  embassy: "使馆",
  toilet: "公厕",
  residential: "小区",
  office: "写字楼",
};

export function formatPlacePoiType(poiType?: string): string | undefined {
  if (!poiType) {
    return undefined;
  }

  const normalizedPoiType = poiType.trim();
  if (!normalizedPoiType) {
    return undefined;
  }

  if (normalizedPoiType.includes(";")) {
    const amapTypeParts = normalizedPoiType
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    const compactAmapType =
      [...amapTypeParts].reverse().find((part) => part.length <= 6) ??
      amapTypeParts[amapTypeParts.length - 1];

    return compactAmapType;
  }

  const knownLabel =
    poiTypeLabels[normalizedPoiType] ??
    fallbackPoiTypeLabels[normalizedPoiType];
  if (knownLabel) {
    return knownLabel;
  }

  const [, osmValue] = normalizedPoiType.split(":");
  return (osmValue ?? normalizedPoiType).replace(/_/g, " ");
}

function inferKindByAmapSecondary(
  secondary?: string,
  category?: TripPlaceCategory,
): PlaceKind | undefined {
  if (!secondary) {
    return undefined;
  }

  if (category === "景点" || category === "其他") {
    if (/山|峰|岳|岭/.test(secondary))
      return {
        category: "景点",
        iconKey: "mountain",
        poiGroup: "attraction",
        poiType: "mountain",
      };
    if (/湖|河|江|溪|潭|水库/.test(secondary))
      return {
        category: "景点",
        iconKey: "water",
        poiGroup: "attraction",
        poiType: "water",
      };
    if (/海(?!淀|湾)|海湾|海峡/.test(secondary))
      return {
        category: "景点",
        iconKey: "sea",
        poiGroup: "attraction",
        poiType: "sea",
      };
    if (/海滩|沙滩|浴场/.test(secondary))
      return {
        category: "景点",
        iconKey: "beach",
        poiGroup: "attraction",
        poiType: "beach",
      };
    if (/岛|半岛|群岛/.test(secondary))
      return {
        category: "景点",
        iconKey: "island",
        poiGroup: "attraction",
        poiType: "island",
      };
    if (/动物园|野生动物/.test(secondary))
      return {
        category: "景点",
        iconKey: "zoo",
        poiGroup: "attraction",
        poiType: "zoo",
      };
    if (/水族|海洋馆|海洋世界/.test(secondary))
      return {
        category: "景点",
        iconKey: "aquarium",
        poiGroup: "attraction",
        poiType: "aquarium",
      };
    if (/游乐|主题公园|游乐园/.test(secondary))
      return {
        category: "景点",
        iconKey: "themepark",
        poiGroup: "attraction",
        poiType: "themepark",
      };
    if (/博物馆|美术馆|纪念馆|展览/.test(secondary))
      return {
        category: "景点",
        iconKey: "museum",
        poiGroup: "attraction",
        poiType: "museum",
      };
    if (/寺|庙|教堂|清真寺|宗教/.test(secondary))
      return {
        category: "景点",
        iconKey: "temple",
        poiGroup: "attraction",
        poiType: "temple",
      };
    if (/公园|花园|植物园|绿地/.test(secondary))
      return {
        category: "景点",
        iconKey: "park",
        poiGroup: "attraction",
        poiType: "park",
      };
    if (/古城|古镇|古村落|历史/.test(secondary))
      return {
        category: "景点",
        iconKey: "ancient",
        poiGroup: "attraction",
        poiType: "ancient",
      };
    if (/洞|溶洞|岩洞|钟乳/.test(secondary))
      return {
        category: "景点",
        iconKey: "cave",
        poiGroup: "attraction",
        poiType: "cave",
      };
    if (/观景|瞭望|观景台/.test(secondary))
      return {
        category: "景点",
        iconKey: "viewpoint",
        poiGroup: "attraction",
        poiType: "viewpoint",
      };
  }

  if (category === "餐厅") {
    if (/火锅|涮/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "hotpot",
        poiGroup: "food",
        poiType: "hotpot",
      };
    if (/烧烤|烤肉|烤串/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "bbq",
        poiGroup: "food",
        poiType: "bbq",
      };
    if (/日本|寿司|刺身|拉面|日料/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "japanese",
        poiGroup: "food",
        poiType: "japanese",
      };
    if (/韩国|韩式|炸鸡|石锅/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "korean",
        poiGroup: "food",
        poiType: "korean",
      };
    if (/西餐|牛排|意面|法餐|意大利/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "western",
        poiGroup: "food",
        poiType: "western",
      };
    if (/海鲜|水产|大闸蟹/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "seafood",
        poiGroup: "food",
        poiType: "seafood",
      };
    if (/自助|Buffet/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "buffet",
        poiGroup: "food",
        poiType: "buffet",
      };
    if (/面馆|面条|拉面|刀削面/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "noodles",
        poiGroup: "food",
        poiType: "noodles",
      };
    if (/快餐|汉堡|炸鸡|麦当劳|KFC/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "fastfood",
        poiGroup: "food",
        poiType: "fastfood",
      };
    if (/咖啡|星巴克|瑞幸/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "cafe",
        poiGroup: "food",
        poiType: "cafe",
      };
    if (/茶|奶茶|喜茶|茶室|茶馆/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "tea",
        poiGroup: "food",
        poiType: "tea",
      };
    if (/酒吧|清吧|夜店/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "bar",
        poiGroup: "food",
        poiType: "bar",
      };
    if (/甜品|蛋糕|冰淇淋|甜点/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "dessert",
        poiGroup: "food",
        poiType: "dessert",
      };
    if (/面包|烘焙|糕点|蛋糕店/.test(secondary))
      return {
        category: "餐厅",
        iconKey: "bakery",
        poiGroup: "food",
        poiType: "bakery",
      };
  }

  if (category === "酒店") {
    if (/青年|旅舍|青旅|胶囊/.test(secondary))
      return {
        category: "酒店",
        iconKey: "hostel",
        poiGroup: "hotel",
        poiType: "hostel",
      };
    if (/露营|营地|房车/.test(secondary))
      return {
        category: "酒店",
        iconKey: "camping",
        poiGroup: "hotel",
        poiType: "camping",
      };
    if (/别墅|Villa/.test(secondary))
      return {
        category: "酒店",
        iconKey: "villa",
        poiGroup: "hotel",
        poiType: "villa",
      };
    if (/度假|温泉|度假村/.test(secondary))
      return {
        category: "酒店",
        iconKey: "resort",
        poiGroup: "hotel",
        poiType: "resort",
      };
    if (/民宿|公寓|客栈/.test(secondary))
      return {
        category: "酒店",
        iconKey: "guesthouse",
        poiGroup: "hotel",
        poiType: "guesthouse",
      };
  }

  if (category === "购物") {
    if (/超市|便利店|711|全家|物美|永辉|大润发|盒马|山姆/.test(secondary))
      return {
        category: "购物",
        iconKey: "supermarket",
        poiGroup: "shopping",
        poiType: "supermarket",
      };
    if (/集市|菜市场|夜市|农贸市场|早市/.test(secondary))
      return {
        category: "购物",
        iconKey: "market",
        poiGroup: "shopping",
        poiType: "market",
      };
    if (
      /商场|百货|银泰|万达|万象|大悦城|来福士|太古里|购物中心|商城/.test(
        secondary,
      )
    )
      return {
        category: "购物",
        iconKey: "mall",
        poiGroup: "shopping",
        poiType: "mall",
      };
    if (/电器|数码|手机|电脑|苏宁|国美/.test(secondary))
      return {
        category: "购物",
        iconKey: "electronics",
        poiGroup: "shopping",
        poiType: "electronics",
      };
    if (/服装|衣服|时装|鞋|优衣库|ZARA|H&M/.test(secondary))
      return {
        category: "购物",
        iconKey: "clothing",
        poiGroup: "shopping",
        poiType: "clothing",
      };
  }

  if (category === "医疗") {
    if (/牙|口腔/.test(secondary))
      return {
        category: "医疗",
        iconKey: "dentist",
        poiGroup: "medical",
        poiType: "dentist",
      };
  }

  if (category === "其他") {
    if (/银行|支行|分行/.test(secondary))
      return {
        category: "其他",
        iconKey: "bank",
        poiGroup: "other",
        poiType: "bank",
      };
    if (/ATM|取款|自动柜员/.test(secondary))
      return {
        category: "其他",
        iconKey: "atm",
        poiGroup: "other",
        poiType: "atm",
      };
    if (/保险/.test(secondary))
      return {
        category: "其他",
        iconKey: "insurance",
        poiGroup: "other",
        poiType: "insurance",
      };
    if (/快递|物流|邮寄/.test(secondary))
      return {
        category: "其他",
        iconKey: "delivery",
        poiGroup: "other",
        poiType: "delivery",
      };
    if (/洗衣|干洗/.test(secondary))
      return {
        category: "其他",
        iconKey: "laundry",
        poiGroup: "other",
        poiType: "laundry",
      };
    if (/美容|美发|美甲|SPA/.test(secondary))
      return {
        category: "其他",
        iconKey: "beauty",
        poiGroup: "other",
        poiType: "beauty",
      };
    if (/维修|家政|开锁/.test(secondary))
      return {
        category: "其他",
        iconKey: "repair",
        poiGroup: "other",
        poiType: "repair",
      };
    if (/政府|公安|派出所|法院/.test(secondary))
      return {
        category: "其他",
        iconKey: "government",
        poiGroup: "other",
        poiType: "government",
      };
    if (/使馆|领事/.test(secondary))
      return {
        category: "其他",
        iconKey: "embassy",
        poiGroup: "other",
        poiType: "embassy",
      };
    if (/公厕|厕所|卫生间/.test(secondary))
      return {
        category: "其他",
        iconKey: "toilet",
        poiGroup: "other",
        poiType: "toilet",
      };
    if (/小区|住宅|公寓|花园(?!路)/.test(secondary))
      return {
        category: "其他",
        iconKey: "residential",
        poiGroup: "other",
        poiType: "residential",
      };
    if (/写字楼|办公|产业园/.test(secondary))
      return {
        category: "其他",
        iconKey: "office",
        poiGroup: "other",
        poiType: "office",
      };
  }

  return undefined;
}

function analyzePlaceName(name: string): {
  mainName: string;
  bracketContent: string;
  shouldCheckBracket: boolean;
} {
  const bracketMatch = name.match(/[（(]([^）)]*)[）)]/);
  const bracketContent = bracketMatch ? bracketMatch[1].trim() : "";

  const mainName = name.replace(/[（(][^）)]*[）)]/g, "").trim();

  const isFunctionalInfo =
    /地铁|公交|站|机场|码头|出口|入口|东|西|南|北|中|A|B|C|D/.test(
      bracketContent,
    ) ||
    /^\d+号?口?$/.test(bracketContent) ||
    /^[A-D]口?$/.test(bracketContent);

  const isBranchInfo =
    /店$|分店$|旗舰店$|总店$|路$|街$|号$|楼$|层$|广场$|中心$|大厦$/.test(
      bracketContent,
    ) ||
    /^\d+$/.test(bracketContent) ||
    /大悦城|银泰|万达|万象|来福士|太古里/.test(bracketContent);

  const shouldCheckBracket = isFunctionalInfo && !isBranchInfo;

  return { mainName, bracketContent, shouldCheckBracket };
}

const KEYWORD_RULES: {
  pattern: RegExp;
  iconKey: TripPlaceIconKey;
  category: TripPlaceCategory;
  weight: number;
  poiGroup: TripPlacePoiGroup;
  poiType: string;
}[] = [
  {
    pattern: /机场|航站楼/,
    iconKey: "airport",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "airport",
  },
  {
    pattern: /地铁/,
    iconKey: "subway",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "subway",
  },
  {
    pattern: /火车站|高铁站/,
    iconKey: "train",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "station",
  },
  {
    pattern: /停车场|停车楼|停车/,
    iconKey: "parking",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "parking",
  },
  {
    pattern: /加油站|加气站/,
    iconKey: "gas",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "gas",
  },
  {
    pattern: /充电桩|充电站/,
    iconKey: "charging",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "charging",
  },
  {
    pattern: /出租车|打车/,
    iconKey: "taxi",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "taxi",
  },
  {
    pattern: /公交|巴士|汽车站/,
    iconKey: "bus",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "bus",
  },
  {
    pattern: /码头|渡轮|游船/,
    iconKey: "ferry",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "ferry",
  },
  {
    pattern: /自行车|骑行/,
    iconKey: "bike",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "bike",
  },
  {
    pattern: /租车|自驾|汽车租赁/,
    iconKey: "car",
    category: "交通",
    weight: 100,
    poiGroup: "transport",
    poiType: "car",
  },

  {
    pattern: /动物园|野生动物园/,
    iconKey: "zoo",
    category: "景点",
    weight: 100,
    poiGroup: "attraction",
    poiType: "zoo",
  },
  {
    pattern: /水族馆|海洋馆|海洋世界/,
    iconKey: "aquarium",
    category: "景点",
    weight: 100,
    poiGroup: "attraction",
    poiType: "aquarium",
  },
  {
    pattern: /游乐园|主题公园|欢乐谷|迪士尼|环球影城/,
    iconKey: "themepark",
    category: "景点",
    weight: 100,
    poiGroup: "attraction",
    poiType: "themepark",
  },
  {
    pattern: /博物馆|博物院|美术馆|纪念馆|展览馆|科技馆/,
    iconKey: "museum",
    category: "景点",
    weight: 100,
    poiGroup: "attraction",
    poiType: "museum",
  },

  {
    pattern: /海底捞|呷哺/,
    iconKey: "hotpot",
    category: "餐厅",
    weight: 100,
    poiGroup: "food",
    poiType: "hotpot",
  },
  {
    pattern: /星巴克|瑞幸|COSTA/,
    iconKey: "cafe",
    category: "餐厅",
    weight: 100,
    poiGroup: "food",
    poiType: "cafe",
  },
  {
    pattern: /麦当劳|肯德基|KFC|汉堡王/,
    iconKey: "fastfood",
    category: "餐厅",
    weight: 100,
    poiGroup: "food",
    poiType: "fastfood",
  },
  {
    pattern: /喜茶|奈雪|茶百道|蜜雪冰城/,
    iconKey: "tea",
    category: "餐厅",
    weight: 100,
    poiGroup: "food",
    poiType: "tea",
  },

  {
    pattern: /山姆|盒马|永辉|大润发|物美/,
    iconKey: "supermarket",
    category: "购物",
    weight: 100,
    poiGroup: "shopping",
    poiType: "supermarket",
  },
  {
    pattern: /银泰|万达|万象城|大悦城|来福士|太古里/,
    iconKey: "mall",
    category: "购物",
    weight: 100,
    poiGroup: "shopping",
    poiType: "mall",
  },

  {
    pattern: /古城|古镇/,
    iconKey: "ancient",
    category: "景点",
    weight: 90,
    poiGroup: "attraction",
    poiType: "ancient",
  },
  {
    pattern: /溶洞|岩洞/,
    iconKey: "cave",
    category: "景点",
    weight: 90,
    poiGroup: "attraction",
    poiType: "cave",
  },
  {
    pattern: /公园|植物园/,
    iconKey: "park",
    category: "景点",
    weight: 90,
    poiGroup: "attraction",
    poiType: "park",
  },
  {
    pattern: /寺|庙|教堂|清真寺/,
    iconKey: "temple",
    category: "景点",
    weight: 90,
    poiGroup: "attraction",
    poiType: "temple",
  },
  {
    pattern: /观景台|瞭望台/,
    iconKey: "viewpoint",
    category: "景点",
    weight: 90,
    poiGroup: "attraction",
    poiType: "viewpoint",
  },

  {
    pattern: /火锅|涮/,
    iconKey: "hotpot",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "hotpot",
  },
  {
    pattern: /咖啡/,
    iconKey: "cafe",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "cafe",
  },
  {
    pattern: /烧烤|烤肉/,
    iconKey: "bbq",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "bbq",
  },
  {
    pattern: /寿司|刺身|日料/,
    iconKey: "japanese",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "japanese",
  },
  {
    pattern: /韩餐|韩式/,
    iconKey: "korean",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "korean",
  },
  {
    pattern: /西餐|牛排/,
    iconKey: "western",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "western",
  },
  {
    pattern: /海鲜/,
    iconKey: "seafood",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "seafood",
  },
  {
    pattern: /自助餐/,
    iconKey: "buffet",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "buffet",
  },
  {
    pattern: /面馆/,
    iconKey: "noodles",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "noodles",
  },
  {
    pattern: /甜品|蛋糕/,
    iconKey: "dessert",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "dessert",
  },
  {
    pattern: /面包|烘焙/,
    iconKey: "bakery",
    category: "餐厅",
    weight: 90,
    poiGroup: "food",
    poiType: "bakery",
  },

  {
    pattern: /海滩|沙滩/,
    iconKey: "beach",
    category: "景点",
    weight: 80,
    poiGroup: "attraction",
    poiType: "beach",
  },
  {
    pattern: /岛|半岛/,
    iconKey: "island",
    category: "景点",
    weight: 80,
    poiGroup: "attraction",
    poiType: "island",
  },

  {
    pattern: /酒店|旅馆|宾馆/,
    iconKey: "hotel",
    category: "酒店",
    weight: 80,
    poiGroup: "hotel",
    poiType: "hotel",
  },
  {
    pattern: /民宿|客栈/,
    iconKey: "guesthouse",
    category: "酒店",
    weight: 80,
    poiGroup: "hotel",
    poiType: "guesthouse",
  },
  {
    pattern: /青旅|青年旅舍/,
    iconKey: "hostel",
    category: "酒店",
    weight: 80,
    poiGroup: "hotel",
    poiType: "hostel",
  },
  {
    pattern: /露营|营地/,
    iconKey: "camping",
    category: "酒店",
    weight: 80,
    poiGroup: "hotel",
    poiType: "camping",
  },
  {
    pattern: /别墅/,
    iconKey: "villa",
    category: "酒店",
    weight: 80,
    poiGroup: "hotel",
    poiType: "villa",
  },
  {
    pattern: /度假村|温泉/,
    iconKey: "resort",
    category: "酒店",
    weight: 80,
    poiGroup: "hotel",
    poiType: "resort",
  },

  {
    pattern: /超市|便利店/,
    iconKey: "supermarket",
    category: "购物",
    weight: 80,
    poiGroup: "shopping",
    poiType: "supermarket",
  },
  {
    pattern: /菜市场|夜市|集市/,
    iconKey: "market",
    category: "购物",
    weight: 80,
    poiGroup: "shopping",
    poiType: "market",
  },
  {
    pattern: /商场|商城|百货/,
    iconKey: "mall",
    category: "购物",
    weight: 80,
    poiGroup: "shopping",
    poiType: "mall",
  },

  {
    pattern: /图书馆/,
    iconKey: "library",
    category: "教育",
    weight: 80,
    poiGroup: "education",
    poiType: "library",
  },
  {
    pattern: /大学|学院/,
    iconKey: "university",
    category: "教育",
    weight: 80,
    poiGroup: "education",
    poiType: "university",
  },
  {
    pattern: /研究院|研究所/,
    iconKey: "research",
    category: "教育",
    weight: 80,
    poiGroup: "education",
    poiType: "research",
  },
  {
    pattern: /学校|中学|小学|幼儿园/,
    iconKey: "school",
    category: "教育",
    weight: 80,
    poiGroup: "education",
    poiType: "school",
  },

  {
    pattern: /医院/,
    iconKey: "hospital",
    category: "医疗",
    weight: 80,
    poiGroup: "medical",
    poiType: "hospital",
  },
  {
    pattern: /诊所|卫生室/,
    iconKey: "clinic",
    category: "医疗",
    weight: 80,
    poiGroup: "medical",
    poiType: "clinic",
  },
  {
    pattern: /药房|药店/,
    iconKey: "pharmacy",
    category: "医疗",
    weight: 80,
    poiGroup: "medical",
    poiType: "pharmacy",
  },
  {
    pattern: /牙科|口腔/,
    iconKey: "dentist",
    category: "医疗",
    weight: 80,
    poiGroup: "medical",
    poiType: "dentist",
  },

  {
    pattern: /银行/,
    iconKey: "bank",
    category: "其他",
    weight: 80,
    poiGroup: "other",
    poiType: "bank",
  },
  {
    pattern: /快递|物流/,
    iconKey: "delivery",
    category: "其他",
    weight: 80,
    poiGroup: "other",
    poiType: "delivery",
  },
  {
    pattern: /政府|派出所|法院/,
    iconKey: "government",
    category: "其他",
    weight: 80,
    poiGroup: "other",
    poiType: "government",
  },
  {
    pattern: /使馆|领事馆/,
    iconKey: "embassy",
    category: "其他",
    weight: 80,
    poiGroup: "other",
    poiType: "embassy",
  },
  {
    pattern: /写字楼|大厦/,
    iconKey: "office",
    category: "其他",
    weight: 80,
    poiGroup: "other",
    poiType: "office",
  },

  {
    pattern: /餐厅|饭店|食堂/,
    iconKey: "restaurant",
    category: "餐厅",
    weight: 70,
    poiGroup: "food",
    poiType: "restaurant",
  },
  {
    pattern: /酒吧|清吧/,
    iconKey: "bar",
    category: "餐厅",
    weight: 70,
    poiGroup: "food",
    poiType: "bar",
  },

  {
    pattern: /山(?!庄|寨|姆)/,
    iconKey: "mountain",
    category: "景点",
    weight: 50,
    poiGroup: "attraction",
    poiType: "mountain",
  },
  {
    pattern: /湖(?!南|北|滨|畔)/,
    iconKey: "water",
    category: "景点",
    weight: 50,
    poiGroup: "attraction",
    poiType: "water",
  },
  {
    pattern: /河|江|溪/,
    iconKey: "water",
    category: "景点",
    weight: 50,
    poiGroup: "attraction",
    poiType: "water",
  },
  {
    pattern: /^海$/,
    iconKey: "sea",
    category: "景点",
    weight: 50,
    poiGroup: "attraction",
    poiType: "sea",
  },

  {
    pattern: /花园|家园|小区|公寓/,
    iconKey: "residential",
    category: "其他",
    weight: 30,
    poiGroup: "other",
    poiType: "residential",
  },
];

function inferKindByName(
  name?: string,
  amapCategory?: TripPlaceCategory,
): PlaceKind | undefined {
  if (!name) {
    return undefined;
  }

  const { mainName, bracketContent, shouldCheckBracket } =
    analyzePlaceName(name);

  const fullName = shouldCheckBracket
    ? `${mainName} ${bracketContent}`
    : mainName;

  const matches: ((typeof KEYWORD_RULES)[0] & { matchedName: string })[] = [];

  const strictCategories: TripPlaceCategory[] = [
    "景点",
    "餐厅",
    "酒店",
    "购物",
    "教育",
    "医疗",
  ];
  const isStrictCategory =
    amapCategory && strictCategories.includes(amapCategory);

  for (const rule of KEYWORD_RULES) {
    if (isStrictCategory && rule.category !== amapCategory) {
      continue;
    }

    if (rule.pattern.test(mainName)) {
      matches.push({ ...rule, matchedName: mainName });
    }
    if (rule.pattern.test(fullName) && fullName !== mainName) {
      matches.push({ ...rule, matchedName: fullName });
    }
    if (shouldCheckBracket && rule.pattern.test(bracketContent)) {
      matches.push({ ...rule, matchedName: bracketContent });
    }
  }

  if (matches.length > 0) {
    matches.sort((a, b) => b.weight - a.weight);
    const best = matches[0];
    return {
      category: best.category,
      iconKey: best.iconKey,
      poiGroup: best.poiGroup,
      poiType: best.poiType,
    };
  }

  return undefined;
}

export function isTripPlaceIconKey(value: unknown): value is TripPlaceIconKey {
  return (
    typeof value === "string" && iconKeys.includes(value as TripPlaceIconKey)
  );
}

export function isTripPlacePoiGroup(
  value: unknown,
): value is TripPlacePoiGroup {
  return (
    typeof value === "string" && poiGroups.includes(value as TripPlacePoiGroup)
  );
}

export function getFallbackPlaceKind(
  category: TripPlaceCategory = "其他",
): PlaceKind {
  return categoryFallbackKinds[category];
}

export function inferPlaceKind({
  category = "其他",
  name,
  osmKey,
  osmValue,
  amapSecondary,
}: PlaceKindInput): PlaceKind {
  const poiType = buildPoiType(
    osmKey,
    osmValue,
    categoryFallbackKinds[category].poiType,
  );

  if (osmKey === "tourism") {
    if (osmValue === "hotel" || osmValue === "motel") {
      return { category: "酒店", iconKey: "hotel", poiGroup: "hotel", poiType };
    }

    if (
      osmValue === "hostel" ||
      osmValue === "guest_house" ||
      osmValue === "apartment"
    ) {
      return {
        category: "酒店",
        iconKey: "guesthouse",
        poiGroup: "hotel",
        poiType,
      };
    }

    if (osmValue === "museum" || osmValue === "gallery") {
      return {
        category: "景点",
        iconKey: "museum",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "viewpoint") {
      return {
        category: "景点",
        iconKey: "viewpoint",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "zoo") {
      return {
        category: "景点",
        iconKey: "zoo",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "aquarium") {
      return {
        category: "景点",
        iconKey: "aquarium",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "theme_park") {
      return {
        category: "景点",
        iconKey: "themepark",
        poiGroup: "attraction",
        poiType,
      };
    }

    return {
      category: "景点",
      iconKey: "landmark",
      poiGroup: "attraction",
      poiType,
    };
  }

  if (osmKey === "historic") {
    return {
      category: "景点",
      iconKey: "ancient",
      poiGroup: "attraction",
      poiType,
    };
  }

  if (osmKey === "amenity") {
    if (
      osmValue === "restaurant" ||
      osmValue === "food_court" ||
      osmValue === "fast_food"
    ) {
      return {
        category: "餐厅",
        iconKey: "restaurant",
        poiGroup: "food",
        poiType,
      };
    }

    if (osmValue === "cafe") {
      return { category: "餐厅", iconKey: "cafe", poiGroup: "food", poiType };
    }

    if (osmValue === "bar" || osmValue === "pub") {
      return { category: "餐厅", iconKey: "bar", poiGroup: "food", poiType };
    }

    if (osmValue === "bus_station" || osmValue === "ferry_terminal") {
      return {
        category: "交通",
        iconKey: "bus",
        poiGroup: "transport",
        poiType,
      };
    }

    if (osmValue === "parking" || osmValue === "car_rental") {
      return {
        category: "交通",
        iconKey: "parking",
        poiGroup: "transport",
        poiType,
      };
    }

    if (osmValue === "place_of_worship") {
      return {
        category: "景点",
        iconKey: "temple",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "bank") {
      return { category: "其他", iconKey: "bank", poiGroup: "other", poiType };
    }

    if (osmValue === "atm") {
      return { category: "其他", iconKey: "atm", poiGroup: "other", poiType };
    }

    if (osmValue === "pharmacy") {
      return {
        category: "医疗",
        iconKey: "pharmacy",
        poiGroup: "medical",
        poiType,
      };
    }

    if (osmValue === "hospital") {
      return {
        category: "医疗",
        iconKey: "hospital",
        poiGroup: "medical",
        poiType,
      };
    }

    if (osmValue === "school") {
      return {
        category: "教育",
        iconKey: "school",
        poiGroup: "education",
        poiType,
      };
    }

    if (osmValue === "library") {
      return {
        category: "教育",
        iconKey: "library",
        poiGroup: "education",
        poiType,
      };
    }
  }

  if (osmKey === "railway") {
    if (osmValue === "subway_entrance" || osmValue === "subway") {
      return {
        category: "交通",
        iconKey: "subway",
        poiGroup: "transport",
        poiType,
      };
    }

    return {
      category: "交通",
      iconKey: "train",
      poiGroup: "transport",
      poiType,
    };
  }

  if (osmKey === "aeroway") {
    return {
      category: "交通",
      iconKey: "airport",
      poiGroup: "transport",
      poiType,
    };
  }

  if (osmKey === "shop") {
    if (osmValue === "mall" || osmValue === "department_store") {
      return {
        category: "购物",
        iconKey: "mall",
        poiGroup: "shopping",
        poiType,
      };
    }

    if (osmValue === "supermarket" || osmValue === "convenience") {
      return {
        category: "购物",
        iconKey: "supermarket",
        poiGroup: "shopping",
        poiType,
      };
    }

    if (osmValue === "clothes" || osmValue === "shoes") {
      return {
        category: "购物",
        iconKey: "clothing",
        poiGroup: "shopping",
        poiType,
      };
    }

    if (osmValue === "electronics") {
      return {
        category: "购物",
        iconKey: "electronics",
        poiGroup: "shopping",
        poiType,
      };
    }

    return {
      category: "购物",
      iconKey: "shopping",
      poiGroup: "shopping",
      poiType,
    };
  }

  if (osmKey === "leisure") {
    if (
      osmValue === "park" ||
      osmValue === "garden" ||
      osmValue === "nature_reserve"
    ) {
      return {
        category: "景点",
        iconKey: "park",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "water_park") {
      return {
        category: "景点",
        iconKey: "themepark",
        poiGroup: "attraction",
        poiType,
      };
    }

    return {
      category: "景点",
      iconKey: "attraction",
      poiGroup: "attraction",
      poiType,
    };
  }

  if (osmKey === "natural") {
    if (osmValue === "peak" || osmValue === "ridge") {
      return {
        category: "景点",
        iconKey: "mountain",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "water" || osmValue === "lake" || osmValue === "river") {
      return {
        category: "景点",
        iconKey: "water",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "beach") {
      return {
        category: "景点",
        iconKey: "beach",
        poiGroup: "attraction",
        poiType,
      };
    }

    if (osmValue === "cave_entrance") {
      return {
        category: "景点",
        iconKey: "cave",
        poiGroup: "attraction",
        poiType,
      };
    }

    return {
      category: "景点",
      iconKey: "viewpoint",
      poiGroup: "attraction",
      poiType,
    };
  }

  const amapResult = inferKindByAmapSecondary(amapSecondary, category);
  if (amapResult) {
    return amapResult;
  }

  const nameResult = inferKindByName(name, category);
  if (nameResult) {
    return nameResult;
  }

  return categoryFallbackKinds[category];
}
