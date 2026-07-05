import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

const traceNames = [
  "python-langchain-style-demo.json",
  "python-llamaindex-style-demo.json",
  "python-crewai-style-demo.json"
];

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function pythonCandidates() {
  if (process.env.PYTHON) return [[process.env.PYTHON, []]];
  return process.platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONPATH: [
        path.join(root, "examples"),
        process.env.PYTHONPATH
      ].filter(Boolean).join(path.delimiter)
    }
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${commandArgs.join(" ")} failed\n${output}`);
  }
  return result;
}

function findPython() {
  for (const [command, baseArgs] of pythonCandidates()) {
    const result = spawnSync(command, [...baseArgs, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (result.status === 0) return [command, baseArgs];
  }
  throw new Error("Python 3.8+ is required for npm run demo:python:frameworks");
}

const outDir = path.resolve(process.cwd(), option("--out-dir", ".agentlens/runs"));
const otelDir = path.resolve(process.cwd(), option("--otel-dir", ".agentlens/reports"));
const [pythonCommand, pythonBaseArgs] = findPython();
const example = path.join(root, "examples", "python-framework-cookbook-run.py");
const bin = path.join(root, "bin", "agentlens.js");
const evalConfig = path.join(root, "evals", "default.json");

run(pythonCommand, [...pythonBaseArgs, example, "--out-dir", outDir], { stdio: "inherit" });

for (const name of traceNames) {
  const traceFile = path.join(outDir, name);
  const otelFile = path.join(otelDir, name.replace(/\.json$/u, ".otlp.json"));
  run(process.execPath, [bin, "validate", "trace", traceFile], { stdio: "inherit" });
  run(process.execPath, [bin, "eval", traceFile, "--config", evalConfig], { stdio: "inherit" });
  run(process.execPath, [bin, "scan", traceFile], { stdio: "inherit" });
  run(process.execPath, [bin, "otel", traceFile, "--out", otelFile], { stdio: "inherit" });
  console.log(`Python framework demo OTLP JSON: ${otelFile}`);
}
