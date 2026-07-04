import path from "node:path";
import { renderDashboard } from "./dashboard.js";
import { evaluateTrace, formatEvalReport, loadEvalConfig } from "./eval.js";
import { formatSummary, summarizeTrace } from "./inspect.js";
import { redactTrace } from "./redact.js";
import { ensureDir, readTrace, writeText, writeTrace } from "./store.js";

function safeName(value) {
  return String(value || "trace")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "trace";
}

function formatShareSummary({ summary, evalReport }) {
  const lines = [
    "# AgentLens Share Bundle",
    "",
    `Run: \`${summary.runId}\``,
    `App: \`${summary.app}\``,
    `Name: ${summary.name}`,
    `Status: ${summary.status}`,
    `Events: ${summary.eventCount}`,
    `Errors: ${summary.errors}`,
    `Estimated cost: $${summary.totalCostUsd.toFixed(4)}`,
    "",
    "## Inspect Summary",
    "",
    "```text",
    formatSummary(summary),
    "```",
    "",
    "## Files",
    "",
    "- `trace.redacted.json`: redacted AgentLens trace.",
    "- `dashboard.html`: static dashboard rendered from the redacted trace.",
    "- `summary.md`: this share summary."
  ];

  if (evalReport) {
    lines.push("- `eval.txt`: eval report generated from the redacted trace.");
    lines.push("", "## Eval", "", `Status: ${evalReport.passed ? "PASS" : "FAIL"}`);
  }

  lines.push(
    "",
    "## Safety",
    "",
    "This bundle is generated from a redacted trace. Review files manually before attaching them to public issues or pull requests."
  );

  return `${lines.join("\n")}\n`;
}

export function buildShareBundle(trace, { evalConfig = undefined, redactionKeys = undefined } = {}) {
  const redactedTrace = redactTrace(trace, { keys: redactionKeys });
  const summary = summarizeTrace(redactedTrace);
  const evalReport = evalConfig ? evaluateTrace(redactedTrace, evalConfig) : null;

  return {
    redactedTrace,
    dashboardHtml: renderDashboard(redactedTrace),
    summaryMarkdown: formatShareSummary({ summary, evalReport }),
    evalText: evalReport ? `${formatEvalReport(evalReport)}\n` : null,
    evalReport
  };
}

export function writeShareBundle({ traceFile, outDir = undefined, configPath = undefined, redactionKeys = undefined } = {}) {
  if (!traceFile) throw new Error("writeShareBundle requires traceFile");

  const trace = readTrace(traceFile);
  const bundleDir = outDir ?? path.join(".agentlens", "share", safeName(trace.runId));
  const evalConfig = configPath ? loadEvalConfig(configPath) : undefined;
  const bundle = buildShareBundle(trace, { evalConfig, redactionKeys });

  ensureDir(bundleDir);

  const files = {
    trace: path.join(bundleDir, "trace.redacted.json"),
    dashboard: path.join(bundleDir, "dashboard.html"),
    summary: path.join(bundleDir, "summary.md"),
    eval: bundle.evalText ? path.join(bundleDir, "eval.txt") : null
  };

  writeTrace(files.trace, bundle.redactedTrace);
  writeText(files.dashboard, bundle.dashboardHtml);
  writeText(files.summary, bundle.summaryMarkdown);
  if (files.eval) writeText(files.eval, bundle.evalText);

  return {
    outDir: bundleDir,
    files,
    evalPassed: bundle.evalReport ? bundle.evalReport.passed : null
  };
}
