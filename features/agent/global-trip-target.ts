export type AgentTripTargetSummary = {
  dayCount: number;
  destination?: string;
  endDate?: string;
  id: string;
  startDate?: string;
  status?: string;
  title: string;
};

export type AgentTripTargetCandidate = AgentTripTargetSummary & {
  matchedText: string[];
  score: number;
};

export type AgentTripTargetResolution =
  | {
      candidates: AgentTripTargetCandidate[];
      reason: string;
      status: "ambiguous";
    }
  | {
      candidate: AgentTripTargetCandidate;
      status: "resolved";
    }
  | {
      reason: string;
      status: "not_found";
    };

const DEFAULT_MIN_SCORE = 28;
const DEFAULT_AMBIGUOUS_SCORE_GAP = 12;
const FALLBACK_CANDIDATE_LIMIT = 3;

export function resolveAgentTripTarget(
  message: string,
  trips: AgentTripTargetSummary[],
  options: {
    ambiguousScoreGap?: number;
    minScore?: number;
  } = {},
): AgentTripTargetResolution {
  const normalizedMessage = normalizeAgentTargetText(message);
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  const ambiguousScoreGap =
    options.ambiguousScoreGap ?? DEFAULT_AMBIGUOUS_SCORE_GAP;

  if (!normalizedMessage || trips.length === 0) {
    return {
      reason:
        trips.length === 0
          ? "当前还没有可修改的行程"
          : "没有识别到要修改哪条行程",
      status: "not_found",
    };
  }

  const candidates = trips
    .map((trip) => scoreTripTargetCandidate(trip, normalizedMessage))
    .filter(
      (candidate): candidate is AgentTripTargetCandidate =>
        candidate !== undefined && candidate.score >= minScore,
    )
    .sort(
      (left, right) =>
        right.score - left.score || compareTripTargetRecency(left, right),
    );

  const bestCandidate = candidates[0];

  if (!bestCandidate) {
    const fallbackCandidates = createActionFallbackTripCandidates(
      trips,
      normalizedMessage,
    );

    if (fallbackCandidates.length > 0) {
      return {
        candidates: fallbackCandidates.slice(0, FALLBACK_CANDIDATE_LIMIT),
        reason: "没有直接匹配到行程，请选择要修改的那一条",
        status: "ambiguous",
      };
    }

    return {
      reason: "没有找到与用户描述匹配的行程",
      status: "not_found",
    };
  }

  if (shouldAskForWeakActionTarget(normalizedMessage, candidates)) {
    return {
      candidates: candidates.slice(0, FALLBACK_CANDIDATE_LIMIT),
      reason: "没有直接匹配到行程，请选择要修改的那一条",
      status: "ambiguous",
    };
  }

  const exactTitleCandidates = createExactTitleTripNameCandidates(
    normalizedMessage,
    trips,
  );

  if (exactTitleCandidates.length === 1) {
    return {
      candidate: exactTitleCandidates[0],
      status: "resolved",
    };
  }

  const spokenTitleCoreCandidates = createSpokenTitleCoreTripNameCandidates(
    normalizedMessage,
    trips,
  );

  if (spokenTitleCoreCandidates.length > 1) {
    return {
      candidates: spokenTitleCoreCandidates.slice(0, FALLBACK_CANDIDATE_LIMIT),
      reason: "行程名称匹配到多个相似标题，请确认要修改的那一条",
      status: "ambiguous",
    };
  }

  if (spokenTitleCoreCandidates.length === 1) {
    return {
      candidate: spokenTitleCoreCandidates[0],
      status: "resolved",
    };
  }

  const secondCandidate = candidates[1];

  if (
    secondCandidate &&
    bestCandidate.score - secondCandidate.score < ambiguousScoreGap
  ) {
    return {
      candidates: candidates.slice(0, 3),
      reason: "找到了多个相似行程，请让用户选择要修改的那一条",
      status: "ambiguous",
    };
  }

  return {
    candidate: bestCandidate,
    status: "resolved",
  };
}

export function createAgentTripTargetSummaries(
  trips: AgentTripTargetSummary[],
): AgentTripTargetSummary[] {
  return trips.map((trip) => ({
    dayCount: trip.dayCount,
    destination: emptyToUndefined(trip.destination),
    endDate: emptyToUndefined(trip.endDate),
    id: trip.id,
    startDate: emptyToUndefined(trip.startDate),
    status: emptyToUndefined(trip.status),
    title: trip.title,
  }));
}

