import assert from "node:assert/strict";
import test from "node:test";

import { getEmailOtpSendLabel } from "../../../features/auth";

test("getEmailOtpSendLabel shows send before an OTP request", () => {
  assert.equal(getEmailOtpSendLabel(0), "发送");
});

test("getEmailOtpSendLabel shows countdown after an OTP request", () => {
  assert.equal(getEmailOtpSendLabel(58), "58秒后重发");
});
