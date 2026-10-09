export type AgentSkillRouteMetadata = {
  description: string;
  name: string;
  requiredContext?: string[];
  routeType: "trip_draft" | "trip_edit" | "waylog_qa";
  tags?: string[];
};

export type AgentSkillContextRequirement = {
  required?: string[];
  optional?: string[];
};

export type AgentSkillContract = {
  contextRequirement?: AgentSkillContextRequirement;
  fullPromptId?: string;
  inputSchema: Record<string, unknown>;
  metadata: AgentSkillRouteMetadata;
  outputSchema: Record<string, unknown>;
  routeType: AgentSkillRouteMetadata["routeType"];
};
