import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTripEditProposalCommands,
  createAgentProposalPreview,
  createAgentSkillRegistry,
  defaultAgentSkillRegistry,
  getAgentSkill,
  listRouteVisibleAgentSkills,
  runAgentSkill,
} from "../../../features/agent";
import {
  parseTripDraftSkillInput,
  tripDraftSkillInputSchema,
} from "../../../features/agent/skills/trip-draft";
import type { TripCommandDeps } from "../../../features/trips/commands";
import type { Trip, TripPlaceCategory } from "../../../features/trips/types";

const testCategory = "test-category" as TripPlaceCategory;

function matchesJsonSchema(value: unknown, schema: unknown): boolean {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return false;
  }
  const contract = schema as Record<string, unknown>;
  if (Array.isArray(contract.enum) && !contract.enum.includes(value)) {
    return false;
  }
  const types = Array.isArray(contract.type) ? contract.type : [contract.type];
  if (value === null) return types.includes("null");
  if (types.includes("string") && typeof value === "string") {
    return (
      (typeof contract.minLength !== "number" ||
        value.length >= contract.minLength) &&
      (typeof contract.maxLength !== "number" ||
        value.length <= contract.maxLength)
    );
  }
  const isSchemaNumber =
    typeof value === "number" &&
    ((types.includes("integer") && Number.isInteger(value)) ||
      types.includes("number"));
  if (isSchemaNumber && typeof value === "number") {
    return (
      (typeof contract.minimum !== "number" || value >= contract.minimum) &&
      (typeof contract.maximum !== "number" || value <= contract.maximum)
    );
  }
  if (types.includes("array") && Array.isArray(value)) {
    return value.every((item) => matchesJsonSchema(item, contract.items));
  }
  if (
    types.includes("object") &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const record = value as Record<string, unknown>;
    const properties = (contract.properties ?? {}) as Record<string, unknown>;
    if (
      Array.isArray(contract.required) &&
      contract.required.some(
        (key) => typeof key !== "string" || !(key in record),
      )
    ) {
      return false;
    }
    if (
      contract.additionalProperties === false &&
      Object.keys(record).some((key) => !(key in properties))
    ) {
      return false;
    }
    return Object.entries(record).every(
      ([key, item]) =>
        !(key in properties) || matchesJsonSchema(item, properties[key]),
    );
  }
  return false;
}

function makeTrip(): Trip {
  return {
    checklistItems: [],
    createdAt: "2026-06-01T00:00:00.000Z",
    currency: "CNY",
    days: [
      {
        dayIndex: 1,
        id: "day-1",
        items: [],
        title: "Day 1",
      },
      {
        dayIndex: 2,
        id: "day-2",
        items: [],
        title: "Day 2",
      },
    ],
    destination: "Shanghai",
    endDate: "2026-06-21",
    expenses: [],
    id: "trip-skill-test",
    importSources: [],
    lodgings: [],
    memos: [],
    places: [],
    startDate: "2026-06-20",
    status: "planning" as Trip["status"],
    title: "Shanghai 2 Days",
    transports: [],
    updatedAt: "2026-06-01T10:00:00.000Z",
  };
}

function makeTripWithItem(): Trip {
  const trip = makeTrip();

  trip.places = [
    {
      category: testCategory,
      id: "place-garden",
      isScheduled: true,
      name: "City Garden",
    },
  ];
  trip.days[0]?.items.push({
    category: testCategory,
    id: "item-garden",
    placeId: "place-garden",
    placeName: "City Garden",
    time: "09:00",
    title: "City Garden",
  });

  return trip;
}

function makeDeps(): TripCommandDeps {
  let idIndex = 0;

  return {
    clock: () => "2026-06-02T08:00:00.000Z",
    idGen: (prefix) => {
      idIndex += 1;
      return `${prefix}-SKILL-${idIndex}`;
    },
  };
}

test("default skill registry exposes only top-level executable skills", () => {
  assert.deepEqual(Array.from(defaultAgentSkillRegistry.keys()), [
    "trip.draft",
    "itinerary.edit",
    "waylog.qa",
  ]);
});

