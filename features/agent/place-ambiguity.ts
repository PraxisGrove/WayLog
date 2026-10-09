export function isRequestedPlaceCandidate(
  candidateName: string,
  query: string,
  userMessage: string,
): boolean {
  const normalizedName = normalizePlaceAmbiguityText(candidateName);
  const normalizedQuery = normalizePlaceAmbiguityText(query);
  const normalizedUserMessage = normalizePlaceAmbiguityText(userMessage);

  return Boolean(
    normalizedQuery.length >= 2 &&
      (normalizedName === normalizedQuery ||
        isConventionalVenueName(normalizedName, normalizedQuery)) &&
      normalizedUserMessage.includes(normalizedQuery) &&
      !isUnrequestedDerivedPlaceName(candidateName, query, userMessage),
  );
}

function isConventionalVenueName(
  normalizedName: string,
  normalizedQuery: string,
): boolean {
  const suffix = normalizedName.slice(normalizedQuery.length);
  return (
    normalizedName.startsWith(normalizedQuery) &&
    ["公园", "景区", "风景区"].includes(suffix)
  );
}

export function isUnrequestedDerivedPlaceName(
  candidateName: string,
  query: string,
  userMessage = query,
): boolean {
  const normalizedName = normalizePlaceAmbiguityText(candidateName);
  const normalizedQuery = normalizePlaceAmbiguityText(query);
  const normalizedUserMessage = normalizePlaceAmbiguityText(userMessage);

  if (!normalizedName || !normalizedQuery) {
    return false;
  }

  const matchedSubPlaceWord = findSubPlaceWord(candidateName);

  if (
    matchedSubPlaceWord &&
    !normalizedUserMessage.includes(
      normalizePlaceAmbiguityText(matchedSubPlaceWord),
    )
  ) {
    return true;
  }

  if (
    !normalizedName.startsWith(normalizedQuery) ||
    normalizedName.length <= normalizedQuery.length
  ) {
    return hasUnrequestedPlaceQualifier(normalizedName, normalizedUserMessage);
  }

  const suffix = normalizedName.slice(normalizedQuery.length);

  return Boolean(
    suffix &&
      !normalizedUserMessage.includes(suffix) &&
      isPlaceQualifierText(suffix),
  );
}

function hasUnrequestedPlaceQualifier(
  normalizedName: string,
  normalizedUserMessage: string,
): boolean {
  const matchedQualifier = findPlaceQualifierText(normalizedName);

  return (
    matchedQualifier !== undefined &&
    !normalizedUserMessage.includes(matchedQualifier)
  );
}

function findSubPlaceWord(name: string): string | undefined {
  const subPlaceWords = [
    "东门",
    "西门",
    "南门",
    "北门",
    "入口",
    "出口",
    "游客中心",
    "停车场",
    "停车点",
    "售票处",
    "服务中心",
    "地铁站",
    "公交站",
    "公交车站",
  ];
  const matchedSpecificWord = subPlaceWords.find((word) => name.includes(word));

  if (matchedSpecificWord) {
    return matchedSpecificWord;
  }

  if (!/[·\-－—/｜|]/u.test(name)) {
    return undefined;
  }

  const hierarchicalSubPlaceWords = [
    "广场",
    "公园",
    "码头",
    "观景台",
    "寺",
    "庙",
    "博物馆",
    "纪念馆",
    "展览馆",
  ];

  return hierarchicalSubPlaceWords.find((word) => name.includes(word));
}

function findPlaceQualifierText(normalizedName: string): string | undefined {
  const qualifierPatterns = [
    /(?:东|西|南|北|内|外)?环线/u,
    /(?:东|西|南|北|内|外)?线/u,
    /(?:上|中|下)?段/u,
    /(?:徒步|观光|游览|旅游|景区)?路线/u,
    /(?:观光|旅游)?栈道/u,
    /(?:观光|旅游)?步道/u,
    /(?:观光|景区)?车线/u,
    /(?:上|中|下)虎跳/u,
  ];

  return qualifierPatterns
    .map((pattern) => normalizedName.match(pattern)?.[0])
    .find((value): value is string => Boolean(value));
}

function isPlaceQualifierText(value: string): boolean {
  return findPlaceQualifierText(value) !== undefined;
}

function normalizePlaceAmbiguityText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[（(].*?[）)]/g, "")
    .replace(/\s+/g, "");
}
