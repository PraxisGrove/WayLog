import assert from "node:assert/strict";
import test from "node:test";

import {
  type AgentTripDraft,
  type AgentTripDraftStorage,
  deleteAgentTripDraft,
  getAgentTripDraft,
  parseAgentTripDraft,
  saveAgentTripDraft,
  tripDraftToCreateTripInput,
} from "../../../features/agent";

function createVerifiedDraft(
  overrides: Partial<AgentTripDraft> = {},
): AgentTripDraft {
  return {
    assumptions: [],
    createdAt: "2026-06-30T08:00:00.000Z",
    dayCount: 2,
    days: [
      {
        dayIndex: 1,
        items: [
          {
            address: "陕西省西安市碑林区南大街",
            category: "景点",
            latitude: 34.2594,
            longitude: 108.947,
            placeName: "西安钟楼",
            provider: "amap",
            providerPlaceId: "B0FFG4V5W2",
            title: "西安钟楼",
          },
        ],
        title: "第一天",
      },
      {
        dayIndex: 2,
        items: [
          {
            address: "陕西省西安市临潼区秦陵北路",
            category: "景点",
            latitude: 34.3841,
            longitude: 109.2785,
            placeName: "秦始皇帝陵博物院",
            provider: "amap",
            providerPlaceId: "B0TERRACOTTA",
            title: "秦始皇帝陵博物院",
          },
        ],
        title: "第二天",
      },
    ],
    destination: "西安",
    draftId: "draft-verified",
    source: "local_v1",
    title: "西安 2 日游",
    updatedAt: "2026-06-30T08:00:00.000Z",
    warnings: [],
    ...overrides,
  };
}

function createMemoryStorage(): AgentTripDraftStorage {
  const values = new Map<string, string>();

  return {
    getItem: async (key) => values.get(key) ?? null,
    removeItem: async (key) => {
      values.delete(key);
    },
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}

test("converts a trip draft into the existing createTrip input shape", () => {
  const draft = createVerifiedDraft({ draftId: "draft-create-input" });
  const input = tripDraftToCreateTripInput(draft, { currency: "CNY" });

  assert.equal(input.title, draft.title);
  assert.equal(input.destination, draft.destination);
  assert.equal(input.currency, "CNY");
  assert.equal(input.days?.length, 2);
  assert.ok((input.places?.length ?? 0) > 0);
  assert.equal(input.days?.[0]?.items[0]?.placeId, input.places?.[0]?.id);
});

test("preserves verified POI identity and coordinates when converting a trip draft", () => {
  const draft = parseAgentTripDraft({
    assumptions: [],
    createdAt: "2026-07-13T00:00:00.000Z",
    dayCount: 1,
    days: [
      {
        dayIndex: 1,
        items: [
          {
            address: "陕西省西安市碑林区南大街",
            area: "碑林区",
            category: "景点",
            latitude: 34.2594,
            longitude: 108.947,
            placeName: "西安钟楼",
            poiType: "风景名胜",
            provider: "amap",
            providerPlaceId: "B0FFG4V5W2",
            title: "西安钟楼",
          },
        ],
        title: "第 1 天",
      },
    ],
    destination: "西安",
    draftId: "draft-xian-poi",
    source: "local_v1",
    title: "西安 1 日游",
    updatedAt: "2026-07-13T00:00:00.000Z",
    warnings: [],
  });

  if (!draft) {
    throw new Error("expected a valid trip draft");
  }
  const input = tripDraftToCreateTripInput(draft);
  const place = input.places?.[0];

  assert.equal(place?.name, "西安钟楼");
  assert.equal(place?.address, "陕西省西安市碑林区南大街");
  assert.equal(place?.latitude, 34.2594);
  assert.equal(place?.longitude, 108.947);
  assert.equal(place?.provider, "amap");
  assert.equal(place?.providerPlaceId, "B0FFG4V5W2");
  assert.equal(place?.externalRefs?.amapPoiId, "B0FFG4V5W2");
});

test("parses missing draft day titles as default trip day titles", () => {
  const draft = parseAgentTripDraft({
    assumptions: [],
    createdAt: "2026-07-06T10:00:00.000Z",
    dayCount: 2,
    days: [
      { dayIndex: 1, items: [] },
      { dayIndex: 2, items: [], title: "  大理古城与洱海  " },
    ],
    destination: "云南",
    draftId: "draft-missing-day-title",
    source: "local_v1",
    title: "云南 2 日游",
    updatedAt: "2026-07-06T10:00:00.000Z",
    warnings: [],
  });

  assert.equal(draft?.days[0]?.title, "第一天");
  assert.equal(draft?.days[1]?.title, "大理古城与洱海");
});

test("stores and removes a trip draft locally", async () => {
  const storage = createMemoryStorage();
  const draft = createVerifiedDraft({ draftId: "draft-storage" });

  await saveAgentTripDraft(draft, { storage });

  assert.deepEqual(
    await getAgentTripDraft("draft-storage", { storage }),
    parseAgentTripDraft(draft),
  );

  await deleteAgentTripDraft("draft-storage", { storage });

  assert.equal(
    await getAgentTripDraft("draft-storage", { storage }),
    undefined,
  );
});

test("stores planner steps and quality checks with trip drafts", async () => {
  const storage = createMemoryStorage();
  const draft = createVerifiedDraft({ draftId: "draft-planner-meta" });
  const draftWithPlannerMeta = {
    ...draft,
    planner: {
      qualityChecks: [
        {
          id: "route_balance",
          message: "路线估算未发现明显过长移动。",
          status: "pass",
        },
      ],
      steps: [
        {
          description: "查询地点、天气和路线估算",
          id: "gather_signals",
          status: "completed",
        },
      ],
    },
  } satisfies typeof draft;

  await saveAgentTripDraft(draftWithPlannerMeta, { storage });

  const restored = await getAgentTripDraft("draft-planner-meta", { storage });

  assert.deepEqual(restored?.planner, draftWithPlannerMeta.planner);
});
