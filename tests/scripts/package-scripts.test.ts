import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type PackageJson = {
  scripts?: Record<string, string>;
};

const packageJson = JSON.parse(
  readFileSync("package.json", "utf8"),
) as PackageJson;
const scripts = packageJson.scripts ?? {};

test("common local and build commands run without implicit Supabase secrets sync", () => {
  assert.equal(
    scripts["secrets:sync"],
    "node scripts/sync-supabase-secrets.js",
  );
  assert.equal(scripts["start:expo"], "expo start");

  assert.equal(scripts.dev, "pnpm start:expo");
  assert.equal(scripts.start, "pnpm dev");
  assert.equal(scripts.preview, "pnpm start:expo --host lan");
  assert.equal(scripts.android, "pnpm start:expo --android");
  assert.equal(scripts.ios, "pnpm start:expo --ios");
  assert.equal(scripts.web, "pnpm start:expo --web");
  assert.equal(scripts.build, "expo export");
  assert.equal(scripts["build:web"], "expo export --platform web");
  assert.equal(scripts["build:prepare"], "pnpm typecheck && pnpm test");
});

test("sync variants explicitly sync Supabase secrets once", () => {
  assert.equal(scripts["dev:sync"], "pnpm secrets:sync && pnpm dev");
  assert.equal(scripts["preview:sync"], "pnpm secrets:sync && pnpm preview");
  assert.equal(scripts["build:sync"], "pnpm secrets:sync && pnpm build");
  assert.equal(
    scripts["build:web:sync"],
    "pnpm secrets:sync && pnpm build:web",
  );
  assert.equal(
    scripts["build:prepare:sync"],
    "pnpm secrets:sync && pnpm build:prepare",
  );
  assert.equal(scripts["android:sync"], "pnpm secrets:sync && pnpm android");
  assert.equal(scripts["ios:sync"], "pnpm secrets:sync && pnpm ios");
  assert.equal(scripts["web:sync"], "pnpm secrets:sync && pnpm web");
});

test("agent ui regression scripts are available without implicit secrets sync", () => {
  assert.equal(
    scripts["agent:ui-regression"],
    "node scripts/agent-ui-regression.js",
  );
  assert.equal(
    scripts["agent:ui-regression:run"],
    "node scripts/agent-ui-regression.js --run",
  );
  assert.equal(
    scripts["test:agent-ui"],
    "node scripts/agent-ui-regression.js --run --headless",
  );
});
