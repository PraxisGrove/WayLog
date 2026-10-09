import { useCallback, useState } from "react";

import type { AgentUiEvent } from "@/features/agent";
import type {
  AgentProgressState,
  AgentProgressStepId,
} from "../components/agent-progress-card";

const initialAgentProgressState: AgentProgressState = {
  activeStepId: "resolve_trip",
  isVisible: false,
};

export function useAgentProgressController() {
  const [progressState, setProgressState] = useState<AgentProgressState>(
    initialAgentProgressState,
  );

  const resetAgentProgress = useCallback(() => {
    setProgressState(initialAgentProgressState);
  }, []);

  const handleAgentUiEvent = useCallback((event: AgentUiEvent) => {
    if (event.type === "tool.updated") {
      setProgressState((current) => ({
        ...current,
        activeStepId: "search_place",
        failedStepId: event.status === "failed" ? "search_place" : undefined,
        isVisible: true,
        liveLabel:
          event.status === "running"
            ? `${event.toolName}中`
            : event.status === "completed"
              ? `${event.toolName}已完成`
              : `${event.toolName}失败`,
      }));
      return;
    }

    if (event.stage === "completed") {
      setProgressState((current) => ({ ...current, isVisible: false }));
      return;
    }

    const stageState = {
      preparing: {
        activeStepId: "resolve_trip" as const,
        liveLabel: "正在准备只读问答",
      },
      running_model: {
        activeStepId: "generate_proposal" as const,
        liveLabel: "正在生成回答",
      },
      running_tool: {
        activeStepId: "search_place" as const,
        liveLabel: "正在调用只读工具",
      },
      validating_result: {
        activeStepId: "generate_proposal" as const,
        liveLabel: "正在校验结构化回答",
      },
    }[event.stage];

    setProgressState((current) => ({
      ...current,
      ...stageState,
      failedStepId: undefined,
      isVisible: true,
    }));
  }, []);

  const failAgentProgressAt = useCallback(
    (failedStepId: AgentProgressStepId) => {
      setProgressState((current) => ({
        ...current,
        activeStepId: failedStepId,
        failedStepId,
        isVisible: true,
      }));
    },
    [],
  );

  const hideAgentProgress = useCallback(() => {
    setProgressState((current) => ({
      ...current,
      isVisible: false,
    }));
  }, []);

  return {
    failAgentProgressAt,
    hideAgentProgress,
    handleAgentUiEvent,
    progressState,
    resetAgentProgress,
  };
}