test("itinerary.edit skill builds a standard add_place_to_day proposal", () => {
  const trip = makeTrip();
  const result = runAgentSkill({
    input: {
      action: "add_place_to_day",
      dayId: "day-2",
      place: {
        address: "1850 Huaihai Middle Road",
        name: "Wukang Mansion",
        provider: "amap",
        providerPlaceId: "B00155TEST",
      },
      note: "Optional note should still be preserved",
      recommendationReason: "Good afternoon walk",
      targetIndex: 0,
      time: "15:00",
    },
    skillId: "itinerary.edit",
    trip,
    userMessage: "Add Wukang Mansion to day 2",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.kind, "proposal");
  if (result.data.kind !== "proposal") return;

  assert.equal(result.data.proposal.tripId, trip.id);
  assert.equal(result.data.proposal.expectedUpdatedAt, trip.updatedAt);
  assert.equal(result.data.proposal.operations.length, 1);

  const operation = result.data.proposal.operations[0];
  assert.equal(operation?.type, "add_place_to_day");
  if (operation?.type !== "add_place_to_day") return;
  assert.equal(operation.dayId, "day-2");
  assert.equal(operation.place.name, "Wukang Mansion");
  assert.equal(operation.place.provider, "amap");
  assert.equal(operation.place.providerPlaceId, "B00155TEST");
  assert.equal(operation.place.externalRefs?.amapPoiId, "B00155TEST");
  assert.equal(operation.metadata?.placeResolution?.confidence, "high");
  assert.equal(operation.note, "Optional note should still be preserved");
  assert.equal(operation.recommendationReason, undefined);
  assert.equal(operation.time, "15:00");

  assert.deepEqual(
    result.data.events.map((event) => event.type),
    ["status", "tool_result_summary", "tool_request"],
  );
});

test("itinerary.edit add proposal can be applied by existing proposal executor", () => {
  const trip = makeTrip();
  const skillResult = runAgentSkill({
    input: {
      action: "add_place_to_day",
      dayId: "day-2",
      place: {
        name: "Wukang Mansion",
        provider: "amap",
        providerPlaceId: "B00155TEST",
      },
      time: "15:00",
    },
    skillId: "itinerary.edit",
    trip,
  });

  assert.equal(skillResult.ok, true);
  if (!skillResult.ok || skillResult.data.kind !== "proposal") return;

  const applyResult = applyTripEditProposalCommands(
    {
      proposal: skillResult.data.proposal,
      trip,
    },
    makeDeps(),
  );

  assert.equal(applyResult.ok, true);
  if (!applyResult.ok) return;
  assert.equal(
    applyResult.data.trip.days[1]?.items[0]?.title,
    "Wukang Mansion",
  );
  assert.equal(applyResult.data.trip.days[1]?.items[0]?.time, "15:00");
  assert.equal(
    applyResult.data.trip.days[1]?.items[0]?.recommendationReason,
    undefined,
  );
  assert.equal(applyResult.data.trip.places[0]?.provider, "amap");
  assert.equal(applyResult.data.trip.places[0]?.providerPlaceId, "B00155TEST");
  assert.equal(
    applyResult.data.trip.places[0]?.externalRefs?.amapPoiId,
    "B00155TEST",
  );
  assert.equal(applyResult.data.trip.updatedAt, "2026-06-02T08:00:00.000Z");
  assert.equal(trip.days[1]?.items.length, 0);
});

test("default skill registry exposes itinerary.edit", () => {
  const result = getAgentSkill(defaultAgentSkillRegistry, "itinerary.edit");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.id, "itinerary.edit");
  assert.deepEqual(result.data.allowedInternalActions, [
    "get_trip_context",
    "propose_trip_patch",
  ]);
  assert.deepEqual(result.data.allowedRuntimeTools, ["poi.search"]);
  assert.equal(result.data.output, "proposal");
  assert.deepEqual(result.data.routeMetadata, {
    description:
      "Generate a confirmable edit proposal for an existing Trip itinerary.",
    name: "itinerary.edit",
    requiredContext: ["selectedTrip.full"],
    routeType: "trip_edit",
    tags: ["trip-edit", "add-place", "update-item", "move-item", "remove-item"],
  });
});

