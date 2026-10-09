import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const emailOtpTemplatePath = join(
  process.cwd?.() ?? ".",
  "supabase/templates/email-otp.html",
);
const emailSignupTemplatePath = join(
  process.cwd?.() ?? ".",
  "supabase/templates/email-signup.html",
);
test("email OTP template sends a code instead of a confirmation link", () => {
  const template = readFileSync(emailOtpTemplatePath, "utf8");

  assert.ok(template.includes("{{ .Token }}"));
  assert.ok(!template.includes("{{ .ConfirmationURL }}"));
});

test("email signup confirmation template sends a code instead of a confirmation link", () => {
  const template = readFileSync(emailSignupTemplatePath, "utf8");

  assert.ok(template.includes("{{ .Token }}"));
  assert.ok(!template.includes("{{ .ConfirmationURL }}"));
});
