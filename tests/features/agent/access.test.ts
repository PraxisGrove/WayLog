import assert from "node:assert/strict";
import test from "node:test";

import { resolveAgentAccessState } from "../../../features/agent";

test("Agent access stays blocked until an authenticated session is ready", () => {
  assert.equal(resolveAgentAccessState(null, true), "loading");
  assert.equal(resolveAgentAccessState(null, false), "signed_out");
  assert.equal(
    resolveAgentAccessState(
      {
        session: {
          accessToken: "user-token",
        },
      },
      false,
    ),
    "ready",
  );
});
