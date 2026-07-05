import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatQuickstartReport, runQuickstart } from "../src/quickstart.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";
import { ensureDir, readTrace, writeTrace } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function makeEvalFailingTrace() {
  const run = createRun({ app: "quickstart-test", name: "unrelated failing trace" });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  return finishRun(run, "passed");
}

test("runQuickstart writes an isolated artifact pack", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-quickstart-"));
  const unrelatedRunsDir = path.join(dir, ".agentlens", "runs");
  ensureDir(unrelatedRunsDir);
  writeTrace(path.join(unrelatedRunsDir, "unrelated-failing.json"), makeEvalFailingTrace());

  const result = runQuickstart({ root: dir, python: true });

  assert.equal(result.status.passed, true);
  assert.equal(result.status.eval, true);
  assert.equal(result.status.scan, true);
  assert.equal(result.status.ci, true);
  assert.equal(readTrace(result.files.trace).app, "agentlens-demo");

  for (const file of [
    result.files.trace,
    result.files.dashboard,
    result.files.eval,
    result.files.scan,
    result.files.ciSummary,
    result.files.prComment,
    result.files.otel,
    result.files.bundleIndex,
    result.files.bundleManifest,
    result.files.shareSummary,
    result.files.shareDashboard,
    path.join(dir, ".agentlens", "python", "basic_run.py")
  ]) {
    assert.equal(fs.existsSync(file), true, file);
  }

  assert.match(fs.readFileSync(result.files.prComment, "utf8"), /agentlens-ci-comment/);
  assert.match(fs.readFileSync(result.files.ciSummary, "utf8"), /Status:\*\* PASS/);
  assert.match(formatQuickstartReport(result, { root: dir }), /agentlens serve \.agentlens\/quickstart\/runs/);
});

test("CLI quickstart writes launch-ready artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-quickstart-cli-"));
  const result = spawnSync(process.execPath, [binPath, "quickstart", "--python"], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /AgentLens Quickstart/);
  assert.match(result.stdout, /Status: PASS/);
  assert.equal(fs.existsSync(path.join(dir, ".agentlens", "quickstart", "runs", "demo.json")), true);
  assert.equal(fs.existsSync(path.join(dir, ".agentlens", "quickstart", "reports", "bundle", "index.html")), true);
  assert.equal(fs.existsSync(path.join(dir, ".agentlens", "quickstart", "reports", "pr-comment.md")), true);
  assert.equal(fs.existsSync(path.join(dir, ".agentlens", "quickstart", "share", "demo", "summary.md")), true);
  assert.equal(fs.existsSync(path.join(dir, ".agentlens", "python", "basic_run.py")), true);
});
