import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAgentRuntimeAvailability,
  parseAgentRuntimeConfig,
  resolveAgentRuntimeModel,
} from "../../../supabase/functions/agent-llm-proxy/operational-controls";

const rawConfig = {
  allowedModelProfiles: ["router", "balanced"],
  configVersion: 7,
  dailyLimit: 40,
  disabledSkillIds: ["trip.draft"],
  enabled: true,
  minimumAppVersion: "2026.08.30-0100",
  minuteLimit: 4,
  modelProfiles: {
    balanced: "deepseek-v4-pro",
    router: "deepseek-v4-flash",
  },
  protocolVersion: 1,
  telemetryEnabled: true,
};

test("remote Agent config accepts only bounded operational controls", () => {
  const parsed = parseAgentRuntimeConfig(rawConfig);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data, rawConfig);

  assert.equal(
    parseAgentRuntimeConfig({ ...rawConfig, allowedModelProfiles: ["root"] })
      .ok,
    false,
  );
  assert.equal(
    parseAgentRuntimeConfig({ ...rawConfig, dailyLimit: 0 }).ok,
    false,
  );
});

test("remote controls return truthful unavailable reasons", () => {
  const parsed = parseAgentRuntimeConfig(rawConfig);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.deepEqual(
    evaluateAgentRuntimeAvailability(parsed.data, {
      appVersion: "2026.08.30-0200",
      modelProfile: "balanced",
      protocolVersion: 1,
      skillId: "trip.draft",
    }),
    {
      available: false,
      code: "skill_disabled",
      message: "这项旅行助手能力暂时停用。",
      retryable: false,
    },
  );

  assert.equal(
    evaluateAgentRuntimeAvailability(
      { ...parsed.data, disabledSkillIds: [] },
      {
        appVersion: "2026.08.29-9999",
        modelProfile: "balanced",
        protocolVersion: 1,
        skillId: "waylog.qa",
      },
    ).code,
    "app_version_unsupported",
  );
  assert.equal(
    evaluateAgentRuntimeAvailability(
      { ...parsed.data, disabledSkillIds: [] },
      {
        appVersion: "2026.08.30-0200",
        modelProfile: "balanced",
        protocolVersion: 2,
        skillId: "waylog.qa",
      },
    ).code,
    "protocol_unsupported",
  );
  assert.equal(
    evaluateAgentRuntimeAvailability(
      { ...parsed.data, disabledSkillIds: [] },
      {
        appVersion: "2026.08.30-0200",
        modelProfile: "quality",
        protocolVersion: 1,
        skillId: "waylog.qa",
      },
    ).code,
    "model_profile_disabled",
  );
  assert.equal(
    evaluateAgentRuntimeAvailability(
      { ...parsed.data, disabledSkillIds: [], enabled: false },
      {
        appVersion: "2026.08.30-0200",
        modelProfile: "balanced",
        protocolVersion: 1,
        skillId: "waylog.qa",
      },
    ).code,
    "runtime_disabled",
  );
});

test("remote model profile selects a model without changing the requested profile", () => {
  const parsed = parseAgentRuntimeConfig(rawConfig);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  assert.equal(
    resolveAgentRuntimeModel(parsed.data, "balanced"),
    "deepseek-v4-pro",
  );
  assert.equal(
    resolveAgentRuntimeModel({ ...parsed.data, modelProfiles: {} }, "balanced"),
    undefined,
  );
  assert.equal(
    parseAgentRuntimeConfig({ ...rawConfig, modelProfiles: {} }).ok,
    false,
  );
});
