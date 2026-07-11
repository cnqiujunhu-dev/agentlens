import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addEvent, createRun, finishRun } from "../src/trace.js";
import { writeJson, writeTrace } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function makeTrace(name = "cli json") {
  const run = createRun({ app: "cli-test", name });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, "passed");
}

function runCli(args, cwd) {
  const result = spawnSync(process.execPath, [binPath, ...args], {
    cwd,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("CLI emits JSON for inspect, eval, scan, ci, review, and diff", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-cli-json-"));
  const runsDir = path.join(dir, "runs");
  fs.mkdirSync(runsDir);
  const baselineFile = path.join(runsDir, "baseline.json");
  const candidateFile = path.join(runsDir, "candidate.json");
  const configFile = path.join(dir, "eval.json");

  writeTrace(baselineFile, makeTrace("baseline"));
  writeTrace(candidateFile, makeTrace("candidate"));
  writeJson(configFile, {
    version: "agentlens.eval.v1",
    name: "cli-json",
    assertions: [{ id: "has-answer", type: "required-final-response" }]
  });

  const inspect = runCli(["inspect", baselineFile, "--json"], dir);
  assert.equal(inspect.name, "baseline");

  const evaluation = runCli(["eval", baselineFile, "--config", configFile, "--json"], dir);
  assert.equal(evaluation.passed, true);

  const scan = runCli(["scan", baselineFile, "--json"], dir);
  assert.equal(scan.passed, true);

  const ci = runCli(["ci", "--runs", runsDir, "--config", configFile, "--json"], dir);
  assert.equal(ci.total, 2);
  assert.equal(ci.failed, 0);

  const review = runCli(["review", baselineFile, candidateFile, "--config", configFile, "--out", path.join(dir, "review"), "--json"], dir);
  assert.equal(review.schemaVersion, "agentlens.review.v1");
  assert.equal(review.status.passed, true);
  assert.equal(review.summary.ci.total, 2);

  const diff = runCli(["diff", baselineFile, candidateFile, "--json"], dir);
  assert.equal(diff.deltas.eventCount, 0);
});

test("CLI writes CI markdown summaries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-cli-summary-"));
  const runsDir = path.join(dir, "runs");
  fs.mkdirSync(runsDir);
  const traceFile = path.join(runsDir, "trace.json");
  const configFile = path.join(dir, "eval.json");
  const summaryFile = path.join(dir, "summary.md");

  writeTrace(traceFile, makeTrace("summary"));
  writeJson(configFile, {
    version: "agentlens.eval.v1",
    name: "cli-summary",
    assertions: [{ id: "has-answer", type: "required-final-response" }]
  });

  const result = spawnSync(process.execPath, [binPath, "ci", "--runs", runsDir, "--config", configFile, "--summary-md", summaryFile], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(summaryFile, "utf8");
  assert.match(markdown, /## AgentLens CI/);
  assert.match(markdown, /summary/);
});

test("CLI writes PR comment markdown", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-cli-pr-comment-"));
  const runsDir = path.join(dir, "runs");
  fs.mkdirSync(runsDir);
  const traceFile = path.join(runsDir, "trace.json");
  const configFile = path.join(dir, "eval.json");
  const commentFile = path.join(dir, "comment.md");

  writeTrace(traceFile, makeTrace("pr comment"));
  writeJson(configFile, {
    version: "agentlens.eval.v1",
    name: "cli-pr-comment",
    assertions: [{ id: "has-answer", type: "required-final-response" }]
  });

  const result = spawnSync(process.execPath, [
    binPath,
    "ci",
    "--runs",
    runsDir,
    "--config",
    configFile,
    "--pr-comment-md",
    commentFile,
    "--artifact-url",
    "https://example.com/bundle"
  ], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const markdown = fs.readFileSync(commentFile, "utf8");
  assert.match(markdown, /<!-- agentlens-ci-comment -->/);
  assert.match(markdown, /AgentLens CI: PASS/);
  assert.match(markdown, /Run bundle: https:\/\/example\.com\/bundle/);
});

test("CLI writes dashboard with selected sections", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-cli-dashboard-sections-"));
  const traceFile = path.join(dir, "trace.json");
  const reportFile = path.join(dir, "report.html");

  writeTrace(traceFile, makeTrace("dashboard sections"));

  const result = spawnSync(process.execPath, [
    binPath,
    "dashboard",
    traceFile,
    "--out",
    reportFile,
    "--sections",
    "summary,timeline"
  ], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const html = fs.readFileSync(reportFile, "utf8");
  assert.match(html, /Timeline/);
  assert.match(html, /Status/);
  assert.doesNotMatch(html, /Security Scan/);
  assert.doesNotMatch(html, /Timeline Filters/);
  assert.doesNotMatch(html, /Event Types/);
});

test("CLI writes combined SARIF for scanned CI runs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-cli-sarif-"));
  const runsDir = path.join(dir, "runs");
  fs.mkdirSync(runsDir);
  const traceFile = path.join(runsDir, "trace.json");
  const configFile = path.join(dir, "eval.json");
  const sarifFile = path.join(dir, "agentlens.sarif");

  const trace = makeTrace("sarif");
  trace.metadata.apiKey = "plain-secret";
  writeTrace(traceFile, trace);
  writeJson(configFile, {
    version: "agentlens.eval.v1",
    name: "cli-sarif",
    assertions: [{ id: "has-answer", type: "required-final-response" }]
  });

  const result = spawnSync(process.execPath, [binPath, "ci", "--runs", runsDir, "--config", configFile, "--scan", "--scan-fail-on", "none", "--sarif", sarifFile], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const sarif = JSON.parse(fs.readFileSync(sarifFile, "utf8"));
  assert.equal(sarif.runs[0].results[0].ruleId, "sensitive-key");
});
