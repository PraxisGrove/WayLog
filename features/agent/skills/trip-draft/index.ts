/**
 * @file Trip draft Skill (trip.draft).
 *
 * Trip drafts execute through the independent Pi cloud Skill seam so every POI
 * can be verified before the client receives a preview-only draft.
 */

import type { AgentSkillDefinition } from "../../skill-types";
import {
  tripDraftSkillInputSchema,
  tripDraftSkillOutputSchema,
} from "./schema";

export const tripDraftSkill: AgentSkillDefinition<unknown> = {
  allowedInternalActions: ["propose_create_trip"],
  allowedRuntimeTools: ["poi.search"],
  allowedTools: ["search_places", "propose_create_trip"],
  description:
    "根据用户的目的地、天数、日期或偏好生成一个新的可确认 Trip 草案。Skill 只输出草案，不直接创建 Trip。",
  execution: "pi_cloud",
  id: "trip.draft",
  inputSchema: tripDraftSkillInputSchema,
  maxToolCalls: 8,
  output: "draft_or_clarification",
  outputSchema: tripDraftSkillOutputSchema,
  resultTypes: ["draft", "clarification"],
  routeMetadata: {
    description:
      "Generate a confirmable new Trip draft when the user wants to plan a new trip.",
    name: "trip.draft",
    requiredContext: ["turnReference"],
    routeType: "trip_draft",
    tags: ["trip-planning", "new-trip", "draft"],
  },
  risk: "low",
  triggerExamples: [
    "帮我规划云南 4 日游",
    "plan a 5 day Tokyo trip",
    "下周给我做一份成都三日游草案",
  ],
};

export {
  parseTripDraftSkillInput,
  tripDraftSkillInputSchema,
  tripDraftSkillOutputSchema,
  tripDraftTerminatingToolParameters,
} from "./schema";
