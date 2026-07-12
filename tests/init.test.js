import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initWorkspace, readJson, readTrace } from "../src/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");
const latestStableActionRef = "cnqiujunhu-dev/agentlens@v0.3.0";

function findPython() {
  const candidates = process.platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
  for (const [command, args] of candidates) {
    const result = spawnSync(command, [...args, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (result.status === 0) return [command, args];
  }
  return null;
}

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
  assert.match(actionExample, /issues: write/);
  assert.match(actionExample, /pull-requests: read/);
  assert.match(actionExample, new RegExp(latestStableActionRef.replaceAll(".", "\\.")));
  assert.match(actionExample, /pr-comment: \.agentlens\/reports\/agentlens-pr-comment\.md/);
  assert.match(actionExample, /bundle: \.agentlens\/reports\/bundle/);
  assert.match(actionExample, /bundle-sections: summary,scan,tool-calls,workflow,filters,timeline/);
  assert.match(actionExample, /actions\/upload-artifact@v4/);
  assert.match(actionExample, /agentlens-run-bundle/);
  assert.match(actionExample, /Upsert AgentLens PR comment/);
  assert.match(actionExample, /agentlens-ci-comment/);
  assert.doesNotMatch(actionExample, /actions\/checkout@v4/);
  assert.doesNotMatch(actionExample, /your-org\/agentlens@v0/);

  fs.writeFileSync(path.join(workspace.evalsDir, "default.json"), "{ \"custom\": true }\n", "utf8");
  const second = initWorkspace(dir, { scaffold: true });

  assert.equal(second.createdFiles.length, 0);
  assert.deepEqual(readJson(path.join(workspace.evalsDir, "default.json")), { custom: true });
});

test("initWorkspace can scaffold a review pack GitHub Action", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-review-init-"));
  const workspace = initWorkspace(dir, { scaffold: true, review: true });
  const reviewAction = path.join(workspace.examplesDir, "review-github-action.yml");

  assert.equal(fs.existsSync(reviewAction), true);
  assert.equal(workspace.createdFiles.length, 4);

  const actionExample = fs.readFileSync(reviewAction, "utf8");
  assert.match(actionExample, /name: agentlens-review/);
  assert.match(actionExample, /review-baseline: \.agentlens\/baseline\/baseline\.json/);
  assert.match(actionExample, /review-candidate: \.agentlens\/candidate\/candidate\.json/);
  assert.match(actionExample, /review: \.agentlens\/reports\/review/);
  assert.match(actionExample, /review-fail-on-failure: true/);
  assert.match(actionExample, /steps\.agentlens\.outputs\.review-manifest/);
  assert.match(actionExample, /agentlens\.review\.v1/);
  assert.match(actionExample, /actions\/upload-artifact@v4/);
  assert.match(actionExample, /Upsert AgentLens review PR comment/);
  assert.match(actionExample, /steps\.agentlens\.outputs\.review-pr-comment/);
  assert.doesNotMatch(actionExample, /actions\/checkout@v4/);

  const second = initWorkspace(dir, { scaffold: true, review: true });
  assert.equal(second.createdFiles.length, 0);
});

test("CLI init --review writes the review workflow template", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-review-cli-init-"));
  const result = spawnSync(process.execPath, [binPath, "init", "--review"], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Review workflow:/);
  assert.equal(fs.existsSync(path.join(dir, ".agentlens", "examples", "review-github-action.yml")), true);
});

test("initWorkspace can scaffold a runnable Python starter", () => {
  const python = findPython();
  if (!python) {
    assert.ok(true, "Python 3.8+ is not available; skipping runtime check");
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-python-init-"));
  const workspace = initWorkspace(dir, { scaffold: true, python: true });

  const starterFile = path.join(workspace.pythonDir, "basic_run.py");
  const helperFile = path.join(workspace.pythonDir, "agentlens_trace.py");
  const pythonAction = path.join(workspace.examplesDir, "python-github-action.yml");
  const traceFile = path.join(workspace.runsDir, "python-starter.json");

  assert.equal(fs.existsSync(starterFile), true);
  assert.equal(fs.existsSync(helperFile), true);
  assert.equal(fs.existsSync(path.join(workspace.pythonDir, "README.md")), true);
  assert.equal(fs.existsSync(pythonAction), true);
  assert.equal(workspace.createdFiles.length, 7);
  const pythonActionExample = fs.readFileSync(pythonAction, "utf8");
  assert.match(pythonActionExample, /actions\/setup-python@v6/);
  assert.match(pythonActionExample, /pr-comment: \.agentlens\/reports\/agentlens-pr-comment\.md/);
  assert.match(pythonActionExample, /actions\/upload-artifact@v4/);
  assert.match(pythonActionExample, /Upsert AgentLens PR comment/);
  assert.match(pythonActionExample, /agentlens-ci-comment/);

  const [command, args] = python;
  const result = spawnSync(command, [...args, starterFile, "--out", traceFile], {
    cwd: dir,
    encoding: "utf8"
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  const trace = readTrace(traceFile);
  assert.equal(trace.schemaVersion, "agentlens.trace.v1");
  assert.equal(trace.app, "python-agent");
  assert.equal(trace.status, "passed");
  assert.equal(trace.events.some((event) => event.type === "tool.call"), true);
  assert.equal(trace.events.some((event) => event.type === "llm.response" && event.output?.citations?.includes("agentlens-python-starter")), true);

  const second = initWorkspace(dir, { scaffold: true, python: true });
  assert.equal(second.createdFiles.length, 0);
});
