#!/usr/bin/env node

import process from "node:process";
import { createDemoRun } from "../src/demo.js";
import { formatSummary, summarizeTrace } from "../src/inspect.js";
import { initWorkspace, readTrace, writeText, writeTrace } from "../src/store.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function usage() {
  return [
    "AgentLens - local-first DevTools for AI agent runs",
    "",
    "Usage:",
    "  agentlens init",
    "  agentlens demo [--out path]",
    "  agentlens inspect <trace-file>",
    "  agentlens replay <trace-file>",
    "  agentlens eval <trace-file> [--config path]",
    "  agentlens ci [--runs dir] [--config path]",
    "  agentlens materialize <jsonl-file> [--out path]",
    "  agentlens redact <trace-file> [--out path] [--keys key1,key2]",
    "  agentlens dashboard <trace-file> [--out path]",
    "",
    "Examples:",
    "  node ./bin/agentlens.js demo --out .agentlens/runs/demo.json",
    "  node ./bin/agentlens.js eval .agentlens/runs/demo.json --config evals/default.json",
    "  node ./bin/agentlens.js ci --runs .agentlens/runs --config evals/default.json"
  ].join("\n");
}

function option(name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function positional(index) {
  return args[index];
}

async function main() {
  if (command === "help" || command === "--help" || command === "-h") {
    console.log(usage());
    return;
  }

  if (command === "init") {
    const workspace = initWorkspace(process.cwd());
    console.log(`Initialized AgentLens workspace at ${workspace.root}`);
    console.log(`Runs: ${workspace.runsDir}`);
    console.log(`Reports: ${workspace.reportsDir}`);
    return;
  }

  if (command === "demo") {
    initWorkspace(process.cwd());
    const out = option("--out", ".agentlens/runs/demo.json");
    const run = createDemoRun();
    writeTrace(out, run);
    console.log(`Wrote demo trace: ${out}`);
    return;
  }

  if (command === "inspect") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens inspect <trace-file>");
    const trace = readTrace(traceFile);
    console.log(formatSummary(summarizeTrace(trace)));
    return;
  }

  if (command === "replay") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens replay <trace-file>");
    const { renderReplay } = await import("../src/replay.js");
    console.log(renderReplay(readTrace(traceFile)));
    return;
  }

  if (command === "eval") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens eval <trace-file>");
    const { evaluateTrace, formatEvalReport, loadEvalConfig } = await import("../src/eval.js");
    const configPath = option("--config", "evals/default.json");
    const report = evaluateTrace(readTrace(traceFile), loadEvalConfig(configPath));
    console.log(formatEvalReport(report));
    if (!report.passed) process.exitCode = 1;
    return;
  }

  if (command === "ci") {
    const { formatCiReport, runCi } = await import("../src/ci.js");
    const { loadEvalConfig } = await import("../src/eval.js");
    const runsDir = option("--runs", ".agentlens/runs");
    const configPath = option("--config", "evals/default.json");
    const report = runCi({ runsDir, config: loadEvalConfig(configPath) });
    console.log(formatCiReport(report));
    if (report.failed > 0 || report.total === 0) process.exitCode = 1;
    return;
  }

  if (command === "materialize") {
    const jsonlFile = positional(1);
    if (!jsonlFile) throw new Error("Missing JSONL file. Usage: agentlens materialize <jsonl-file> [--out path]");
    const { readJsonlTrace } = await import("../src/jsonl.js");
    const out = option("--out", jsonlFile.replace(/\.jsonl$/i, ".json"));
    writeTrace(out, readJsonlTrace(jsonlFile));
    console.log(`Wrote materialized trace: ${out}`);
    return;
  }

  if (command === "redact") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens redact <trace-file> [--out path] [--keys key1,key2]");
    const { parseRedactKeys, redactTrace } = await import("../src/redact.js");
    const out = option("--out", traceFile.replace(/\.json$/i, ".redacted.json"));
    const keys = parseRedactKeys(option("--keys", undefined));
    writeTrace(out, redactTrace(readTrace(traceFile), { keys }));
    console.log(`Wrote redacted trace: ${out}`);
    return;
  }

  if (command === "dashboard") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens dashboard <trace-file>");
    const { renderDashboard } = await import("../src/dashboard.js");
    const out = option("--out", ".agentlens/reports/agentlens-report.html");
    const html = renderDashboard(readTrace(traceFile));
    writeText(out, html);
    console.log(`Wrote dashboard: ${out}`);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`agentlens: ${error.message}`);
  process.exitCode = 1;
});
