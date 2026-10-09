/// <reference path="./pi-agent-core-expo-entry.d.ts" />
// Release compatibility fixture for the installed WayLog Pi React Native fork.
import {
  AbortController as AbortControllerPolyfill,
  AbortSignal as AbortSignalPolyfill,
} from "abort-controller/dist/abort-controller";
// @ts-expect-error The React Native URL polyfill package ships no declarations.
import { URL as UrlPolyfill } from "whatwg-url-without-unicode";
import { EventStream } from "@earendil-works/pi-ai/react-native";
import { createWayLogPiAgent } from "../../features/agent/pi-runtime";

// React Native initializes AbortController; the standalone Hermes runner does not.
globalThis.AbortController ??= AbortControllerPolyfill;
globalThis.AbortSignal ??= AbortSignalPolyfill;
globalThis.URL ??= UrlPolyfill;

const EMPTY_USAGE = {
  cacheRead: 0,
  cacheWrite: 0,
  cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0, total: 0 },
  input: 0,
  output: 0,
  totalTokens: 0,
};

function assistantMessage(content, stopReason = "toolUse", errorMessage) {
  return {
    api: "waylog-prototype",
    content,
    errorMessage,
    model: "controlled-stream",
    provider: "waylog",
    stopReason,
    timestamp: Date.now(),
    usage: EMPTY_USAGE,
  };
}

function completedStream(message, updateType = "toolcall_end") {
  const stream = new EventStream(
    (event) => event.type === "done" || event.type === "error",
    (event) => (event.type === "done" ? event.message : event.error),
  );
  const partial = assistantMessage([], message.stopReason);

  stream.push({ partial, type: "start" });
  stream.push({ partial: message, type: updateType });
  stream.push({ message, type: "done" });

  return stream;
}

function streamingTextStream(textParts) {
  const stream = new EventStream(
    (event) => event.type === "done" || event.type === "error",
    (event) => (event.type === "done" ? event.message : event.error),
  );
  let text = "";
  let partial = assistantMessage([{ text, type: "text" }], "pending");

  stream.push({ partial, type: "start" });
  stream.push({ contentIndex: 0, partial, type: "text_start" });
  for (const delta of textParts) {
    text += delta;
    partial = assistantMessage([{ text, type: "text" }], "pending");
    stream.push({ contentIndex: 0, delta, partial, type: "text_delta" });
  }
  const message = assistantMessage([{ text, type: "text" }], "stop");
  stream.push({
    content: text,
    contentIndex: 0,
    partial: message,
    type: "text_end",
  });
  stream.push({ message, type: "done" });
  return stream;
}

async function runStreamingTextScenario() {
  const updateTypes = [];
  const agent = await createWayLogPiAgent({
    streamFn: () => streamingTextStream(["一路", "记"]),
  });
  agent.subscribe((event) => {
    if (event.type === "message_update") {
      updateTypes.push(event.assistantMessageEvent.type);
    }
  });

  await agent.prompt("stream a controlled answer");
  const finalMessage = agent.state.messages.at(-1);
  return {
    finalText: finalMessage?.content?.[0]?.text,
    updateTypes,
  };
}

function createReadTool(name, parallelState) {
  return {
    description: `Controlled read-only tool ${name}`,
    execute: async (_toolCallId, params) => {
      parallelState.active += 1;
      parallelState.maxActive = Math.max(
        parallelState.maxActive,
        parallelState.active,
      );
      await Promise.resolve();
      parallelState.active -= 1;
      return {
        content: [{ text: `${name}:${params.value}`, type: "text" }],
        details: { name, value: params.value },
      };
    },
    label: name,
    name,
    parameters: {
      additionalProperties: false,
      properties: { value: { type: "string" } },
      required: ["value"],
      type: "object",
    },
  };
}

function createFinishTool() {
  return {
    description: "Return the bounded structured result",
    execute: async (_toolCallId, params) => ({
      content: [{ text: params.result, type: "text" }],
      details: { result: params.result },
      terminate: true,
    }),
    label: "finish",
    name: "finish",
    parameters: {
      additionalProperties: false,
      properties: { result: { type: "string" } },
      required: ["result"],
      type: "object",
    },
  };
}

