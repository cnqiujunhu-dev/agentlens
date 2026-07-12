#!/usr/bin/env node

import process from "node:process";
import path from "node:path";
import { createDemoRun } from "../src/demo.js";
import { formatSummary, summarizeTrace } from "../src/inspect.js";
import { appendText, initWorkspace, readTrace, writeText, writeTrace } from "../src/store.js";

const args = process.argv.slice(2);
const command = args[0] ?? "help";

function usage() {
  return [
    "AgentLens - local-first DevTools for AI agent runs",
    "",
    "Usage:",
    "  agentlens init [--python] [--review]",
    "  agentlens quickstart [--python]",
    "  agentlens doctor [--json]",
    "  agentlens demo [--out path]",
    "  agentlens inspect <trace-file> [--json]",
    "  agentlens replay <trace-file>",
    "  agentlens review <baseline-trace> <candidate-trace> [--config path] [--out dir] [--json] [--no-scan] [--scan-fail-on severity] [--sections summary,event-types,scan,tool-calls,filters,timeline] [--artifact-url url] [--sarif-url url] [--fail-on-failure]",
    "  agentlens diff <baseline-trace> <candidate-trace> [--json]",
    "  agentlens diff-dashboard <baseline-trace> <candidate-trace> [--out path]",
    "  agentlens eval <trace-file> [--config path] [--json]",
    "  agentlens scan <trace-file> [--json] [--fail-on low|medium|high|critical|none] [--sarif path]",
    "  agentlens ci [--runs dir] [--config path] [--json] [--summary-md path] [--pr-comment-md path] [--artifact-url url] [--sarif-url url] [--scan] [--scan-fail-on severity] [--sarif path]",
    "  agentlens otel <trace-file> [--out path] [--service-name name]",
    "  agentlens otel-batch [runs-dir] [--out dir] [--service-name name]",
    "  agentlens schema <trace|eval|review> [--out path]",
    "  agentlens validate <trace|eval|review> <file> [--json]",
    "  agentlens materialize <jsonl-file> [--out path]",
    "  agentlens redact <trace-file> [--out path] [--keys key1,key2]",
    "  agentlens share <trace-file> [--config path] [--out dir] [--keys key1,key2] [--sections summary,event-types,scan,tool-calls,filters,timeline]",
    "  agentlens dashboard <trace-file> [--out path] [--sections summary,event-types,scan,tool-calls,filters,timeline]",
    "  agentlens bundle [runs-dir] [--out dir] [--sections summary,event-types,scan,tool-calls,filters,timeline]",
    "  agentlens serve [trace-file|runs-dir] [--host host] [--port port]",
    "",
    "Examples:",
    "  node ./bin/agentlens.js quickstart --python",
    "  node ./bin/agentlens.js init --python",
    "  node ./bin/agentlens.js doctor",
    "  node ./bin/agentlens.js demo --out .agentlens/runs/demo.json",
    "  node ./bin/agentlens.js review .agentlens/runs/baseline.json .agentlens/runs/candidate.json --config evals/default.json",
    "  node ./bin/agentlens.js diff .agentlens/runs/baseline.json .agentlens/runs/candidate.json",
    "  node ./bin/agentlens.js share .agentlens/runs/demo.json --config evals/default.json",
    "  node ./bin/agentlens.js validate trace .agentlens/runs/demo.json",
    "  node ./bin/agentlens.js scan .agentlens/runs/demo.json",
    "  node ./bin/agentlens.js otel .agentlens/runs/demo.json --out .agentlens/reports/demo.otlp.json",
    "  node ./bin/agentlens.js otel-batch .agentlens/runs --out .agentlens/reports/otel",
    "  node ./bin/agentlens.js eval .agentlens/runs/demo.json --config evals/default.json",
    "  node ./bin/agentlens.js ci --runs .agentlens/runs --config evals/default.json --scan",
    "  node ./bin/agentlens.js bundle .agentlens/runs --out .agentlens/reports/bundle"
  ].join("\n");
}

