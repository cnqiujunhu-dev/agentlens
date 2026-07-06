import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const packageRoot = path.join(root, "python", "agentlens-trace");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-python-publish-"));
const installDir = path.join(tmp, "site");
const pycache = path.join(tmp, "pycache");
const traceFile = path.join(tmp, "python-installed-package-demo.json");
const adaptersTraceFile = path.join(tmp, "python-installed-adapters-demo.json");
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
  throw new Error("Python 3.8+ is required for npm run python:publish:check");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...(options.env ?? {}),
      PYTHONPYCACHEPREFIX: pycache
    }
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }
  return result;
}

function runPythonInstall(command, args, fallbackArgs) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONPYCACHEPREFIX: pycache
    }
  });
  if (result.status === 0) return;

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (output.includes("setuptools.build_meta") || output.includes("BackendUnavailable")) {
    console.log("Python build backend unavailable without isolation; retrying with standard PEP 517 build isolation.");
    run(command, fallbackArgs, { stdio: "inherit" });
    return;
  }

  throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
}

function assertTextIncludes(file, text, snippets) {
  for (const snippet of snippets) {
    if (!text.includes(snippet)) throw new Error(`${file} missing ${snippet}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const pyproject = fs.readFileSync(path.join(packageRoot, "pyproject.toml"), "utf8");
assertTextIncludes("pyproject.toml", pyproject, [
  'name = "agentlens-trace"',
  `version = "${packageJson.version}"`,
  'readme = "README.md"',
  'requires-python = ">=3.8"',
  'license = { text = "Apache-2.0" }',
  'Homepage = "https://github.com/cnqiujunhu-dev/agentlens"',
  'Documentation = "https://github.com/cnqiujunhu-dev/agentlens/blob/main/docs/PYTHON_TRACE_WRITER.md"',
  'Issues = "https://github.com/cnqiujunhu-dev/agentlens/issues"',
  '[tool.setuptools.packages.find]',
  'where = ["src"]'
]);

const readme = fs.readFileSync(path.join(packageRoot, "README.md"), "utf8");
assertTextIncludes("python/agentlens-trace/README.md", readme, [
  "agentlens-trace",
  "agentlens_trace",
  "agentlens_trace.adapters",
  "AgentLensLangChainBridge",
  "python -m agentlens_trace.adapters",
  "Runtime dependencies: none"
]);

const [pythonCommand, pythonBaseArgs] = findPython();
run(pythonCommand, [...pythonBaseArgs, "-m", "pip", "--version"]);
runPythonInstall(
  pythonCommand,
  [
    ...pythonBaseArgs,
    "-m",
    "pip",
    "install",
    "--no-deps",
    "--no-build-isolation",
    "--disable-pip-version-check",
    "--target",
    installDir,
    packageRoot
  ],
  [
    ...pythonBaseArgs,
    "-m",
    "pip",
    "install",
    "--no-deps",
    "--disable-pip-version-check",
    "--target",
    installDir,
    packageRoot
  ]
);

const distInfoDir = fs.readdirSync(installDir).find((entry) => /^agentlens_trace-.*\.dist-info$/u.test(entry));
if (!distInfoDir) throw new Error("Installed package is missing agentlens_trace dist-info directory");

const metadata = fs.readFileSync(path.join(installDir, distInfoDir, "METADATA"), "utf8");
assertTextIncludes("METADATA", metadata, [
  "Name: agentlens-trace",
  `Version: ${packageJson.version}`,
  "Requires-Python: >=3.8"
]);

const record = fs.readFileSync(path.join(installDir, distInfoDir, "RECORD"), "utf8");
assertTextIncludes("RECORD", record, [
  "agentlens_trace/__init__.py",
  "agentlens_trace/__main__.py",
  "agentlens_trace/adapters/__init__.py",
  "agentlens_trace/adapters/__main__.py"
]);

const pythonEnv = {
  PYTHONPATH: [
    installDir,
    process.env.PYTHONPATH
  ].filter(Boolean).join(path.delimiter)
};

run(pythonCommand, [
  ...pythonBaseArgs,
  "-c",
  "from agentlens_trace import AgentLensRun, TRACE_SCHEMA_VERSION; from agentlens_trace.adapters import AgentLensCrewAIBridge, AgentLensLangChainBridge, AgentLensLlamaIndexBridge; assert TRACE_SCHEMA_VERSION == 'agentlens.trace.v1'; assert AgentLensRun; assert AgentLensLangChainBridge; assert AgentLensLlamaIndexBridge; assert AgentLensCrewAIBridge"
], { env: pythonEnv });

run(pythonCommand, [...pythonBaseArgs, "-m", "agentlens_trace", "--out", traceFile], { env: pythonEnv, stdio: "inherit" });
run(process.execPath, [bin, "validate", "trace", traceFile], { stdio: "inherit" });
run(process.execPath, [bin, "eval", traceFile, "--config", evalConfig], { stdio: "inherit" });
run(process.execPath, [bin, "scan", traceFile], { stdio: "inherit" });

run(pythonCommand, [...pythonBaseArgs, "-m", "agentlens_trace.adapters", "--out", adaptersTraceFile], { env: pythonEnv, stdio: "inherit" });
run(process.execPath, [bin, "validate", "trace", adaptersTraceFile], { stdio: "inherit" });
run(process.execPath, [bin, "eval", adaptersTraceFile, "--config", evalConfig], { stdio: "inherit" });
run(process.execPath, [bin, "scan", adaptersTraceFile], { stdio: "inherit" });

console.log(`Python publish install trace: ${traceFile}`);
console.log(`Python publish adapters trace: ${adaptersTraceFile}`);