test("default skill registry exposes trip.draft as a cloud draft-or-clarification skill", () => {
  const result = getAgentSkill(defaultAgentSkillRegistry, "trip.draft");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.id, "trip.draft");
  assert.deepEqual(result.data.allowedInternalActions, ["propose_create_trip"]);
  assert.deepEqual(result.data.allowedRuntimeTools, ["poi.search"]);
  assert.equal(result.data.execution, "pi_cloud");
  assert.equal(result.data.output, "draft_or_clarification");
  assert.deepEqual(result.data.resultTypes, ["draft", "clarification"]);
  assert.equal(result.data.inputSchema?.type, "object");
  assert.equal(Array.isArray(result.data.outputSchema?.anyOf), true);
  assert.deepEqual(result.data.routeMetadata, {
    description:
      "Generate a confirmable new Trip draft when the user wants to plan a new trip.",
    name: "trip.draft",
    requiredContext: ["turnReference"],
    routeType: "trip_draft",
    tags: ["trip-planning", "new-trip", "draft"],
  });
});

test("trip.draft ContextBuilder contract validates initial and continuation prompts", () => {
  const turnReference = {
    referenceTime: "2026-08-29T08:00:00.000Z",
    timeZone: "Asia/Shanghai",
  };
  const initialPrompt = {
    kind: "waylog_trip_draft_request",
    originalInput: "Plan a 4-day Tokyo trip",
    turnReference,
  };
  const continuationPrompt = {
    kind: "waylog_trip_draft_continuation",
    originalInput: "Plan a Tokyo trip",
    turnReference,
    validatedSemantics: {
      cities: ["Tokyo"],
      companions: [],
      confidence: 0.95,
      dateExpression: null,
      dateResolution: { kind: "none" },
      dayCount: 4,
      destination: "Tokyo",
      missingFields: [],
      preferences: [],
      semanticTitle: "Tokyo in Four Days",
    },
  };
  assert.equal(parseTripDraftSkillInput(initialPrompt).ok, true);
  assert.equal(parseTripDraftSkillInput(continuationPrompt).ok, true);
  assert.equal(
    matchesJsonSchema(initialPrompt, tripDraftSkillInputSchema),
    true,
  );
  assert.equal(
    matchesJsonSchema(continuationPrompt, tripDraftSkillInputSchema),
    true,
  );
  assert.equal(
    parseTripDraftSkillInput({
      originalInput: "Plan a Tokyo trip",
      turnReference,
    }).ok,
    false,
  );
});

test("default skill registry exposes waylog.qa as a read-only answer skill", () => {
  const result = getAgentSkill(defaultAgentSkillRegistry, "waylog.qa");

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.id, "waylog.qa");
  assert.deepEqual(result.data.allowedInternalActions, ["get_trip_context"]);
  assert.deepEqual(result.data.allowedRuntimeTools, [
    "poi.search",
    "weather.get",
    "route.estimate",
    "web.search",
  ]);
  assert.equal(result.data.output, "answer");
  assert.deepEqual(result.data.routeMetadata, {
    description:
      "Answer read-only WayLog, travel planning, POI, and current Trip questions without creating or editing Trips.",
    name: "waylog.qa",
    requiredContext: [],
    routeType: "waylog_qa",
    tags: ["waylog-qa", "read-only", "trip-question", "travel-question"],
  });
});

test("route-visible skill metadata exposes only product-level model skills", () => {
  assert.deepEqual(
    listRouteVisibleAgentSkills(defaultAgentSkillRegistry).map(
      (metadata) => metadata.name,
    ),
    ["trip.draft", "itinerary.edit", "waylog.qa"],
  );
});

test("trip.draft skill refuses to create an unverified local draft", () => {
  const skillResult = runAgentSkill({
    input: {
      userMessage: "帮我规划云南 4 日游",
    },
    skillId: "trip.draft",
    trip: makeTrip(),
    userMessage: "帮我规划云南 4 日游",
  });

  assert.equal(skillResult.ok, false);
  if (skillResult.ok) return;
  assert.equal(skillResult.error.code, "SKILL_TOOL_UNAVAILABLE");
  assert.match(skillResult.error.message, /Pi cloud Skill seam/);
});

