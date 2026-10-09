import "./pi-agent-core-expo-entry";

import { registerRootComponent } from "expo";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

function isPassingResult(result) {
  if (!result) return false;
  const failures = Object.fromEntries(
    result.toolFailure.toolOutcomes.map((item) => [item.toolName, item]),
  );
  return (
    result.streamingText.finalText === "一路记" &&
    result.streamingText.updateTypes.join(",") ===
      "text_start,text_delta,text_delta,text_end" &&
    result.loop.agentEnded === true &&
    result.loop.parallelReadTools === true &&
    result.loop.streamCalls === 2 &&
    result.loop.terminatingToolStoppedLoop === true &&
    result.loop.toolExecutions === 3 &&
    result.loop.toolOutcomes.every((item) => item.isError === false) &&
    result.cancellation.agentBecameIdle === true &&
    result.cancellation.streamObservedAbort === true &&
    result.cancellation.toolObservedAbort === true &&
    result.toolFailure.modelObservedToolErrors === 2 &&
    failures.throws_read?.isError === true &&
    failures.schema_read?.isError === true &&
    failures.finish?.isError === false &&
    result.failure.agentBecameIdle === true &&
    result.failure.errorMessage === "prototype stream failure"
  );
}

function PiReactNativeCompatibilityApp() {
  const [status, setStatus] = useState("WAYLOG_PI_RN_NATIVE_RUNNING");

  useEffect(() => {
    const interval = setInterval(() => {
      if (globalThis.__WAYLOG_PI_RN_PROTOTYPE_ERROR__) {
        setStatus(
          `WAYLOG_PI_RN_NATIVE_FAIL:${globalThis.__WAYLOG_PI_RN_PROTOTYPE_ERROR__}`,
        );
        clearInterval(interval);
        return;
      }
      const result = globalThis.__WAYLOG_PI_RN_PROTOTYPE_RESULT__;
      if (result) {
        setStatus(
          isPassingResult(result)
            ? "WAYLOG_PI_RN_NATIVE_PASS"
            : "WAYLOG_PI_RN_NATIVE_FAIL:oracle",
        );
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
  },
});

registerRootComponent(PiReactNativeCompatibilityApp);