function scoreTripTargetCandidate(
  trip: AgentTripTargetSummary,
  normalizedMessage: string,
): AgentTripTargetCandidate | undefined {
  const matchedText: string[] = [];
  let score = 0;

  const titleScore = scoreTextMatch(trip.title, normalizedMessage);

  if (titleScore > 0) {
    score += titleScore + 18;
    matchedText.push(trip.title);
  }

  const destination = trip.destination;
  if (destination) {
    const destinationScore = scoreTextMatch(destination, normalizedMessage);
    if (destinationScore > 0) {
      score += destinationScore + 10;
      matchedText.push(destination);
    }
  }

  const dayCountText = `${trip.dayCount}日`;
  const dayCountTexts = getTripDayCountTexts(trip);

  if (
    dayCountTexts.some((text) =>
      containsTripDurationText(normalizedMessage, text),
    )
  ) {
    score += 20;
    matchedText.push(dayCountText);
  }

  if (
    trip.startDate &&
    normalizeAgentTargetText(trip.startDate) &&
    normalizedMessage.includes(normalizeAgentTargetText(trip.startDate))
  ) {
    score += 8;
    matchedText.push(trip.startDate);
  }

  if (
    trip.endDate &&
    normalizeAgentTargetText(trip.endDate) &&
    normalizedMessage.includes(normalizeAgentTargetText(trip.endDate))
  ) {
    score += 8;
    matchedText.push(trip.endDate);
  }

  if (score <= 0) {
    return undefined;
  }

  return {
    ...trip,
    matchedText: Array.from(new Set(matchedText.filter(Boolean))),
    score,
  };
}

function createActionFallbackTripCandidates(
  trips: AgentTripTargetSummary[],
  normalizedMessage: string,
): AgentTripTargetCandidate[] {
  const requestedDayIndex = parseRequestedTripDayIndex(normalizedMessage);

  if (
    !looksLikeTripMutationMessage(normalizedMessage) ||
    requestedDayIndex === undefined
  ) {
    return [];
  }

  return trips
    .filter((trip) => trip.dayCount >= requestedDayIndex)
    .map((trip) => ({
      ...trip,
      matchedText: [`第${requestedDayIndex}天`],
      score: 20 + requestedDayIndex,
    }))
    .sort(
      (left, right) =>
        right.score - left.score || compareTripTargetRecency(left, right),
    );
}

function shouldAskForWeakActionTarget(
  normalizedMessage: string,
  candidates: AgentTripTargetCandidate[],
): boolean {
  return (
    looksLikeTripMutationMessage(normalizedMessage) &&
    parseRequestedTripDayIndex(normalizedMessage) !== undefined &&
    candidates.length > 0 &&
    candidates.every(
      (candidate) => !hasStrongTripIdentityMatch(candidate, normalizedMessage),
    )
  );
}

function hasStrongTripIdentityMatch(
  trip: AgentTripTargetSummary,
  normalizedMessage: string,
): boolean {
  const normalizedTitle = normalizeAgentTargetText(trip.title);
  const compactTitle = normalizeAgentTargetText(
    trip.title.replace(/[旅行行程计划游]/g, ""),
  );

  if (
    normalizedTitle.length >= 3 &&
    normalizedMessage.includes(normalizedTitle)
  ) {
    return true;
  }

  if (
    compactTitle.length >= 3 &&
    compactTitle !== normalizeAgentTargetText(trip.destination ?? "") &&
    normalizedMessage.includes(compactTitle)
  ) {
    return true;
  }

  if (
    getTripDayCountTexts(trip).some((text) =>
      containsTripDurationText(normalizedMessage, text),
    )
  ) {
    return true;
  }

  return Boolean(
    (trip.startDate &&
      normalizeAgentTargetText(trip.startDate) &&
      normalizedMessage.includes(normalizeAgentTargetText(trip.startDate))) ||
      (trip.endDate &&
        normalizeAgentTargetText(trip.endDate) &&
        normalizedMessage.includes(normalizeAgentTargetText(trip.endDate))),
  );
}

