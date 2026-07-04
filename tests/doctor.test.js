import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { doctorWorkspace, formatDoctorReport } from "../src/doctor.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function makeTrace() {
  const run = createRun({ app: "doctor-test", name: "healthy trace" });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, "passed");
}

function addWorkflow(root) {
  const workflowsDir = path.join(root, ".github", "workflows");
  fs.mkdirSync(workflowsDir, { recursive: true });
  fs.writeFileSync(path.join(workflowsDir, "agentlens.yml"), "name: agentlens\n", "utf8");
}

test("doctorWorkspace reports missing setup as warnings", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-doctor-missing-"));
  const report = doctorWorkspace(dir, { nodeVersion: "22.0.0" });

  assert.equal(report.passed, true);
  assert.equal(report.summary.status, "warn");
  assert.equal(report.checks.some((check) => check.id === "workspace" && check.status === "warn"), true);
  assert.match(formatDoctorReport(report), /agentlens init/);
});

test("doctorWorkspace passes for an initialized workspace with traces and CI", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-doctor-ready-"));
  fs.mkdirSync(path.join(dir, ".git"));
  fs.writeFileSync(path.join(dir, ".gitignore"), ".agentlens/\n", "utf8");
  addWorkflow(dir);

  const workspace = initWorkspace(dir, { scaffold: true });
  writeTrace(path.join(workspace.runsDir, "demo.json"), makeTrace());

  const report = doctorWorkspace(dir, { nodeVersion: "22.0.0" });

  assert.equal(report.passed, true);
  assert.equal(report.summary.status, "pass");
  assert.equal(report.checks.every((check) => check.status === "pass"), true);
});

test("doctorWorkspace fails invalid traces and old Node versions", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-doctor-invalid-"));
  addWorkflow(dir);
  const workspace = initWorkspace(dir, { scaffold: true });
  fs.writeFileSync(path.join(workspace.runsDir, "bad.json"), "{ \"not\": \"a trace\" }\n", "utf8");

  const report = doctorWorkspace(dir, { nodeVersion: "18.19.0" });

  assert.equal(report.passed, false);
  assert.equal(report.summary.status, "fail");
  assert.equal(report.checks.some((check) => check.id === "node-version" && check.status === "fail"), true);
  assert.equal(report.checks.some((check) => check.id === "trace-files" && check.status === "fail"), true);
});

test("CLI doctor emits JSON", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-doctor-cli-"));
  addWorkflow(dir);

  const result = spawnSync(process.execPath, [binPath, "doctor", "--json"], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.status, "warn");
  assert.equal(Array.isArray(report.checks), true);
});
