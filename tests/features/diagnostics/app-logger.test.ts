import assert from "node:assert/strict";
import test from "node:test";

import {
  appendDiagnosticEntry,
  extractError,
  formatDiagnosticBundleText,
  sanitizeContext,
  type DiagnosticLogEntry,
} from "../../../features/diagnostics/diagnostic-core";

test("diagnostic context sanitizes nested secret fields", () => {
  assert.deepEqual(
    sanitizeContext({
      authorization: "Bearer secret-token",
      nested: {
        password: "hidden",
        placeId: "poi-1",
      },
    }),
    {
      authorization: "[redacted]",
      nested: {
        password: "[redacted]",
        placeId: "poi-1",
      },
    },
  );
});

test("diagnostic ring buffer is capped to the latest entries", () => {
  let entries: DiagnosticLogEntry[] = [];

  for (let index = 0; index < 90; index += 1) {
    entries = appendDiagnosticEntry(
      entries,
      {
        context: sanitizeContext({ index }),
        event: "event",
        level: "info",
        message: `message-${index}`,
        scope: "diagnostics-test",
        timestamp: "2026-07-02T00:00:00.000Z",
      },
      80,
    );
  }

  assert.equal(entries.length, 80);
  assert.equal(entries[0]?.message, "message-10");
  assert.equal(entries.at(-1)?.message, "message-89");
});

test("diagnostic bundle text includes metadata and recent events", () => {
  const text = formatDiagnosticBundleText({
    appVersion: "2026.07.02",
    entries: [
      {
        context: sanitizeContext({ tripId: "trip-1" }),
        event: "trip.save.failed",
        level: "error",
        message: "Trip save failed",
        scope: "diagnostics-test",
        timestamp: "2026-07-02T00:00:00.000Z",
      },
    ],
    environment: "test",
    generatedAt: "2026-07-02T00:00:00.000Z",
    platform: "node",
    release: "waylog@2026.07.02",
  });

  assert.match(text, /WayLog diagnostic context/);
  assert.match(text, /trip\.save\.failed/);
  assert.match(text, /Trip save failed/);
  assert.match(text, /trip-1/);
});

test("diagnostic core extracts original errors from nested context", () => {
  const error = new Error("Original stack");

  assert.equal(extractError({ nested: { error } }), error);
});
