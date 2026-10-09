//
//
const { spawnSync } = require("node:child_process");

const rawArgs = process.argv.slice(2);

const compiledTargets =
  rawArgs.length > 0
    ? rawArgs.map((target) =>
        target.endsWith(".ts")
          ? `.tmp-test-dist/${target.replace(/\\/g, "/").replace(/\.ts$/, ".js")}`
          : target,
      )
    : [".tmp-test-dist/tests/**/*.test.js"];

const result = spawnSync(process.execPath, ["--test", ...compiledTargets], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
