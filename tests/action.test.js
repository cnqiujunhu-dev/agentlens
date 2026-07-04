import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("composite GitHub Action exposes CI outputs", () => {
  const action = fs.readFileSync("action.yml", "utf8");

  assert.match(action, /outputs:/);
  assert.match(action, /status:/);
  assert.match(action, /total:/);
  assert.match(action, /passed:/);
  assert.match(action, /failed:/);
  assert.match(action, /scan:/);
  assert.match(action, /scan-fail-on:/);
  assert.match(action, /sarif:/);
  assert.match(action, /--scan/);
  assert.match(action, /--scan-fail-on/);
  assert.match(action, /--sarif/);
  assert.match(action, /--json/);
  assert.match(action, /GITHUB_OUTPUT/);
});

test("repository workflow verifies GitHub Action outputs", () => {
  const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /id: agentlens-action/);
  assert.match(workflow, /steps\.agentlens-action\.outputs\.status/);
  assert.match(workflow, /steps\.agentlens-action\.outputs\.failed/);
  assert.match(workflow, /steps\.agentlens-action\.outputs\.total/);
});
