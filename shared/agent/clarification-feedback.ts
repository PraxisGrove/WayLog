export type ClarificationHapticKind = "selection" | "success";

export type ClarificationFeedback = {
  confirm: () => void;
  selection: () => void;
};

export function createClarificationFeedback(input: {
  haptic: (kind: ClarificationHapticKind) => void;
  now?: () => number;
  playTick?: () => Promise<void> | void;
  selectionIntervalMs?: number;
}): ClarificationFeedback {
  const now = input.now ?? Date.now;
  const selectionIntervalMs = Math.max(40, input.selectionIntervalMs ?? 90);
  let lastSelectionAt = Number.NEGATIVE_INFINITY;

  return {
    confirm: () => {
      input.haptic("success");
    },
    selection: () => {
      const selectedAt = now();
      if (selectedAt - lastSelectionAt < selectionIntervalMs) return;
      lastSelectionAt = selectedAt;
      input.haptic("selection");
      try {
        void Promise.resolve(input.playTick?.()).catch(() => {});
      } catch {
        // 可选声音反馈不可用时不影响结构化澄清提交。
      }
    },
  };
}
