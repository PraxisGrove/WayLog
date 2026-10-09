import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("Agent cutover removes every legacy semantic entry point", () => {
  for (const path of [
    "features/agent/agent-turn-client.ts",
    "features/agent/agent-turn-stream-client.ts",
    "features/agent/intent-parser.ts",
    "features/agent/local-route-selector.ts",
    "features/agent/runtime-tool-router.ts",
    "supabase/functions/agent-turn/index.ts",
  ]) {
    assert.equal(existsSync(path), false, `${path} must be removed`);
  }

  const supabaseConfig = readFileSync("supabase/config.toml", "utf8");
  assert.equal(/\[functions\.agent-turn\]/u.test(supabaseConfig), false);

  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts?: Record<string, string>;
  };
  assert.equal(packageJson.scripts?.["agent:turn"], undefined);
});
