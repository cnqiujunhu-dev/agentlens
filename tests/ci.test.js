import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatCiMarkdown, formatCiReport, formatCiSarif, runCi } from "../src/ci.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";
import { writeTrace } from "../src/store.js";

function makePassingTrace() {
  const run = createRun({ app: "ci-agent", name: "passing" });
  addEvent(run, { type: "llm.prompt", name: "answer" });
  addEvent(run, { type: "llm.response", name: "answer", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, "passed");
}

function makeFailingTrace() {
  const run = createRun({ app: "ci-agent", name: "failing" });
  addEvent(run, { type: "llm.response", name: "answer", output: { content: "uncited" } });
  return finishRun(run, "failed");
}

function makeSecretTrace() {
  const run = createRun({ app: "ci-agent", name: "secret leak" });
  addEvent(run, { type: "llm.prompt", name: "answer" });
  addEvent(run, {
    type: "llm.response",
    name: "answer",
    output: { content: "ok", citations: ["doc"] },
    metadata: { apiKey: "plain-secret" }
  });
  return finishRun(run, "passed");
}

test("runCi evaluates every trace file in a run directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-ci-"));
  writeTrace(path.join(dir, "pass.json"), makePassingTrace());
  writeTrace(path.join(dir, "fail.json"), makeFailingTrace());

  const summary = runCi({
    runsDir: dir,
    config: {
      name: "ci-test",
      assertions: [{ id: "citations", type: "required-citations", min: 1 }]
    }
  });

  assert.equal(summary.total, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.match(formatCiReport(summary), /Status: FAIL/);
  assert.match(formatCiMarkdown(summary), /## AgentLens CI/);
  assert.match(formatCiMarkdown(summary), /citations:/);
});

test("runCi can fail traces on scan findings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-ci-scan-"));
  writeTrace(path.join(dir, "secret.json"), makeSecretTrace());

  const summary = runCi({
    runsDir: dir,
    scan: true,
    config: {
      name: "ci-test",
      assertions: [{ id: "citations", type: "required-citations", min: 1 }]
    }
  });

  assert.equal(summary.total, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.results[0].report.passed, true);
  assert.equal(summary.results[0].scanReport.passed, false);
  assert.match(formatCiReport(summary), /scan failed/);
  assert.match(formatCiMarkdown(summary), /scan\/sensitive-key/);
});

test("runCi scan fail-on none reports findings without failing traces", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-ci-scan-none-"));
  writeTrace(path.join(dir, "secret.json"), makeSecretTrace());

  const summary = runCi({
    runsDir: dir,
    scan: true,
    scanFailOnSeverity: "none",
    config: {
      name: "ci-test",
      assertions: [{ id: "citations", type: "required-citations", min: 1 }]
    }
  });

  assert.equal(summary.failed, 0);
  assert.equal(summary.results[0].scanReport.summary.findings, 1);
  assert.doesNotMatch(formatCiMarkdown(summary), /scan\/sensitive-key/);
});

test("formatCiSarif combines scan findings for a run directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-ci-sarif-"));
  writeTrace(path.join(dir, "pass.json"), makePassingTrace());
  writeTrace(path.join(dir, "secret.json"), makeSecretTrace());

  const summary = runCi({
    runsDir: dir,
    scan: true,
    scanFailOnSeverity: "none",
    config: {
      name: "ci-test",
      assertions: [{ id: "citations", type: "required-citations", min: 1 }]
    }
  });
  const sarif = formatCiSarif(summary);

  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].tool.driver.rules.length, 1);
  assert.equal(sarif.runs[0].results.length, 1);
  assert.equal(sarif.runs[0].results[0].ruleId, "sensitive-key");
  assert.match(sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, /secret\.json$/);
});