function createSpokenTitleCoreTripNameCandidates(
  normalizedMessage: string,
  trips: AgentTripTargetSummary[],
): AgentTripTargetCandidate[] {
  const spokenIdentityText = findLongestSpokenTripTitleIdentityText(
    normalizedMessage,
    trips,
  );

  if (!spokenIdentityText) {
    return [];
  }

  return trips
    .map((trip) =>
      createSpokenTitleCoreTripNameCandidate(
        trip,
        normalizedMessage,
        spokenIdentityText,
      ),
    )
    .filter(
      (candidate): candidate is AgentTripTargetCandidate =>
        candidate !== undefined,
    )
    .sort(
      (left, right) =>
        right.score - left.score || compareTripTargetRecency(left, right),
    );
}

function createExactTitleTripNameCandidates(
  normalizedMessage: string,
  trips: AgentTripTargetSummary[],
): AgentTripTargetCandidate[] {
  if (!looksLikeTripMutationMessage(normalizedMessage)) {
    return [];
  }

  return trips
    .map((trip) => {
      const normalizedTitle = normalizeAgentTargetText(trip.title);

      if (
        normalizedTitle.length < 3 ||
        !containsStandaloneTripTitle(normalizedMessage, normalizedTitle)
      ) {
        return undefined;
      }

      return (
        scoreTripTargetCandidate(trip, normalizedMessage) ?? {
          ...trip,
          matchedText: [trip.title],
          score: 72 + Math.min(normalizedTitle.length, 16),
        }
      );
    })
    .filter(
      (candidate): candidate is AgentTripTargetCandidate =>
        candidate !== undefined,
    )
    .sort(
      (left, right) =>
        right.score - left.score || compareTripTargetRecency(left, right),
    );
}

function containsStandaloneTripTitle(
  normalizedMessage: string,
  normalizedTitle: string,
): boolean {
  const index = normalizedMessage.indexOf(normalizedTitle);

  if (index < 0) {
    return false;
  }

  const nextCharacter = normalizedMessage[index + normalizedTitle.length] ?? "";

  return !nextCharacter || isTripTitleBoundaryCharacter(nextCharacter);
}

function isTripTitleBoundaryCharacter(value: string): boolean {
  return /[第的这个行程旅行计划安排日天改更移删去加把到给从为成设命]/u.test(
    value,
  );
}

function findLongestSpokenTripTitleIdentityText(
  normalizedMessage: string,
  trips: AgentTripTargetSummary[],
): string | undefined {
  if (!looksLikeTripMutationMessage(normalizedMessage)) {
    return undefined;
  }

  return trips
    .flatMap((trip) => getTripTitleIdentityTexts(trip))
    .filter((identityText) => normalizedMessage.includes(identityText))
    .sort((left, right) => right.length - left.length)[0];
}

function createSpokenTitleCoreTripNameCandidate(
  trip: AgentTripTargetSummary,
  normalizedMessage: string,
  spokenIdentityText: string,
): AgentTripTargetCandidate | undefined {
  const similarTitleIdentityText = getTripTitleIdentityTexts(trip).find(
    (identityText) =>
      isTripTitleIdentityExtendingSpokenCore(identityText, spokenIdentityText),
  );
  const matchesSpokenDestinationAndDuration =
    matchesSpokenDestinationDurationCore(
      trip,
      normalizedMessage,
      spokenIdentityText,
    );

  if (!similarTitleIdentityText && !matchesSpokenDestinationAndDuration) {
    return undefined;
  }

  const scoredCandidate = scoreTripTargetCandidate(trip, normalizedMessage);
  const matchedText = new Set(scoredCandidate?.matchedText ?? []);
  let fallbackScore = 0;

  if (similarTitleIdentityText) {
    matchedText.add(trip.title);
    fallbackScore = Math.max(
      fallbackScore,
      48 + Math.min(similarTitleIdentityText.length, 12),
    );
  }

  if (matchesSpokenDestinationAndDuration) {
    if (trip.destination) {
      matchedText.add(trip.destination);
    }
    matchedText.add(`${trip.dayCount}日`);
    fallbackScore = Math.max(fallbackScore, 42);
  }

  return {
    ...trip,
    matchedText: Array.from(matchedText),
    score: Math.max(scoredCandidate?.score ?? 0, fallbackScore),
  };
}

function isTripTitleIdentityExtendingSpokenCore(
  identityText: string,
  spokenIdentityText: string,
): boolean {
  return (
    identityText === spokenIdentityText ||
    identityText.startsWith(spokenIdentityText)
  );
}