async function runLoopScenario() {
  const parallelState = { active: 0, maxActive: 0 };
  const events = [];
  const toolOutcomes = [];
  let streamCalls = 0;
  const streamFn = async () => {
    streamCalls += 1;
    printPrototypeLine(`WAYLOG_PI_RN_STAGE=stream:${streamCalls}`);
    if (streamCalls > 2) {
      throw new Error("prototype loop exceeded two controlled model calls");
    }
    if (streamCalls === 1) {
      return completedStream(
        assistantMessage([
          {
            arguments: { value: "alpha" },
            id: "read-a",
            name: "read_a",
            type: "toolCall",
          },
          {
            arguments: { value: "beta" },
            id: "read-b",
            name: "read_b",
            type: "toolCall",
          },
        ]),
      );
    }
    return completedStream(
      assistantMessage([
        {
          arguments: { result: "route-selected" },
          id: "finish-1",
          name: "finish",
          type: "toolCall",
        },
      ]),
    );
  };
  const agent = await createWayLogPiAgent({
    initialState: {
      tools: [
        createReadTool("read_a", parallelState),
        createReadTool("read_b", parallelState),
        createFinishTool(),
      ],
    },
    streamFn,
  });
  agent.subscribe((event) => {
    events.push(event.type);
    if (event.type === "tool_execution_end") {
      toolOutcomes.push({
        isError: event.isError,
        result: event.result,
        toolName: event.toolName,
      });
    }
  });

  await agent.prompt("run the compatibility prototype");

  return {
    agentEnded: events.at(-1) === "agent_end",
    messageUpdates: events.filter((type) => type === "message_update").length,
    parallelReadTools: parallelState.maxActive === 2,
    streamCalls,
    terminatingToolStoppedLoop: streamCalls === 2,
    toolExecutions: events.filter((type) => type === "tool_execution_start")
      .length,
    toolOutcomes,
  };
}

async function runCancellationScenario() {
  let resolveToolStarted;
  let streamCalls = 0;
  let streamObservedAbort = false;
  let toolObservedAbort = false;
  const toolStarted = new Promise((resolve) => {
    resolveToolStarted = resolve;
  });
  const streamFn = async (_model, _context, options) => {
    streamCalls += 1;
    if (streamCalls === 1) {
      return completedStream(
        assistantMessage([
          {
            arguments: {},
            id: "slow-read-1",
            name: "slow_read",
            type: "toolCall",
          },
        ]),
      );
    }
    const stream = new EventStream(
      (event) => event.type === "error",
      (event) => event.error,
    );
    const abort = () => {
      streamObservedAbort = true;
      stream.push({
        error: assistantMessage([], "aborted", "prototype cancelled"),
        type: "error",
      });
    };
    if (options.signal?.aborted) {
      abort();
    } else {
      options.signal?.addEventListener("abort", abort, { once: true });
    }
    return stream;
  };
  const slowReadTool = {
    description: "Controlled read tool that waits for cancellation",
    execute: async (_toolCallId, _params, signal) => {
      resolveToolStarted();
      await new Promise((_resolve, reject) => {
        const abort = () => {
          toolObservedAbort = true;
          reject(new Error("prototype tool cancelled"));
        };
        if (signal?.aborted) {
          abort();
        } else {
          signal?.addEventListener("abort", abort, { once: true });
        }
      });
      return { content: [], details: {} };
    },
    label: "slow_read",
    name: "slow_read",
    parameters: {
      additionalProperties: false,
      properties: {},
      type: "object",
    },
  };
  const agent = await createWayLogPiAgent({
    initialState: { tools: [slowReadTool] },
    streamFn,
  });
  const pending = agent.prompt("cancel an in-flight read tool");
  await toolStarted;
  agent.abort();
  await pending;

  return {
    agentBecameIdle: agent.state.isStreaming === false,
    streamCalls,
    streamObservedAbort,
    toolObservedAbort,
  };
}

