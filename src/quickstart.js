import path from "node:path";
import { writeRunBundle } from "./bundle.js";
import { formatCiMarkdown, formatCiPrComment, runCi } from "./ci.js";
import { renderDashboard } from "./dashboard.js";
import { createDemoRun } from "./demo.js";
import { evaluateTrace, formatEvalReport, loadEvalConfig } from "./eval.js";
import { writeOtelTrace } from "./otel.js";
import { formatScanReport, scanTrace } from "./scan.js";
import { writeShareBundle } from "./share.js";
import { ensureDir, initWorkspace, readTrace, writeText, writeTrace } from "./store.js";

const DEFAULT_SECTIONS = "summary,scan,tool-calls,filters,timeline";

function toDisplayPath(filePath, root) {
  return path.relative(root, filePath).replaceAll(path.sep, "/") || ".";
}

export function runQuickstart({
  root = process.cwd(),
  python = false,
  sections = DEFAULT_SECTIONS,
  scanFailOnSeverity = "high"
} = {}) {
  const workspace = initWorkspace(root, { scaffold: true, python });
  const quickstartDir = path.join(workspace.root, "quickstart");
  const runsDir = path.join(quickstartDir, "runs");
  const reportsDir = path.join(quickstartDir, "reports");
  const shareDir = path.join(quickstartDir, "share", "demo");
  const bundleDir = path.join(reportsDir, "bundle");
  const configPath = path.join(workspace.evalsDir, "default.json");

  ensureDir(runsDir);
  ensureDir(reportsDir);

  const traceFile = path.join(runsDir, "demo.json");
  const dashboardFile = path.join(reportsDir, "dashboard.html");
  const evalFile = path.join(reportsDir, "eval.txt");
  const scanFile = path.join(reportsDir, "scan.txt");
  const ciSummaryFile = path.join(reportsDir, "ci-summary.md");
  const prCommentFile = path.join(reportsDir, "pr-comment.md");
  const otelFile = path.join(reportsDir, "trace.otlp.json");

  writeTrace(traceFile, createDemoRun());
  const trace = readTrace(traceFile);
  const evalConfig = loadEvalConfig(configPath);
  const evalReport = evaluateTrace(trace, evalConfig);
  const scanReport = scanTrace(trace, { failOnSeverity: scanFailOnSeverity });
  const ciReport = runCi({
    runsDir,
    config: evalConfig,
    scan: true,
    scanFailOnSeverity
  });
  const bundle = writeRunBundle({ runsDir, outDir: bundleDir, sections });
  const share = writeShareBundle({ traceFile, outDir: shareDir, configPath, sections });
  const otel = writeOtelTrace({ traceFile, out: otelFile });

  writeText(dashboardFile, renderDashboard(trace, { sections }));
  writeText(evalFile, `${formatEvalReport(evalReport)}\n`);
  writeText(scanFile, `${formatScanReport(scanReport)}\n`);
  writeText(ciSummaryFile, `${formatCiMarkdown(ciReport)}\n`);
  writeText(prCommentFile, `${formatCiPrComment(ciReport)}\n`);

  return {
    workspace,
    quickstartDir,
    runsDir,
    reportsDir,
    status: {
      passed: evalReport.passed && scanReport.passed && ciReport.failed === 0 && ciReport.total > 0,
      eval: evalReport.passed,
      scan: scanReport.passed,
      ci: ciReport.failed === 0 && ciReport.total > 0
    },
    files: {
      trace: traceFile,
      dashboard: dashboardFile,
      eval: evalFile,
      scan: scanFile,
      ciSummary: ciSummaryFile,
      prComment: prCommentFile,
      otel: otelFile,
      bundleIndex: bundle.index,
      bundleManifest: bundle.manifest,
      shareSummary: share.files.summary,
      shareDashboard: share.files.dashboard
    },
    createdFiles: workspace.createdFiles,
    bundle,
    share,
    otel
  };
}

export function formatQuickstartReport(result, { root = process.cwd() } = {}) {
  const status = result.status.passed ? "PASS" : "FAIL";
  const lines = [
    "AgentLens Quickstart",
    `Status: ${status}`,
    `Workspace: ${toDisplayPath(result.workspace.root, root)}`,
    `Artifact pack: ${toDisplayPath(result.quickstartDir, root)}`,
    "",
    "Generated files:",
    `- Trace: ${toDisplayPath(result.files.trace, root)}`,
    `- Dashboard: ${toDisplayPath(result.files.dashboard, root)}`,
    `- Eval report: ${toDisplayPath(result.files.eval, root)}`,
    `- Scan report: ${toDisplayPath(result.files.scan, root)}`,
    `- CI summary: ${toDisplayPath(result.files.ciSummary, root)}`,
    `- PR comment: ${toDisplayPath(result.files.prComment, root)}`,
    `- OTLP JSON: ${toDisplayPath(result.files.otel, root)}`,
    `- Run bundle: ${toDisplayPath(result.files.bundleIndex, root)}`,
    `- Share bundle: ${toDisplayPath(result.files.shareSummary, root)}`,
    "",
    "Next commands:",
    `agentlens serve ${toDisplayPath(result.runsDir, root)}`,
    `agentlens ci --runs ${toDisplayPath(result.runsDir, root)} --config ${toDisplayPath(path.join(result.workspace.evalsDir, "default.json"), root)} --scan`
  ];

  if (result.createdFiles.length > 0) {
    lines.push("", "Starter files:");
    for (const file of result.createdFiles) lines.push(`- ${toDisplayPath(file, root)}`);
  }

  return lines.join("\n");
}
