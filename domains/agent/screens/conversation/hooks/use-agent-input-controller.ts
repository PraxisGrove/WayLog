import { useCallback, useMemo, useState } from "react";

import { triggerHaptic } from "@/shared/ui/haptic-feedback";
import type { AgentExecutionMode } from "../agent-conversation.types";
import { getAgentExecutionModeLabel } from "../agent-conversation-formatters";

export function useAgentInputController({ isSending }: { isSending: boolean }) {
  const [draft, setDraft] = useState("");
  const [executionMode, setExecutionMode] =
    useState<AgentExecutionMode>("confirm");
  const executionModeLabel = useMemo(
    () => getAgentExecutionModeLabel(executionMode),
    [executionMode],
  );

  const resetDraft = useCallback(() => {
    setDraft("");
  }, []);

  const toggleExecutionMode = useCallback(
    (nextAuto: boolean) => {
      if (isSending) {
        return;
      }

      setExecutionMode(nextAuto ? "auto" : "confirm");
      triggerHaptic("selection");
    },
    [isSending],
  );

  return {
    draft,
    executionMode,
    executionModeLabel,
    resetDraft,
    setDraft,
    toggleExecutionMode,
  };
}
