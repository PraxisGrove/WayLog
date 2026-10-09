import assert from "node:assert/strict";
import test from "node:test";

import { createClarificationFeedback } from "../../../shared/agent/clarification-feedback";

test("clarification feedback rate-limits selection and keeps confirmation distinct", async () => {
  let now = 100;
  const haptics: string[] = [];
  let soundCalls = 0;
  const feedback = createClarificationFeedback({
    haptic: (kind) => haptics.push(kind),
    now: () => now,
    playTick: async () => {
      soundCalls += 1;
      throw new Error("audio unavailable");
    },
    selectionIntervalMs: 80,
  });

  feedback.selection();
  now = 120;
  feedback.selection();
  now = 200;
  feedback.selection();
  feedback.confirm();
  await Promise.resolve();

  assert.deepEqual(haptics, ["selection", "selection", "success"]);
  assert.equal(soundCalls, 2);
});
