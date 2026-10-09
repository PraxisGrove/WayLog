import assert from "node:assert/strict";
import test from "node:test";

import { createWayLogPiAgent } from "../../../features/agent/pi-runtime";

test("React Native fork keeps the upstream Node root behavior", async () => {
  const { Agent } = await import("@earendil-works/pi-agent-core");

  assert.throws(
    () => new Agent({} as never),
    /No default stream function configured/,
  );
});

test("createWayLogPiAgent requires the WayLog stream adapter", async () => {
  await assert.rejects(
    () => createWayLogPiAgent({} as never),
    /requires an injected streamFn/,
  );
});

test("createWayLogPiAgent starts without model-visible tools", async () => {
  const agent = await createWayLogPiAgent({
    streamFn: () => {
      throw new Error("test stream should not run");
    },
  });

  assert.deepEqual(agent.state.tools, []);
});
