import assert from "node:assert/strict";
import test from "node:test";

import {
  isAmapJsonSuccessPayload,
  parseAmapJsonResponse,
  shouldFallbackToBackupKey,
} from "../../../features/trips/amap-failover";

test("isAmapJsonSuccessPayload treats v3 success payloads as success", () => {
  assert.equal(
    isAmapJsonSuccessPayload(JSON.stringify({ status: "1", info: "OK" })),
    true,
  );
});

test("isAmapJsonSuccessPayload treats v4 success payloads as success", () => {
  assert.equal(
    isAmapJsonSuccessPayload(JSON.stringify({ errcode: 0, errmsg: "OK" })),
    true,
  );
});

test("isAmapJsonSuccessPayload treats business errors as failure", () => {
  assert.equal(
    isAmapJsonSuccessPayload(
      JSON.stringify({
        status: "0",
        info: "INVALID_USER_KEY",
        infocode: "10001",
      }),
    ),
    false,
  );
});

test("parseAmapJsonResponse returns undefined for invalid JSON", () => {
  assert.equal(parseAmapJsonResponse("not-json"), undefined);
});

test("shouldFallbackToBackupKey falls back on network errors when backup exists", () => {
  assert.equal(
    shouldFallbackToBackupKey({
      error: new Error("socket hang up"),
      hasMoreKeys: true,
    }),
    true,
  );
});

test("shouldFallbackToBackupKey falls back on non-success payloads when backup exists", () => {
  assert.equal(
    shouldFallbackToBackupKey({
      hasMoreKeys: true,
      payload: JSON.stringify({
        status: "0",
        info: "INVALID_USER_KEY",
        infocode: "10001",
      }),
    }),
    true,
  );
});

test("shouldFallbackToBackupKey does not fall back on success payloads", () => {
  assert.equal(
    shouldFallbackToBackupKey({
      hasMoreKeys: true,
      payload: JSON.stringify({ status: "1", info: "OK" }),
    }),
    false,
  );
});

test("shouldFallbackToBackupKey does not fall back when no backup key remains", () => {
  assert.equal(
    shouldFallbackToBackupKey({
      hasMoreKeys: false,
      payload: JSON.stringify({
        status: "0",
        info: "INVALID_USER_KEY",
        infocode: "10001",
      }),
    }),
    false,
  );
});
