import { useCallback, useState } from "react";

export function useAgentHistoryDrawerController({
  isDisabled,
}: {
  isDisabled: boolean;
}) {
  const [isHistoryVisible, setHistoryVisible] = useState(false);

  const openHistoryDrawer = useCallback(() => {
    if (!isDisabled) {
      setHistoryVisible(true);
    }
  }, [isDisabled]);

  const closeHistoryDrawer = useCallback(() => {
    setHistoryVisible(false);
  }, []);

  return {
    closeHistoryDrawer,
    isHistoryVisible,
    openHistoryDrawer,
  };
}
