import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatReviewReport, writeReviewBundle } from "../src/review.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";
import { writeJson, writeTrace } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function makeBaselineTrace() {
  const run = createRun({ app: "review-agent", name: "baseline" });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, {
    type: "tool.call",
    name: "kb.search",
    input: { query: "refund policy" },
    metadata: { permission: "read-only" }
  });
  addEvent(run, {
    type: "tool.result",
    name: "kb.search",
    output: { sourceId: "policy" },
    metadata: { permission: "read-only" }
  });
  addEvent(run, {
    type: "llm.response",
    name: "final",
    output: { content: "Refunds are allowed with proof.", citations: ["policy"] },
    usage: { totalTokens: 30, costUsd: 0.0004 }
  });
  return finishRun(run, "passed");
}

function makeCandidateTrace() {
  const run = createRun({ app: "review-agent", name: "candidate" });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, {
    type: "tool.call",
    name: "email.send",
    input: { to: "customer@example.com" },
    metadata: { permission: "write", toolRisk: "high" }
  });
  addEvent(run, {
    type: "llm.response",
    name: "final",
    output: { content: "I emailed the customer." },
    usage: { totalTokens: 80, costUsd: 0.004 }
  });
  addEvent(run, { type: "error", name: "policy-regression", status: "error" });
  return finishRun(run, "failed");
}

function writeReviewInputs(dir) {
  const baselineFile = path.join(dir, "baseline.json");
  const candidateFile = path.join(dir, "candidate.json");
  const configPath = path.join(dir, "eval.json");
  writeTrace(baselineFile, makeBaselineTrace());
  writeTrace(candidateFile, makeCandidateTrace());
  writeJson(configPath, {
    version: "agentlens.eval.v1",
    name: "review-policy",
    assertions: [
      { id: "has-core-events", type: "required-event-types", eventTypes: ["llm.prompt", "llm.response"] },
      { id: "no-errors", type: "max-errors", max: 0 },
      { id: "no-send", type: "forbidden-tools", tools: ["email.send"] },
      { id: "has-citation", type: "required-citations", min: 1 }
    ]
  });
  return { baselineFile, candidateFile, configPath };
}

test("writeReviewBundle generates a PR review artifact pack", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-review-"));
  const { baselineFile, candidateFile, configPath } = writeReviewInputs(dir);
  const result = writeReviewBundle({
    baselineFile,
    candidateFile,
    configPath,
    outDir: path.join(dir, "review"),
    artifactUrl: "https://example.com/bundle",
    sarifUrl: "https://example.com/sarif"
  });

  assert.equal(result.status.passed, false);
  assert.equal(result.status.ci, false);
  assert.equal(result.status.diffRegressions > 0, true);

  for (const file of [
    result.files.baseline,
    result.files.candidate,
    result.files.evalConfig,
    result.files.ciSummary,
    result.files.prComment,
    result.files.ciReport,
    result.files.diffText,
    result.files.diffDashboard,
    result.files.sarif,
    result.files.bundleIndex,
    result.files.bundleManifest,
    result.files.readme
  ]) {
    assert.equal(fs.existsSync(file), true, file);
  }

  assert.match(fs.readFileSync(result.files.prComment, "utf8"), /agentlens-ci-comment/);
  assert.match(fs.readFileSync(result.files.prComment, "utf8"), /Run bundle: https:\/\/example\.com\/bundle/);
  assert.match(fs.readFileSync(result.files.diffText, "utf8"), /status changed from passed to failed/);
  assert.match(formatReviewReport(result, { root: dir }), /AgentLens Review/);
});

test("CLI review writes artifacts and can fail a CI gate", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-review-cli-"));
  const { baselineFile, candidateFile, configPath } = writeReviewInputs(dir);
  const outDir = path.join(dir, "review");
  const result = spawnSync(process.execPath, [
    binPath,
    "review",
    baselineFile,
    candidateFile,
    "--config",
    configPath,
    "--out",
    outDir,
    "--fail-on-failure"
  ], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /AgentLens Review/);
  assert.match(result.stdout, /Status: FAIL/);
  assert.equal(fs.existsSync(path.join(outDir, "reports", "diff.html")), true);
  assert.equal(fs.existsSync(path.join(outDir, "reports", "pr-comment.md")), true);
  assert.equal(fs.existsSync(path.join(outDir, "reports", "bundle", "index.html")), true);
});