test("waylog.qa skill answers read-only Trip questions without proposal output", () => {
  const skillResult = runAgentSkill({
    input: {
      userMessage: "这个行程怎么安排？",
    },
    skillId: "waylog.qa",
    trip: makeTripWithItem(),
    userMessage: "这个行程怎么安排？",
  });

  assert.equal(skillResult.ok, true);
  if (!skillResult.ok) return;
  assert.equal(skillResult.data.kind, "answer");
  if (skillResult.data.kind !== "answer") return;
  assert.match(skillResult.data.answer, /Shanghai 2 Days/);
  assert.match(skillResult.data.answer, /City Garden/);
});

test("itinerary.edit skill can propose extending missing days before adding a place", () => {
  const trip = makeTrip();
  const skillResult = runAgentSkill({
    input: {
      action: "add_place_to_day",
      autoCreateMissingDays: true,
      dayIndex: 5,
      place: {
        category: "教育",
        name: "Yunnan University",
        provider: "amap",
        providerPlaceId: "B0YNU",
      },
    },
    skillId: "itinerary.edit",
    trip,
    userMessage: "Add Yunnan University to day 5",
  });

  assert.equal(skillResult.ok, true);
  if (!skillResult.ok || skillResult.data.kind !== "proposal") return;
  assert.equal(skillResult.data.proposal.operations.length, 2);
  assert.equal(
    skillResult.data.proposal.operations[0]?.type,
    "ensure_trip_day_count",
  );
  assert.equal(
    skillResult.data.proposal.operations[1]?.type,
    "add_place_to_day",
  );
  const addOperation = skillResult.data.proposal.operations[1];
  if (addOperation?.type !== "add_place_to_day") return;
  assert.equal(addOperation.dayId, undefined);
  assert.equal(addOperation.dayIndex, 5);

  const applyResult = applyTripEditProposalCommands(
    {
      proposal: skillResult.data.proposal,
      trip,
    },
    makeDeps(),
  );

  assert.equal(applyResult.ok, true);
  if (!applyResult.ok) return;
  assert.equal(applyResult.data.trip.days.length, 5);
  assert.equal(
    applyResult.data.trip.days[4]?.items[0]?.title,
    "Yunnan University",
  );
});

test("itinerary.edit skill builds and applies update_day_item proposals", () => {
  const trip = makeTripWithItem();
  const skillResult = runAgentSkill({
    input: {
      action: "update_day_item",
      changes: {
        note: "Bring cash",
        recommendationReason: "Should be ignored for direct edits",
        time: "10:30",
        title: "City Garden North Gate",
      },
      dayId: "day-1",
      itemId: "item-garden",
    },
    skillId: "itinerary.edit",
    trip,
  });

  assert.equal(skillResult.ok, true);
  if (!skillResult.ok || skillResult.data.kind !== "proposal") return;
  assert.equal(
    skillResult.data.proposal.operations[0]?.type,
    "update_day_item",
  );
  const operation = skillResult.data.proposal.operations[0];
  if (operation?.type !== "update_day_item") return;
  assert.equal(operation.reason, undefined);
  assert.equal(operation.changes.recommendationReason, undefined);

  const applyResult = applyTripEditProposalCommands(
    {
      proposal: skillResult.data.proposal,
      trip,
    },
    makeDeps(),
  );

  assert.equal(applyResult.ok, true);
  if (!applyResult.ok) return;
  const item = applyResult.data.trip.days[0]?.items[0];
  assert.equal(item?.title, "City Garden North Gate");
  assert.equal(item?.placeName, "City Garden North Gate");
  assert.equal(item?.time, "10:30");
  assert.equal(item?.note, "Bring cash");
  assert.equal(applyResult.data.trip.places[0]?.name, "City Garden North Gate");
});

test("itinerary.edit skill builds and applies move_day_item proposals", () => {
  const trip = makeTripWithItem();
  const skillResult = runAgentSkill({
    input: {
      action: "move_day_item",
      fromDayId: "day-1",
      itemId: "item-garden",
      targetIndex: 0,
      toDayId: "day-2",
    },
    skillId: "itinerary.edit",
    trip,
  });

  assert.equal(skillResult.ok, true);
  if (!skillResult.ok || skillResult.data.kind !== "proposal") return;
  assert.equal(skillResult.data.proposal.operations[0]?.type, "move_day_item");

  const applyResult = applyTripEditProposalCommands(
    {
      proposal: skillResult.data.proposal,
      trip,
    },
    makeDeps(),
  );

  assert.equal(applyResult.ok, true);
  if (!applyResult.ok) return;
  assert.equal(applyResult.data.trip.days[0]?.items.length, 0);
  assert.equal(applyResult.data.trip.days[1]?.items[0]?.id, "item-garden");
});

