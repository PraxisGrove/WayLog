import assert from "node:assert/strict";
import test from "node:test";

import {
  type FeedbackPayload,
  feedbackContactMethodOptions,
  submitFeedback,
} from "../../features/settings/feedback";

test("feedback contact method options are qq, 邮箱, and 手机号", () => {
  assert.deepEqual([...feedbackContactMethodOptions], ["qq", "邮箱", "手机号"]);
});

test("FeedbackPayload type accepts valid contact methods", () => {
  const payloads: FeedbackPayload[] = [
    { contactMethod: "qq", contactValue: "12345", description: "问题描述" },
    {
      contactMethod: "邮箱",
      contactValue: "test@example.com",
      description: "问题描述",
    },
    {
      contactMethod: "手机号",
      contactValue: "13800138000",
      description: "问题描述",
    },
    { contactMethod: null, contactValue: "", description: "问题描述" },
  ];

  assert.equal(payloads.length, 4);
  assert.equal(payloads[0].contactMethod, "qq");
  assert.equal(payloads[3].contactMethod, null);
});

test("submitFeedback rejects empty description", async () => {
  const payload: FeedbackPayload = {
    contactMethod: null,
    contactValue: "",
    description: "",
  };

  const result = await submitFeedback(payload);

  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(result.reason, "server");
    assert.ok(result.message.length > 0);
  }
});

test("submitFeedback returns structured result for valid payload", async () => {
  const payload: FeedbackPayload = {
    contactMethod: "qq",
    contactValue: "123456",
    description: "集成测试提交",
  };

  const result = await submitFeedback(payload);

  if (result.ok) {
    assert.equal(result.ok, true);
  } else {
    assert.equal(typeof result.reason, "string");
    assert.ok(result.reason.length > 0);
    assert.equal(typeof result.message, "string");
  }
});
