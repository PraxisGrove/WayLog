import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function runCli(args: string[]) {
  const result = spawnSync(
    "node",
    ["scripts/agent-ui-regression.js", ...args],
    {
      encoding: "utf8",
      timeout: 5000,
    },
  );
  assert.equal(result.error, undefined);
  return result;
}

test("automatic UI regression requires an explicit test trip and both date labels", () => {
  const result = runCli(["--run"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--trip-id/);
  assert.match(result.stderr, /--trip-title/);
  assert.match(result.stderr, /--day6-date/);
  assert.match(result.stderr, /--day7-date/);
});

test("automatic UI regression refuses each missing test target argument", () => {
  const targetOptions = [
    ["--trip-id", "test-trip"],
    ["--trip-title", "测试行程"],
    ["--day6-date", "第六天日期标签"],
    ["--day7-date", "第七天日期标签"],
  ];

  for (const [missingFlag] of targetOptions) {
    const args = targetOptions.filter(([flag]) => flag !== missingFlag).flat();
    const result = runCli(["--run", ...args]);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(missingFlag));
  }
});

test("checklist and help remain available without a test trip", () => {
  for (const args of [[], ["--checklist"], ["--help"], ["--run", "--help"]]) {
    const result = runCli(args);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Agent UI 回归/);
    assert.equal(/trip-\d{13}/.test(result.stdout), false);
  }
});