function option(name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function flag(name) {
  return args.includes(name);
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
    const workspace = initWorkspace(process.cwd(), { scaffold: true, python: flag("--python"), review: flag("--review") });
    console.log(`Initialized AgentLens workspace at ${workspace.root}`);
    console.log(`Runs: ${workspace.runsDir}`);
    console.log(`Reports: ${workspace.reportsDir}`);
    if (flag("--python")) console.log(`Python starter: ${workspace.pythonDir}`);
    if (flag("--review")) console.log(`Review workflow: ${path.join(workspace.examplesDir, "review-github-action.yml")}`);
    if (workspace.createdFiles.length > 0) {
      console.log("Starter files:");
      for (const file of workspace.createdFiles) console.log(`  ${file}`);
    }
    return;
  }

  if (command === "quickstart") {
    const { formatQuickstartReport, runQuickstart } = await import("../src/quickstart.js");
    const result = runQuickstart({
      root: process.cwd(),
      python: flag("--python"),
      sections: option("--sections", undefined),
      scanFailOnSeverity: option("--scan-fail-on", "high")
    });
    console.log(formatQuickstartReport(result, { root: process.cwd() }));
    if (!result.status.passed) process.exitCode = 1;
    return;
  }

  if (command === "doctor") {
    const { doctorWorkspace, formatDoctorReport } = await import("../src/doctor.js");
    const report = doctorWorkspace(process.cwd());
    console.log(flag("--json") ? JSON.stringify(report, null, 2) : formatDoctorReport(report));
    if (!report.passed) process.exitCode = 1;
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
    const summary = summarizeTrace(trace);
    console.log(flag("--json") ? JSON.stringify(summary, null, 2) : formatSummary(summary));
    return;
  }

  if (command === "replay") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens replay <trace-file>");
    const { renderReplay } = await import("../src/replay.js");
    console.log(renderReplay(readTrace(traceFile)));
    return;
  }

  if (command === "review") {
    const baselineFile = positional(1);
    const candidateFile = positional(2);
    if (!baselineFile || !candidateFile) {
      throw new Error("Missing trace files. Usage: agentlens review <baseline-trace> <candidate-trace>");
    }
    const { formatReviewReport, writeReviewBundle } = await import("../src/review.js");
    const result = writeReviewBundle({
      baselineFile,
      candidateFile,
      configPath: option("--config", "evals/default.json"),
      outDir: option("--out", ".agentlens/review"),
      scan: !flag("--no-scan"),
      scanFailOnSeverity: option("--scan-fail-on", "high"),
      sections: option("--sections", undefined),
      artifactUrl: option("--artifact-url", undefined),
      sarifUrl: option("--sarif-url", undefined)
    });
    console.log(flag("--json") ? JSON.stringify(result.manifest, null, 2) : formatReviewReport(result, { root: process.cwd() }));
    if (flag("--fail-on-failure") && !result.status.passed) process.exitCode = 1;
    return;
  }

  if (command === "diff") {
    const baselineFile = positional(1);
    const candidateFile = positional(2);
    if (!baselineFile || !candidateFile) throw new Error("Missing trace files. Usage: agentlens diff <baseline-trace> <candidate-trace>");
    const { compareTraces, formatTraceDiff } = await import("../src/diff.js");
    const diff = compareTraces(readTrace(baselineFile), readTrace(candidateFile));
    console.log(flag("--json") ? JSON.stringify(diff, null, 2) : formatTraceDiff(diff));
    return;
  }

  if (command === "diff-dashboard") {
    const baselineFile = positional(1);
    const candidateFile = positional(2);
    if (!baselineFile || !candidateFile) throw new Error("Missing trace files. Usage: agentlens diff-dashboard <baseline-trace> <candidate-trace>");
    const { compareTraces } = await import("../src/diff.js");
    const { renderDiffDashboard } = await import("../src/diff-dashboard.js");
    const out = option("--out", ".agentlens/reports/agentlens-diff.html");
    const html = renderDiffDashboard(compareTraces(readTrace(baselineFile), readTrace(candidateFile)));
    writeText(out, html);
    console.log(`Wrote diff dashboard: ${out}`);
    return;
  }

  if (command === "eval") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens eval <trace-file>");
    const { evaluateTrace, formatEvalReport, loadEvalConfig } = await import("../src/eval.js");
    const configPath = option("--config", "evals/default.json");
    const report = evaluateTrace(readTrace(traceFile), loadEvalConfig(configPath));
    console.log(flag("--json") ? JSON.stringify(report, null, 2) : formatEvalReport(report));
    if (!report.passed) process.exitCode = 1;
    return;
  }

  if (command === "scan") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens scan <trace-file> [--json] [--fail-on low|medium|high|critical|none] [--sarif path]");
    const { formatScanReport, formatScanSarif, scanTrace } = await import("../src/scan.js");
    const report = scanTrace(readTrace(traceFile), { failOnSeverity: option("--fail-on", "high") });
    const sarifPath = option("--sarif", undefined);
    if (sarifPath) {
      writeText(sarifPath, `${JSON.stringify(formatScanSarif(report, { traceFile }), null, 2)}\n`);
    }
    console.log(flag("--json") ? JSON.stringify(report, null, 2) : formatScanReport(report));
    if (!report.passed) process.exitCode = 1;
    return;
  }

  if (command === "ci") {
    const { formatCiMarkdown, formatCiPrComment, formatCiReport, formatCiSarif, runCi } = await import("../src/ci.js");
    const { loadEvalConfig } = await import("../src/eval.js");
    const runsDir = option("--runs", ".agentlens/runs");
    const configPath = option("--config", "evals/default.json");
    const report = runCi({
      runsDir,
      config: loadEvalConfig(configPath),
      scan: flag("--scan"),
      scanFailOnSeverity: option("--scan-fail-on", "high")
    });
    const summaryMdPath = option("--summary-md", undefined);
    if (summaryMdPath) appendText(summaryMdPath, `${formatCiMarkdown(report)}\n\n`);
    const prCommentMdPath = option("--pr-comment-md", undefined);
    if (prCommentMdPath) {
      writeText(
        prCommentMdPath,
        `${formatCiPrComment(report, {
          artifactUrl: option("--artifact-url", undefined),
          sarifUrl: option("--sarif-url", undefined)
        })}\n`
      );
    }
    const sarifPath = option("--sarif", undefined);
    if (sarifPath) {
      if (!report.scan.enabled) throw new Error("agentlens ci --sarif requires --scan");
      writeText(sarifPath, `${JSON.stringify(formatCiSarif(report), null, 2)}\n`);
    }
    console.log(flag("--json") ? JSON.stringify(report, null, 2) : formatCiReport(report));
    if (report.failed > 0 || report.total === 0) process.exitCode = 1;
    return;
  }

  if (command === "schema") {
    const kind = positional(1);
    if (!kind) throw new Error("Missing schema kind. Usage: agentlens schema <trace|eval|review> [--out path]");
    const { readSchema } = await import("../src/schemas.js");
    const text = `${JSON.stringify(readSchema(kind), null, 2)}\n`;
    const out = option("--out", undefined);
    if (out) {
      writeText(out, text);
      console.log(`Wrote schema: ${out}`);
    } else {
      console.log(text.trimEnd());
    }
    return;
  }

  if (command === "otel") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens otel <trace-file> [--out path] [--service-name name]");
    const { buildOtelTrace, writeOtelTrace } = await import("../src/otel.js");
    const serviceName = option("--service-name", undefined);
    const out = option("--out", undefined);
    if (out) {
      const result = writeOtelTrace({ traceFile, out, serviceName });
      console.log(`Wrote OTel trace: ${result.out}`);
      console.log(`Trace ID: ${result.traceId}`);
      console.log(`Spans: ${result.spans}`);
    } else {
      console.log(JSON.stringify(buildOtelTrace(readTrace(traceFile), { serviceName }), null, 2));
    }
    return;
  }

  if (command === "otel-batch") {
    const { writeOtelBatch } = await import("../src/otel.js");
    const runsDir = positional(1) ?? ".agentlens/runs";
    const result = writeOtelBatch({
      runsDir,
      outDir: option("--out", ".agentlens/reports/otel"),
      serviceName: option("--service-name", undefined)
    });
    console.log(`Wrote OTel batch: ${result.outDir}`);
    console.log(`Manifest: ${result.manifest}`);
    console.log(`Traces: ${result.total}, Exported: ${result.exported}, Invalid: ${result.invalid}, Spans: ${result.spans}`);
    if (result.invalid > 0) process.exitCode = 1;
    return;
  }

  if (command === "validate") {
    const kind = positional(1);
    const file = positional(2);
    if (!kind || !file) throw new Error("Missing validation target. Usage: agentlens validate <trace|eval|review> <file> [--json]");
    const { formatValidationReport, validateArtifact } = await import("../src/validate.js");
    const report = validateArtifact(kind, file);
    console.log(flag("--json") ? JSON.stringify(report, null, 2) : formatValidationReport(report));
    if (!report.valid) process.exitCode = 1;
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

  if (command === "share") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens share <trace-file> [--config path] [--out dir] [--keys key1,key2] [--sections summary,event-types,scan,tool-calls,filters,timeline]");
    const { parseRedactKeys } = await import("../src/redact.js");
    const { writeShareBundle } = await import("../src/share.js");
    const result = writeShareBundle({
      traceFile,
      outDir: option("--out", undefined),
      configPath: option("--config", undefined),
      redactionKeys: parseRedactKeys(option("--keys", undefined)),
      sections: option("--sections", undefined)
    });
    console.log(`Wrote share bundle: ${result.outDir}`);
    for (const file of Object.values(result.files).filter(Boolean)) console.log(`- ${file}`);
    return;
  }

  if (command === "dashboard") {
    const traceFile = positional(1);
    if (!traceFile) throw new Error("Missing trace file. Usage: agentlens dashboard <trace-file>");
    const { renderDashboard } = await import("../src/dashboard.js");
    const out = option("--out", ".agentlens/reports/agentlens-report.html");
    const html = renderDashboard(readTrace(traceFile), { sections: option("--sections", undefined) });
    writeText(out, html);
    console.log(`Wrote dashboard: ${out}`);
    return;
  }

  if (command === "bundle") {
    const { writeRunBundle } = await import("../src/bundle.js");
    const runsDir = positional(1) ?? ".agentlens/runs";
    const result = writeRunBundle({
      runsDir,
      outDir: option("--out", ".agentlens/reports/bundle"),
      sections: option("--sections", undefined)
    });
    console.log(`Wrote run bundle: ${result.outDir}`);
    console.log(`- ${result.index}`);
    console.log(`- ${result.manifest}`);
    for (const file of result.dashboards) console.log(`- ${file}`);
    console.log(`Traces: ${result.total}, Valid: ${result.valid}, Invalid: ${result.invalid}`);
    return;
  }

  if (command === "serve") {
    const target = positional(1) ?? ".agentlens/runs";
    const host = option("--host", "127.0.0.1");
    const port = Number(option("--port", "4317"));
    const { createDashboardServer, listen } = await import("../src/server.js");
    const server = createDashboardServer(target);
    const address = await listen(server, { host, port });
    const actualHost = address.address === "::" ? "localhost" : address.address;
    console.log(`AgentLens dashboard server listening at http://${actualHost}:${address.port}`);
    console.log(`Serving ${target}`);
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`agentlens: ${error.message}`);
  process.exitCode = 1;
});
