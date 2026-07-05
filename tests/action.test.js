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
  assert.match(action, /summary:/);
  assert.match(action, /pr-comment:/);
  assert.match(action, /scan:/);
  assert.match(action, /scan-fail-on:/);
  assert.match(action, /sarif:/);
  assert.match(action, /--scan/);
  assert.match(action, /--scan-fail-on/);
  assert.match(action, /--sarif/);
  assert.match(action, /--pr-comment-md/);
  assert.match(action, /--json/);
  assert.match(action, /GITHUB_OUTPUT/);
  assert.match(action, /actions\/setup-node@v6/);
  assert.doesNotMatch(action, /actions\/setup-node@v4/);
  assert.doesNotMatch(action, /your-org\/agentlens@v0/);
});

test("repository workflow verifies GitHub Action outputs", () => {
  const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");

  assert.match(workflow, /id: agentlens-action/);
  assert.match(workflow, /steps\.agentlens-action\.outputs\.status/);
  assert.match(workflow, /steps\.agentlens-action\.outputs\.failed/);
  assert.match(workflow, /steps\.agentlens-action\.outputs\.total/);
  assert.match(workflow, /pr-comment\.md/);
  assert.match(workflow, /agentlens-ci-comment/);
  assert.match(workflow, /actions\/checkout@v7/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /demo:autogen/);
  assert.match(workflow, /demo:crewai/);
  assert.match(workflow, /demo:regression-pr/);
  assert.match(workflow, /multi-agent-basic\.json/);
  assert.doesNotMatch(workflow, /actions\/checkout@v4/);
  assert.doesNotMatch(workflow, /actions\/setup-node@v4/);
});
