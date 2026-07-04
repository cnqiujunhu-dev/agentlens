import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatValidationReport, validateArtifact, validateEvalConfig } from "../src/validate.js";
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

test("validateEvalConfig rejects unknown assertion shapes", () => {
  const report = validateEvalConfig({
    version: "agentlens.eval.v1",
    name: "bad",
    assertions: [{ id: "unknown", type: "not-real", tools: "delete_database" }]
  });

  assert.equal(report.valid, false);
  assert.deepEqual(report.errors, ["assertions[0].type is unknown: not-real", "assertions[0].tools must be an array"]);
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