test("itinerary.edit skill normalizes one-based append move target indexes", () => {
  const trip = makeTripWithItem();
  trip.days[1]?.items.push(
    {
      category: testCategory,
      id: "item-market",
      placeName: "Market",
      title: "Market",
    },
    {
      category: testCategory,
      id: "item-museum",
      placeName: "Museum",
      title: "Museum",
    },
  );

  const skillResult = runAgentSkill({
    input: {
      action: "move_day_item",
      fromDayId: "day-1",
      itemId: "item-garden",
      targetIndex: 3,
      toDayId: "day-2",
    },
    skillId: "itinerary.edit",
    trip,
  });

  assert.equal(skillResult.ok, true);
  if (!skillResult.ok || skillResult.data.kind !== "proposal") return;
  const operation = skillResult.data.proposal.operations[0];
  assert.equal(operation?.type, "move_day_item");
  if (operation?.type !== "move_day_item") return;
  assert.equal(operation.targetIndex, 2);

  const applyResult = applyTripEditProposalCommands(
    {
      proposal: skillResult.data.proposal,
      trip,
    },
    makeDeps(),
  );

  assert.equal(applyResult.ok, true);
  if (!applyResult.ok) return;
  assert.deepEqual(
    applyResult.data.trip.days[1]?.items.map((item) => item.id),
    ["item-market", "item-museum", "item-garden"],
  );
});

test("itinerary.edit skill builds high-risk remove_day_item proposals", () => {
  const trip = makeTripWithItem();
  const skillResult = runAgentSkill({
    input: {
      action: "remove_day_item",
      dayId: "day-1",
      itemId: "item-garden",
    },
    skillId: "itinerary.edit",
    trip,
  });

  assert.equal(skillResult.ok, true);
  if (!skillResult.ok || skillResult.data.kind !== "proposal") return;
  assert.equal(
    skillResult.data.proposal.operations[0]?.type,
    "remove_day_item",
  );

  const preview = createAgentProposalPreview(trip, skillResult.data.proposal);
  assert.equal(preview[0]?.risk, "high");

  const applyResult = applyTripEditProposalCommands(
    {
      proposal: skillResult.data.proposal,
      trip,
    },
    makeDeps(),
  );

  assert.equal(applyResult.ok, true);
  if (!applyResult.ok) return;
  assert.equal(applyResult.data.trip.days[0]?.items.length, 0);
});

test("itinerary.edit skill rejects invalid remove targets", () => {
  const result = runAgentSkill({
    input: {
      action: "remove_day_item",
      dayId: "day-1",
      itemId: "missing-item",
    },
    skillId: "itinerary.edit",
    trip: makeTripWithItem(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_SKILL_INPUT");
});

test("itinerary.edit skill rejects invalid move targets", () => {
  const result = runAgentSkill({
    input: {
      action: "move_day_item",
      fromDayId: "day-1",
      itemId: "item-garden",
      targetIndex: 9,
      toDayId: "day-2",
    },
    skillId: "itinerary.edit",
    trip: makeTripWithItem(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_SKILL_INPUT");
});

test("itinerary.edit skill rejects missing add target day", () => {
  const result = runAgentSkill({
    input: {
      action: "add_place_to_day",
      dayId: "day-not-exist",
      place: {
        name: "Wukang Mansion",
      },
    },
    skillId: "itinerary.edit",
    trip: makeTrip(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_SKILL_INPUT");
});

test("itinerary.edit skill rejects malformed add input", () => {
  const result = runAgentSkill({
    input: {
      action: "add_place_to_day",
      dayId: "day-2",
      place: {},
      targetIndex: -1,
    },
    skillId: "itinerary.edit",
    trip: makeTrip(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "INVALID_SKILL_INPUT");
});

test("runAgentSkill reports skill ids missing from the selected registry", () => {
  const result = runAgentSkill({
    input: {},
    registry: createAgentSkillRegistry([]),
    skillId: "itinerary.edit",
    trip: makeTrip(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.error.code, "SKILL_NOT_FOUND");
});
