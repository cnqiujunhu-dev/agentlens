import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function pythonCandidates() {
  if (process.env.PYTHON) return [[process.env.PYTHON, []]];
  const common = process.platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
  return common;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONPATH: [
        path.join(root, "python", "agentlens-trace", "src"),
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
  throw new Error("Python 3.8+ is required for npm run demo:python");
}

const out = path.resolve(process.cwd(), option("--out", ".agentlens/runs/python-basic-demo.json"));
const asyncOut = path.resolve(process.cwd(), option("--async-out", ".agentlens/runs/python-async-demo.json"));
const otelOut = path.resolve(process.cwd(), option("--otel-out", ".agentlens/reports/python-basic-demo.otlp.json"));
const asyncOtelOut = path.resolve(process.cwd(), option("--async-otel-out", ".agentlens/reports/python-async-demo.otlp.json"));
const [pythonCommand, pythonBaseArgs] = findPython();
const syncExample = path.join(root, "examples", "python-basic-run.py");
const asyncExample = path.join(root, "examples", "python-async-run.py");
const bin = path.join(root, "bin", "agentlens.js");
const evalConfig = path.join(root, "evals", "default.json");

function verifyTrace(traceFile, traceOtelOut) {
  run(process.execPath, [bin, "validate", "trace", traceFile], { stdio: "inherit" });
  run(process.execPath, [bin, "eval", traceFile, "--config", evalConfig], { stdio: "inherit" });
  run(process.execPath, [bin, "scan", traceFile], { stdio: "inherit" });
  run(process.execPath, [bin, "otel", traceFile, "--out", traceOtelOut], { stdio: "inherit" });
}

run(pythonCommand, [...pythonBaseArgs, syncExample, "--out", out], { stdio: "inherit" });
verifyTrace(out, otelOut);

console.log(`Python demo OTLP JSON: ${otelOut}`);

run(pythonCommand, [...pythonBaseArgs, asyncExample, "--out", asyncOut], { stdio: "inherit" });
verifyTrace(asyncOut, asyncOtelOut);

console.log(`Python async demo OTLP JSON: ${asyncOtelOut}`);
