import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildShareBundle, writeShareBundle } from "../src/share.js";
import { writeJson, writeTrace } from "../src/store.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function makeSensitiveTrace() {
  const run = createRun({
    app: "share-test",
    name: "share bundle",
    metadata: { token: "secret-token" }
  });
  addEvent(run, {
    type: "llm.prompt",
    name: "planner",
    input: {
      messages: [{ role: "user", content: "Can I return this?" }],
      apiKey: "secret-api-key"
    }
  });
  addEvent(run, {
    type: "llm.response",
    name: "final",
    output: { content: "Yes, within 30 days.", citations: ["refund-policy"] }
  });
  return finishRun(run, "passed");
}

test("buildShareBundle redacts sensitive fields before rendering dashboard", () => {
  const bundle = buildShareBundle(makeSensitiveTrace(), {
    evalConfig: {
      version: "agentlens.eval.v1",
      name: "share-eval",
      assertions: [{ id: "citations", type: "required-citations", min: 1 }]
    }
  });

  assert.equal(bundle.redactedTrace.metadata.token, "[REDACTED]");
  assert.equal(bundle.redactedTrace.events[0].input.apiKey, "[REDACTED]");
  assert.equal(bundle.evalReport.passed, true);
  assert.match(bundle.summaryMarkdown, /AgentLens Share Bundle/);
  assert.match(bundle.summaryMarkdown, /Status: PASS/);
  assert.match(bundle.summaryMarkdown, /## Scan/);
  assert.equal(bundle.scanReport.passed, true);
  assert.doesNotMatch(bundle.dashboardHtml, /secret-api-key/);
  assert.doesNotMatch(bundle.dashboardHtml, /secret-token/);
});

test("writeShareBundle writes redacted trace, dashboard, summary, and eval report", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-share-"));
  const traceFile = path.join(dir, "trace.json");
  const configFile = path.join(dir, "eval.json");
  const outDir = path.join(dir, "share");

  writeTrace(traceFile, makeSensitiveTrace());
  writeJson(configFile, {
    version: "agentlens.eval.v1",
    name: "share-eval",
    assertions: [{ id: "final-answer", type: "required-final-response" }]
  });

  const result = writeShareBundle({ traceFile, configPath: configFile, outDir });

  assert.equal(result.outDir, outDir);
  assert.equal(result.evalPassed, true);
  for (const file of Object.values(result.files).filter(Boolean)) {
    assert.equal(fs.existsSync(file), true);
  }
  assert.doesNotMatch(fs.readFileSync(result.files.trace, "utf8"), /secret-api-key/);
  assert.match(fs.readFileSync(result.files.summary, "utf8"), /trace.redacted.json/);
  assert.match(fs.readFileSync(result.files.eval, "utf8"), /Status: PASS/);
});

test("CLI share writes a share bundle", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-share-cli-"));
  const traceFile = path.join(dir, "trace.json");
  const outDir = path.join(dir, "share");
  writeTrace(traceFile, makeSensitiveTrace());

  const result = spawnSync(process.execPath, [binPath, "share", traceFile, "--out", outDir], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote share bundle/);
  assert.equal(fs.existsSync(path.join(outDir, "trace.redacted.json")), true);
  assert.equal(fs.existsSync(path.join(outDir, "dashboard.html")), true);
  assert.equal(fs.existsSync(path.join(outDir, "summary.md")), true);
  assert.equal(fs.existsSync(path.join(outDir, "scan.txt")), true);
});
