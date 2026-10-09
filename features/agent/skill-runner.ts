import type { TripCommandDeps } from "../trips/commands";
import type { Trip } from "../trips/types";
import {
  type AgentSkillRegistry,
  defaultAgentSkillRegistry,
  getAgentSkill,
} from "./skill-registry";
import type {
  AgentSkillId,
  AgentSkillResult,
  AgentSkillRunResult,
  AgentSkillStreamEvent,
} from "./skill-types";
import { createAgentSkillError } from "./skill-types";

export type RunAgentSkillInput<TInput = unknown> = {
  appliedOperationIds?: ReadonlySet<string>;
  deps?: TripCommandDeps;
  input: TInput;
  registry?: AgentSkillRegistry;
  skillId: AgentSkillId;
  trip: Trip;
  userMessage?: string;
};

export function runAgentSkill<TInput = unknown>(
  input: RunAgentSkillInput<TInput>,
): AgentSkillResult<AgentSkillRunResult> {
  const registry = input.registry ?? defaultAgentSkillRegistry;
  const skillResult = getAgentSkill(registry, input.skillId);

  if (!skillResult.ok) {
    return skillResult;
  }
  if (skillResult.data.execution === "pi_cloud") {
    return createAgentSkillError(
      "SKILL_TOOL_UNAVAILABLE",
      `${input.skillId} 只能通过 Pi cloud Skill seam 执行。`,
    );
  }

  const events: AgentSkillStreamEvent[] = [];
  const emit = (event: AgentSkillStreamEvent) => {
    events.push(event);
  };
  const result = skillResult.data.run(input.input, {
    deps: input.deps,
    emit,
    trip: input.trip,
    userMessage: input.userMessage,
  });

  if (!result.ok) {
    return {
      ...result,
      events: [...events, ...result.events],
    };
  }

  return {
    ok: true,
    data: {
      ...result.data,
      events: [...events, ...result.data.events],
    },
  };
}