function matchesSpokenDestinationDurationCore(
  trip: AgentTripTargetSummary,
  normalizedMessage: string,
  spokenIdentityText: string,
): boolean {
  const destination = normalizeAgentTargetText(trip.destination ?? "");

  if (
    !destination ||
    !spokenIdentityText.includes(destination) ||
    !normalizedMessage.includes(destination)
  ) {
    return false;
  }

  const spokenDayCount = parseTripDurationFromIdentityText(spokenIdentityText);

  return spokenDayCount !== undefined && trip.dayCount === spokenDayCount;
}

function parseTripDurationFromIdentityText(
  identityText: string,
): number | undefined {
  const match = /(\d+)(?:日|天)/.exec(identityText);

  if (!match) {
    return undefined;
  }

  const value = Number(match[1]);

  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function getTripTitleIdentityTexts(trip: AgentTripTargetSummary): string[] {
  const normalizedTitle = normalizeAgentTargetText(trip.title);
  const compactTitle = normalizeAgentTargetText(
    trip.title.replace(/[旅行行程计划游]/g, ""),
  );
  const destination = normalizeAgentTargetText(trip.destination ?? "");

  return Array.from(
    new Set(
      [normalizedTitle, compactTitle].filter(
        (text) => text.length >= 3 && text !== destination,
      ),
    ),
  );
}

function getTripDayCountTexts(trip: AgentTripTargetSummary): string[] {
  return [
    `${trip.dayCount}天`,
    `${trip.dayCount}日`,
    `${toChineseSmallNumber(trip.dayCount)}日游`,
    `${toChineseSmallNumber(trip.dayCount)}天`,
  ].map(normalizeAgentTargetText);
}

function containsTripDurationText(
  normalizedMessage: string,
  text: string,
): boolean {
  if (!text) {
    return false;
  }

  let index = normalizedMessage.indexOf(text);

  while (index >= 0) {
    if (normalizedMessage[index - 1] !== "第") {
      return true;
    }

    index = normalizedMessage.indexOf(text, index + 1);
  }

  return false;
}

function looksLikeTripMutationMessage(normalizedMessage: string): boolean {
  return /添加|加入|加到|安排|放到|放进|删除|删掉|移除|移动|移到|修改|更新|更改|改到|改成|改为|改名|重命名|命名为|命名成|设置为|设为|add|remove|delete|move|update|rename|set/.test(
    normalizedMessage,
  );
}

function parseRequestedTripDayIndex(
  normalizedMessage: string,
): number | undefined {
  const value = Number(normalizedMessage.match(/第?(\d{1,2})(?:天|日)/u)?.[1]);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

function scoreTextMatch(text: string, normalizedMessage: string): number {
  const normalizedText = normalizeAgentTargetText(text);

  if (!normalizedText) {
    return 0;
  }

  if (normalizedMessage.includes(normalizedText)) {
    return normalizedText.length >= 4 ? 60 : 42;
  }

  const compactText = normalizeAgentTargetText(
    text.replace(/[旅行行程计划游]/g, ""),
  );

  if (compactText.length >= 2 && normalizedMessage.includes(compactText)) {
    return compactText.length >= 4 ? 48 : 34;
  }

  return 0;
}

function compareTripTargetRecency(
  left: AgentTripTargetSummary,
  right: AgentTripTargetSummary,
): number {
  const leftTime = Date.parse(left.startDate ?? left.endDate ?? "");
  const rightTime = Date.parse(right.startDate ?? right.endDate ?? "");

  if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
    return rightTime - leftTime;
  }

  return 0;
}

function normalizeAgentTargetText(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[一二三四五六七八九十两]+(?=\s*[日天])/g, (match) => {
      const numberValue = parseChineseSmallNumber(match);
      return numberValue === undefined ? match : String(numberValue);
    })
    .replace(/[（(].*?[）)]/g, "")
    .replace(/[^\p{Script=Han}a-z0-9]/gu, "");

  return normalized;
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toChineseSmallNumber(value: number): string {
  const digits = [
    "零",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九",
    "十",
  ];

  if (value >= 0 && value <= 10) {
    return digits[value] ?? String(value);
  }

  return String(value);
}

function parseChineseSmallNumber(value: string): number | undefined {
  const digits: Record<string, number> = {
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (value === "十") {
    return 10;
  }

  if (value.includes("十")) {
    const [tenPart, onePart] = value.split("十");
    const tens = tenPart ? digits[tenPart] : 1;
    const ones = onePart ? digits[onePart] : 0;

    return tens !== undefined && ones !== undefined
      ? tens * 10 + ones
      : undefined;
  }

  return digits[value];
}
