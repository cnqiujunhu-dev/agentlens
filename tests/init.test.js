import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { initWorkspace, readJson, readTrace } from "../src/store.js";

const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const actionRef = `cnqiujunhu-dev/agentlens@v${packageJson.version}`;

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
  assert.match(actionExample, new RegExp(actionRef.replaceAll(".", "\\.")));
  assert.match(actionExample, /bundle: \.agentlens\/reports\/bundle/);
  assert.match(actionExample, /bundle-sections: summary,scan,tool-calls,filters,timeline/);
  assert.doesNotMatch(actionExample, /actions\/checkout@v4/);
  assert.doesNotMatch(actionExample, /your-org\/agentlens@v0/);

  fs.writeFileSync(path.join(workspace.evalsDir, "default.json"), "{ \"custom\": true }\n", "utf8");
  const second = initWorkspace(dir, { scaffold: true });

  assert.equal(second.createdFiles.length, 0);
  assert.deepEqual(readJson(path.join(workspace.evalsDir, "default.json")), { custom: true });
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
