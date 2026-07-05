import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initWorkspace, readJson } from "../src/store.js";

test("initWorkspace scaffolds starter files without overwriting", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-init-"));
  const workspace = initWorkspace(dir, { scaffold: true });

  assert.equal(fs.existsSync(workspace.runsDir), true);
  assert.equal(fs.existsSync(workspace.reportsDir), true);
  assert.equal(fs.existsSync(path.join(workspace.evalsDir, "default.json")), true);
  assert.equal(fs.existsSync(path.join(workspace.examplesDir, "github-action.yml")), true);
  assert.equal(workspace.createdFiles.length, 3);

  const evalConfig = readJson(path.join(workspace.evalsDir, "default.json"));
  assert.equal(evalConfig.version, "agentlens.eval.v1");
  const actionExample = fs.readFileSync(path.join(workspace.examplesDir, "github-action.yml"), "utf8");
  assert.match(actionExample, /actions\/checkout@v7/);
  assert.match(actionExample, /cnqiujunhu-dev\/agentlens@v0\.2\.0/);
  assert.doesNotMatch(actionExample, /actions\/checkout@v4/);
  assert.doesNotMatch(actionExample, /your-org\/agentlens@v0/);

  fs.writeFileSync(path.join(workspace.evalsDir, "default.json"), "{ \"custom\": true }\n", "utf8");
  const second = initWorkspace(dir, { scaffold: true });

  assert.equal(second.createdFiles.length, 0);
  assert.deepEqual(readJson(path.join(workspace.evalsDir, "default.json")), { custom: true });
});
