import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatValidationReport, validateArtifact, validateEvalConfig, validateReviewManifest } from "../src/validate.js";
import { writeReviewBundle } from "../src/review.js";
import { writeJson, writeTrace } from "../src/store.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function makeTrace() {
  const run = createRun({ app: "validate-test", name: "valid trace" });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, "passed");
}

test("validateArtifact validates trace files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-validate-trace-"));
  const traceFile = path.join(dir, "trace.json");
  const badTraceFile = path.join(dir, "bad-trace.json");

  writeTrace(traceFile, makeTrace());
  writeJson(badTraceFile, { schemaVersion: "wrong", events: [] });

  const valid = validateArtifact("trace", traceFile);
  const invalid = validateArtifact("trace", badTraceFile);

  assert.equal(valid.valid, true);
  assert.equal(invalid.valid, false);
  assert.match(formatValidationReport(invalid), /schemaVersion must be agentlens.trace.v1/);
});

test("validateEvalConfig accepts MCP risk exception policies", () => {
  const report = validateEvalConfig({
    version: "agentlens.eval.v1",
    name: "mcp-policy",
    assertions: [
      {
        id: "reviewed-risk",
        type: "forbidden-mcp-tool-risks",
        risks: ["high"],
        requireExceptionOwner: true,
        requireExceptionExpiry: true,
        exceptions: [{ server: "local", tool: "file.write", risk: "high", owner: "platform", expiresAt: "2099-01-01T00:00:00.000Z" }]
      }
    ]
  });

  assert.equal(report.valid, true);
});

test("validateEvalConfig accepts workflow policies", () => {
  const report = validateEvalConfig({
    version: "agentlens.eval.v1",
    name: "workflow-policy",
    assertions: [
      { id: "has-chain", type: "min-workflow-chains", min: 2 },
      { id: "has-task", type: "min-workflow-tasks", min: 2 },
      { id: "no-workflow-errors", type: "max-workflow-errors", max: 0 }
    ]
  });

  assert.equal(report.valid, true);
});

test("validateEvalConfig rejects unknown assertion shapes", () => {
  const report = validateEvalConfig({
    version: "agentlens.eval.v1",
    name: "bad",
    assertions: [{ id: "unknown", type: "not-real", tools: "delete_database" }]
  });

  assert.equal(report.valid, false);
  assert.deepEqual(report.errors, ["assertions[0].type is unknown: not-real", "assertions[0].tools must be an array"]);
});

test("validateArtifact validates review manifests", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-validate-review-"));
  const baselineFile = path.join(dir, "baseline.json");
  const candidateFile = path.join(dir, "candidate.json");
  const configFile = path.join(dir, "eval.json");
  const badReviewFile = path.join(dir, "bad-review.json");

  writeTrace(baselineFile, makeTrace());
  writeTrace(candidateFile, makeTrace());
  writeJson(configFile, {
    version: "agentlens.eval.v1",
    name: "review-validation",
    assertions: [{ id: "has-answer", type: "required-final-response" }]
  });

  const review = writeReviewBundle({
    baselineFile,
    candidateFile,
    configPath: configFile,
    outDir: path.join(dir, "review"),
    scan: false
  });
  const valid = validateArtifact("review", review.files.manifest);
  assert.equal(valid.valid, true);
  assert.equal(validateReviewManifest(review.manifest).valid, true);
  assert.equal(
    validateReviewManifest({
      ...review.manifest,
      generatedAt: 123
    }).valid,
    false
  );
  assert.equal(
    validateReviewManifest({
      ...review.manifest,
      options: { ...review.manifest.options, scan: "yes" }
    }).valid,
    false
  );
  assert.equal(
    validateReviewManifest({
      ...review.manifest,
      links: { ...review.manifest.links, artifactUrl: 42 }
    }).valid,
    false
  );

  writeJson(badReviewFile, { schemaVersion: "wrong" });
  const invalid = validateArtifact("review", badReviewFile);
  assert.equal(invalid.valid, false);
  assert.match(formatValidationReport(invalid), /schemaVersion must be agentlens\.review\.v1/);

  const cli = spawnSync(process.execPath, [binPath, "validate", "review", review.files.manifest, "--json"], {
    cwd: dir,
    encoding: "utf8"
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).valid, true);
});

test("CLI validate emits JSON and exits nonzero for invalid files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-validate-cli-"));
  const configFile = path.join(dir, "eval.json");
  writeJson(configFile, {
    version: "agentlens.eval.v1",
    name: "bad",
    assertions: [{ id: "missing-type" }]
  });

  const result = spawnSync(process.execPath, [binPath, "validate", "eval", configFile, "--json"], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, false);
  assert.match(report.errors.join("\n"), /type is required/);
});
