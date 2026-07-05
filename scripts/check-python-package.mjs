import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const packageRoot = path.join(root, "python", "agentlens-trace");
const packageSrc = path.join(packageRoot, "src");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-python-package-"));
const pycache = path.join(tmp, "pycache");
const traceFile = path.join(tmp, "python-package-demo.json");
const bin = path.join(root, "bin", "agentlens.js");
const evalConfig = path.join(root, "evals", "default.json");

function pythonCandidates() {
  if (process.env.PYTHON) return [[process.env.PYTHON, []]];
  return process.platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
}

function findPython() {
  for (const [command, baseArgs] of pythonCandidates()) {
    const result = spawnSync(command, [...baseArgs, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (result.status === 0) return [command, baseArgs];
  }
  throw new Error("Python 3.8+ is required for npm run python:package");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONPATH: [
        packageSrc,
        process.env.PYTHONPATH
      ].filter(Boolean).join(path.delimiter),
      PYTHONPYCACHEPREFIX: pycache
    }
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }
  return result;
}

const pyproject = fs.readFileSync(path.join(packageRoot, "pyproject.toml"), "utf8");
for (const snippet of [
  'name = "agentlens-trace"',
  'version = "0.2.0"',
  'requires-python = ">=3.8"'
]) {
  if (!pyproject.includes(snippet)) throw new Error(`pyproject.toml missing ${snippet}`);
}

const [pythonCommand, pythonBaseArgs] = findPython();
run(pythonCommand, [
  ...pythonBaseArgs,
  "-m",
  "py_compile",
  path.join(packageSrc, "agentlens_trace", "__init__.py"),
  path.join(packageSrc, "agentlens_trace", "__main__.py"),
  path.join(packageSrc, "agentlens_trace", "adapters", "__init__.py")
]);
run(pythonCommand, [
  ...pythonBaseArgs,
  "-c",
  "from agentlens_trace import AgentLensRun, TRACE_SCHEMA_VERSION, trace_async_llm_call, trace_llm_call; from agentlens_trace.adapters import AgentLensCrewAIBridge, AgentLensLangChainBridge, AgentLensLlamaIndexBridge; assert TRACE_SCHEMA_VERSION == 'agentlens.trace.v1'; run = AgentLensRun(); AgentLensLangChainBridge(run).on_retriever_start({'name': 'retriever'}, 'query'); assert AgentLensLlamaIndexBridge; assert AgentLensCrewAIBridge; assert trace_async_llm_call; assert trace_llm_call"
]);
run(pythonCommand, [...pythonBaseArgs, "-m", "agentlens_trace", "--out", traceFile], { stdio: "inherit" });
run(process.execPath, [bin, "validate", "trace", traceFile], { stdio: "inherit" });
run(process.execPath, [bin, "eval", traceFile, "--config", evalConfig], { stdio: "inherit" });
run(process.execPath, [bin, "scan", traceFile], { stdio: "inherit" });

console.log(`Python package smoke trace: ${traceFile}`);
