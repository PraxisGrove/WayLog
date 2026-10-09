#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const nodeModules = path.join(projectRoot, "node_modules");
const outputDir = path.join(projectRoot, ".tmp/pi-react-native");
const expectedPiVersion = "0.84.3";
const forbiddenModulePatterns = [
  /(?:^|\/)node_modules\/(?:@anthropic-ai\/sdk|@aws-sdk\/client-bedrock-runtime|@google\/genai|@smithy\/node-http-handler|openai|https?-proxy-agent)(?:\/|$)/,
  /(?:^|\/)@earendil-works\/pi-ai\/(?:dist\/)?providers(?:\/|$)/,
  /node:(?:assert|buffer|child_process|crypto|events|fs|http|https|net|os|path|stream|string_decoder|tls|tty|url|util|worker_threads|zlib)/,
];
const allowedPiCoreSources = [
  "/dist/agent-react-native.js",
  "/dist/agent-loop-react-native.js",
  "/dist/react-native.js",
];
const allowedPiAiSources = [
  "/dist/react-native-polyfills.js",
  "/dist/react-native.js",
  "/dist/utils/event-stream-react-native.js",
  "/dist/utils/validation.js",
];

function parseJson(value, context) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON in ${context}`, { cause: error });
  }
}

function readPackageManifest(packageName) {
  const packagePath = path.join(nodeModules, packageName, "package.json");
  return parseJson(readFileSync(packagePath, "utf8"), packagePath);
}

function verifyInstalledFork() {
  const core = readPackageManifest("@earendil-works/pi-agent-core");
  const ai = readPackageManifest("@earendil-works/pi-ai");
  if (core.version !== expectedPiVersion || ai.version !== expectedPiVersion) {
    throw new Error(
      `Expected Pi ${expectedPiVersion}, found core ${core.version} and ai ${ai.version}`,
    );
  }
  for (const [name, manifest] of [
    ["pi-agent-core", core],
    ["pi-ai", ai],
  ]) {
    if (!manifest.exports?.["./react-native"]) {
      throw new Error(`${name} is missing the patched React Native export`);
    }
  }
  return { piAgentCore: core.version, piAi: ai.version };
}

function run(command, args) {
  process.stdout.write(`[pi-rn] ${path.basename(command)} ${args.join(" ")}\n`);
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`${command} exceeded the 90 second verification limit`));
    }, 90_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(new Error(`${command} could not start`, { cause: error }));
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`${command} failed with exit ${code}\n${output}`));
        return;
      }
      resolve(output);
    });
  });
}

function verifyModuleGraph(platform, sourceMapPath) {
  const sourceMap = parseJson(
    readFileSync(sourceMapPath, "utf8"),
    sourceMapPath,
  );
  const sources = Array.isArray(sourceMap.sources) ? sourceMap.sources : [];
  const forbiddenSources = sources.filter((source) =>
    forbiddenModulePatterns.some((pattern) => pattern.test(source)),
  );
  const unexpectedPiSources = sources.filter((source) => {
    if (source.includes("/@earendil-works/pi-agent-core/")) {
      return !allowedPiCoreSources.some((suffix) => source.endsWith(suffix));
    }
    if (source.includes("/@earendil-works/pi-ai/")) {
      return !allowedPiAiSources.some((suffix) => source.endsWith(suffix));
    }
    return false;
  });
  if (forbiddenSources.length > 0 || unexpectedPiSources.length > 0) {
    throw new Error(
      `${platform} bundle contains forbidden modules:\n${[
        ...forbiddenSources,
        ...unexpectedPiSources,
      ].join("\n")}`,
    );
  }
}

function verifyResult(platform, output) {
  const match = output.match(/^WAYLOG_PI_RN_RESULT=(.+)$/m);
  if (!match) {
    throw new Error(`${platform} Hermes run did not emit a result\n${output}`);
  }
  const result = parseJson(match[1], `${platform} Hermes result`);
  const toolFailureByName = Object.fromEntries(
    result.toolFailure.toolOutcomes.map((item) => [item.toolName, item]),
  );
  const passed =
    result.streamingText.finalText === "一路记" &&
    result.streamingText.updateTypes.join(",") ===
      "text_start,text_delta,text_delta,text_end" &&
    result.loop.agentEnded === true &&
    result.loop.messageUpdates === 2 &&
    result.loop.parallelReadTools === true &&
    result.loop.streamCalls === 2 &&
    result.loop.terminatingToolStoppedLoop === true &&
    result.loop.toolExecutions === 3 &&
    result.loop.toolOutcomes.length === 3 &&
    result.loop.toolOutcomes.every((item) => item.isError === false) &&
    result.loop.toolOutcomes.map((item) => item.toolName).join(",") ===
      "read_a,read_b,finish" &&
    result.cancellation.agentBecameIdle === true &&
    result.cancellation.streamCalls === 2 &&
    result.cancellation.streamObservedAbort === true &&
    result.cancellation.toolObservedAbort === true &&
    result.toolFailure.agentBecameIdle === true &&
    result.toolFailure.modelObservedToolErrors === 2 &&
    result.toolFailure.streamCalls === 2 &&
    result.toolFailure.toolOutcomes.length === 3 &&
    toolFailureByName.throws_read?.isError === true &&
    toolFailureByName.schema_read?.isError === true &&
    toolFailureByName.finish?.isError === false &&
    result.failure.agentBecameIdle === true &&
    result.failure.errorMessage === "prototype stream failure";
  if (!passed) {
    throw new Error(`${platform} Hermes behavior check failed\n${match[1]}`);
  }
  return result;
}

async function measure(operation) {
  const startedAt = performance.now();
  const value = await operation();
  return {
    durationMs: Math.round(performance.now() - startedAt),
    value,
  };
}

async function runPlatform(platform) {
  const bundlePath = path.join(outputDir, `${platform}.js`);
  const bytecodePath = path.join(outputDir, `${platform}.hbc`);
  const sourceMapPath = path.join(outputDir, `${platform}.map`);
  const bundle = await measure(() =>
    run(path.join(nodeModules, ".bin/expo"), [
      "export:embed",
      "--entry-file",
      "scripts/fixtures/pi-agent-core-expo-entry.js",
      "--platform",
      platform,
      "--dev",
      "false",
      "--bundle-output",
      bundlePath,
      "--sourcemap-output",
      sourceMapPath,
      "--assets-dest",
      path.join(outputDir, `${platform}-assets`),
    ]),
  );
  verifyModuleGraph(platform, sourceMapPath);
  const compile = await measure(() =>
    run(path.join(nodeModules, "react-native/sdks/hermesc/osx-bin/hermesc"), [
      "-emit-binary",
      "-out",
      bytecodePath,
      bundlePath,
    ]),
  );
  const execution = await measure(() =>
    run(path.join(nodeModules, "react-native/sdks/hermesc/osx-bin/hermes"), [
      "-b",
      "-Xmicrotask-queue",
      "-time-limit=10000",
      bytecodePath,
    ]),
  );
  return {
    bundleBytes: statSync(bundlePath).size,
    bundleDurationMs: bundle.durationMs,
    bytecodeBytes: statSync(bytecodePath).size,
    compileDurationMs: compile.durationMs,
    executionDurationMs: execution.durationMs,
    result: verifyResult(platform, execution.value),
  };
}

rmSync(outputDir, { force: true, recursive: true });
mkdirSync(outputDir, { recursive: true });
const observedVersions = verifyInstalledFork();
const [android, ios] = await Promise.all([
  runPlatform("android"),
  runPlatform("ios"),
]);
process.stdout.write(
  `${JSON.stringify(
    {
      android,
      ios,
      observedVersions,
      verdict: "react-native-fork-ready-for-native-release-verification",
    },
    null,
    2,
  )}\n`,
);
