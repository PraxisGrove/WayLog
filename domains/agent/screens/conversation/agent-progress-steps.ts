export type AgentProgressStepId =
  | "resolve_trip"
  | "search_place"
  | "generate_proposal"
  | "await_confirmation";

export type AgentProgressState = {
  activeStepId: AgentProgressStepId;
  failedStepId?: AgentProgressStepId;
  isVisible: boolean;
  liveLabel?: string;
};

export type AgentProgressStep = {
  description: string;
  id: AgentProgressStepId;
  label: string;
};

export const defaultAgentProgressSteps: AgentProgressStep[] = [
  {
    description: "匹配你要操作的旅行",
    id: "resolve_trip",
    label: "正在识别行程",
  },
  {
    description: "必要时查询真实地点",
    id: "search_place",
    label: "搜索地点",
  },
  {
    description: "生成只读提案和影响预览",
    id: "generate_proposal",
    label: "生成提案",
  },
  {
    description: "等待你选择或确认",
    id: "await_confirmation",
    label: "等待确认",
  },
];

export function getAgentProgressStepIndex(stepId: AgentProgressStepId): number {
  return defaultAgentProgressSteps.findIndex((step) => step.id === stepId);
}