async function runToolFailureScenario() {
  const toolOutcomes = [];
  let modelObservedToolErrors = 0;
  let streamCalls = 0;
  const streamFn = async (_model, context) => {
    streamCalls += 1;
    if (streamCalls === 1) {
      return completedStream(
        assistantMessage([
          {
            arguments: {},
            id: "throws-read-1",
            name: "throws_read",
            type: "toolCall",
          },
          {
            arguments: {},
            id: "schema-read-1",
            name: "schema_read",
            type: "toolCall",
          },
        ]),
      );
    }
    modelObservedToolErrors = context.messages.filter(
      (message) => message.role === "toolResult" && message.isError === true,
    ).length;
    return completedStream(
      assistantMessage([
        {
          arguments: { result: "errors-observed" },
          id: "finish-errors",
          name: "finish",
          type: "toolCall",
        },
      ]),
    );
  };
  const agent = await createWayLogPiAgent({
    initialState: {
      tools: [
        {
          description: "Controlled failing read tool",
          execute: async () => {
            throw new Error("prototype tool failure");
          },
          label: "throws_read",
          name: "throws_read",
          parameters: { properties: {}, type: "object" },
        },
        {
          description: "Controlled schema rejection",
          execute: async () => ({ content: [], details: {} }),
          label: "schema_read",
          name: "schema_read",
          parameters: {
            additionalProperties: false,
            properties: { value: { type: "string" } },
            required: ["value"],
            type: "object",
          },
        },
        createFinishTool(),
      ],
    },
    streamFn,
  });
  agent.subscribe((event) => {
    if (event.type === "tool_execution_end") {
      toolOutcomes.push({ isError: event.isError, toolName: event.toolName });
    }
  });
  await agent.prompt("propagate controlled tool failures");
  return {
    agentBecameIdle: agent.state.isStreaming === false,
    modelObservedToolErrors,
    streamCalls,
    toolOutcomes,
  };
}

async function runFailureScenario() {
  const agent = await createWayLogPiAgent({
    streamFn: async () => {
      throw new Error("prototype stream failure");
    },
  });
  await agent.prompt("propagate the controlled failure");
  return {
    agentBecameIdle: agent.state.isStreaming === false,
    errorMessage: agent.state.errorMessage,
  };
}

function printPrototypeLine(line) {
  if (typeof globalThis.print === "function") {
    globalThis.print(line);
    return;
  }
  console.info(line);
}

async function main() {
  printPrototypeLine("WAYLOG_PI_RN_STAGE=loop:start");
  const streamingText = await runStreamingTextScenario();
  printPrototypeLine(
    `WAYLOG_PI_RN_STAGE=streaming-text:end:${JSON.stringify(streamingText)}`,
  );
  const loop = await runLoopScenario();
  printPrototypeLine(`WAYLOG_PI_RN_STAGE=loop:end:${JSON.stringify(loop)}`);
  const failure = await runFailureScenario();
  printPrototypeLine(
    `WAYLOG_PI_RN_STAGE=failure:end:${JSON.stringify(failure)}`,
  );
  const toolFailure = await runToolFailureScenario();
  printPrototypeLine(
    `WAYLOG_PI_RN_STAGE=tool-failure:end:${JSON.stringify(toolFailure)}`,
  );
  const cancellation = await runCancellationScenario();
  printPrototypeLine(
    `WAYLOG_PI_RN_STAGE=cancellation:end:${JSON.stringify(cancellation)}`,
  );
  const result = {
    cancellation,
    failure,
    loop,
    streamingText,
    toolFailure,
  };
  const serialized = JSON.stringify(result);
  globalThis.__WAYLOG_PI_RN_PROTOTYPE_RESULT__ = result;
  printPrototypeLine(`WAYLOG_PI_RN_RESULT=${serialized}`);
}

void main().catch((error) => {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  globalThis.__WAYLOG_PI_RN_PROTOTYPE_ERROR__ = message;
  printPrototypeLine(`WAYLOG_PI_RN_ERROR=${message}`);
});
