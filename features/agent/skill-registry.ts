import type { AgentSkillRouteMetadata } from "./contracts/skill-contract";
import type {
  AgentSkillDefinition,
  AgentSkillId,
  AgentSkillResult,
} from "./skill-types";
import { createAgentSkillError } from "./skill-types";
import { itineraryEditSkill } from "./skills/itinerary-edit";
import { tripDraftSkill } from "./skills/trip-draft";
import { waylogQaSkill } from "./skills/waylog-qa";

export type AgentSkillRegistry = ReadonlyMap<
  AgentSkillId,
  AgentSkillDefinition
>;

export function createAgentSkillRegistry(
  skills: AgentSkillDefinition[] = [
    tripDraftSkill,
    itineraryEditSkill,
    waylogQaSkill,
  ],
): AgentSkillRegistry {
  const registry = new Map<AgentSkillId, AgentSkillDefinition>();

  for (const skill of skills) {
    if (registry.has(skill.id)) {
      throw new Error(`Duplicate Agent skill id: ${skill.id}`);
    }

    registry.set(skill.id, skill);
  }

  return registry;
}

export const defaultAgentSkillRegistry = createAgentSkillRegistry();

export function listRouteVisibleAgentSkills(
  registry: AgentSkillRegistry = defaultAgentSkillRegistry,
): AgentSkillRouteMetadata[] {
  return Array.from(registry.values())
    .map((skill) => skill.routeMetadata)
    .filter(
      (metadata): metadata is AgentSkillRouteMetadata => metadata !== undefined,
    );
}

export function getAgentSkill(
  registry: AgentSkillRegistry,
  skillId: AgentSkillId,
): AgentSkillResult<AgentSkillDefinition> {
  const skill = registry.get(skillId);

  if (!skill) {
    return createAgentSkillError(
      "SKILL_NOT_FOUND",
      `找不到 Agent Skill：${skillId}`,
    );
  }

  return { ok: true, data: skill };
}
