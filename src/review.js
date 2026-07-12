import path from "node:path";
import { writeRunBundle } from "./bundle.js";
import { formatCiMarkdown, formatCiPrComment, formatCiReport, formatCiSarif, runCi } from "./ci.js";
import { compareTraces, formatTraceDiff } from "./diff.js";
import { renderDiffDashboard } from "./diff-dashboard.js";
import { loadEvalConfig } from "./eval.js";
import { ensureDir, readTrace, writeJson, writeText, writeTrace } from "./store.js";

const DEFAULT_SECTIONS = "summary,scan,tool-calls,workflow,filters,timeline";
const REVIEW_MANIFEST_SCHEMA = "agentlens.review.v1";

function toDisplayPath(filePath, root) {
  return path.relative(root, filePath).replaceAll(path.sep, "/") || ".";
}

function formatReviewCommand(result, root) {
  const args = [
    "agentlens",
    "review",
    toDisplayPath(result.inputs.baselineFile, root),
    toDisplayPath(result.inputs.candidateFile, root),
    "--config",
    toDisplayPath(result.inputs.configPath, root),
    "--out",
    toDisplayPath(result.outDir, root)
  ];

  if (result.options.scan) {
    args.push("--scan-fail-on", result.options.scanFailOnSeverity);
  } else {
    args.push("--no-scan");
  }
  args.push("--sections", result.options.sections);
  if (result.links.artifactUrl) args.push("--artifact-url", result.links.artifactUrl);
  if (result.links.sarifUrl) args.push("--sarif-url", result.links.sarifUrl);

  return args.join(" ");
}

function formatReviewReadme(result, { root = process.cwd() } = {}) {
  const lines = [
    "# AgentLens Review Pack",
    "",
    `Status: ${result.status.passed ? "PASS" : "FAIL"}`,
    `Baseline: \`${toDisplayPath(result.inputs.baselineFile, root)}\``,
    `Candidate: \`${toDisplayPath(result.inputs.candidateFile, root)}\``,
    `Eval config: \`${toDisplayPath(result.inputs.configPath, root)}\``,
    "",
    "## Provenance",
    "",
    `- Generated at: ${result.generatedAt}`,
    `- Scan: ${result.options.scan ? "enabled" : "disabled"}`,
    `- Scan fail on: ${result.options.scanFailOnSeverity}`,
    `- Dashboard sections: \`${result.options.sections}\``,
    "",
    "## Files",
    "",
    "- `runs/baseline.json`: copied baseline trace.",
    "- `runs/candidate.json`: copied candidate trace.",
    "- `eval.json`: copied eval policy used for this review.",
    "- `review.json`: machine-readable review manifest for automation.",
    "- `reports/ci-summary.md`: Markdown summary suitable for `GITHUB_STEP_SUMMARY`.",
    "- `reports/pr-comment.md`: stable PR comment body with the `agentlens-ci-comment` marker.",
    "- `reports/ci-report.txt`: plain text CI report.",
    "- `reports/diff.txt`: before/after trace diff.",
    "- `reports/diff.html`: static before/after diff dashboard.",
    "- `reports/bundle/index.html`: static run bundle for reviewer handoff."
  ];

  if (result.files.sarif) {
    lines.push("- `reports/agentlens-ci.sarif`: SARIF scan results for GitHub code scanning.");
  }

  if (result.links.artifactUrl || result.links.sarifUrl) {
    lines.push("", "## Uploaded Links", "");
    if (result.links.artifactUrl) lines.push(`- Artifact URL: ${result.links.artifactUrl}`);
    if (result.links.sarifUrl) lines.push(`- SARIF URL: ${result.links.sarifUrl}`);
  }

  lines.push("", "## Diff Regressions", "");
  if (result.diff.regressions.length === 0) {
    lines.push("None detected by the trace diff summary.");
  } else {
    for (const regression of result.diff.regressions) lines.push(`- ${regression}`);
  }

  lines.push(
    "",
    "## Re-run",
    "",
    "```bash",
    formatReviewCommand(result, root),
    "```"
  );

  return `${lines.join("\n")}\n`;
}

function countWorkflowRegressions(workflowDeltas = {}) {
  return (
    Number((workflowDeltas.chains ?? 0) < 0) +
    Number((workflowDeltas.tasks ?? 0) < 0) +
    Number((workflowDeltas.errors ?? 0) > 0)
  );
}

function summarizeCiResults(results = []) {
  return results.map((result) => ({
    file: result.file,
    traceId: result.traceId,
    name: result.name,
    passed: result.passed,
    error: result.error ?? null,
    eval: result.report
      ? {
          total: result.report.results.length,
          passed: result.report.results.filter((item) => item.passed).length,
          failed: result.report.results.filter((item) => !item.passed).length
        }
      : null,
    scan: result.scanReport
      ? {
          passed: result.scanReport.passed,
          findings: result.scanReport.summary.findings,
          failOnSeverity: result.scanReport.failOnSeverity
        }
      : null
  }));
}

function buildReviewManifest(result) {
  const workflowDeltas = result.diff.deltas.workflow ?? {};
  return {
    schemaVersion: REVIEW_MANIFEST_SCHEMA,
    generatedAt: result.generatedAt,
    options: { ...result.options },
    links: { ...result.links },
    status: { ...result.status },
    inputs: { ...result.inputs },
    files: { ...result.files },
    summary: {
      ci: {
        total: result.ciReport.total,
        passed: result.ciReport.passed,
        failed: result.ciReport.failed,
        scan: result.ciReport.scan,
        results: summarizeCiResults(result.ciReport.results)
      },
      diff: {
        regressions: result.diff.regressions,
        workflow: {
          baseline: { ...result.diff.baseline.workflow },
          candidate: { ...result.diff.candidate.workflow },
          deltas: { ...workflowDeltas },
          rows: result.diff.workflow.map((row) => ({ ...row })),
          regressions: countWorkflowRegressions(workflowDeltas)
        }
      },
      bundle: {
        total: result.bundle.total,
        valid: result.bundle.valid,
        invalid: result.bundle.invalid,
        index: result.bundle.index,
        manifest: result.bundle.manifest
      }
    }
  };
}

export function writeReviewBundle({
  baselineFile,
  candidateFile,
  outDir = path.join(".agentlens", "review"),
  configPath = "evals/default.json",
  scan = true,
  scanFailOnSeverity = "high",
  sections = DEFAULT_SECTIONS,
  artifactUrl = undefined,
  sarifUrl = undefined
} = {}) {
  if (!baselineFile || !candidateFile) throw new Error("writeReviewBundle requires baselineFile and candidateFile");

  const baseline = readTrace(baselineFile);
  const candidate = readTrace(candidateFile);
  const evalConfig = loadEvalConfig(configPath);
  const runsDir = path.join(outDir, "runs");
  const reportsDir = path.join(outDir, "reports");
  const bundleDir = path.join(reportsDir, "bundle");
  const copiedBaselineFile = path.join(runsDir, "baseline.json");
  const copiedCandidateFile = path.join(runsDir, "candidate.json");
  const copiedConfigFile = path.join(outDir, "eval.json");

  ensureDir(runsDir);
  ensureDir(reportsDir);
  writeTrace(copiedBaselineFile, baseline);
  writeTrace(copiedCandidateFile, candidate);
  writeJson(copiedConfigFile, evalConfig);

  const ciReport = runCi({
    runsDir,
    config: evalConfig,
    scan,
    scanFailOnSeverity
  });
  const diff = compareTraces(baseline, candidate);
  const bundle = writeRunBundle({ runsDir, outDir: bundleDir, sections });
  const generatedAt = new Date().toISOString();
  const status = {
    passed: ciReport.failed === 0 && ciReport.total > 0,
    ci: ciReport.failed === 0 && ciReport.total > 0,
    diffRegressions: diff.regressions.length
  };

  const files = {
    baseline: copiedBaselineFile,
    candidate: copiedCandidateFile,
    evalConfig: copiedConfigFile,
    ciSummary: path.join(reportsDir, "ci-summary.md"),
    prComment: path.join(reportsDir, "pr-comment.md"),
    ciReport: path.join(reportsDir, "ci-report.txt"),
    diffText: path.join(reportsDir, "diff.txt"),
    diffDashboard: path.join(reportsDir, "diff.html"),
    sarif: scan ? path.join(reportsDir, "agentlens-ci.sarif") : null,
    bundleIndex: bundle.index,
    bundleManifest: bundle.manifest,
    manifest: path.join(outDir, "review.json"),
    readme: path.join(outDir, "README.md")
  };

  writeText(files.ciSummary, `${formatCiMarkdown(ciReport, { diff })}\n`);
  writeText(
    files.prComment,
    `${formatCiPrComment(ciReport, {
      artifactUrl,
      sarifUrl,
      diff
    })}\n`
  );
  writeText(files.ciReport, `${formatCiReport(ciReport)}\n`);
  writeText(files.diffText, `${formatTraceDiff(diff)}\n`);
  writeText(files.diffDashboard, renderDiffDashboard(diff));
  if (files.sarif) writeJson(files.sarif, formatCiSarif(ciReport));

  const result = {
    outDir,
    runsDir,
    reportsDir,
    generatedAt,
    options: {
      scan,
      scanFailOnSeverity,
      sections
    },
    links: {
      artifactUrl: artifactUrl ?? null,
      sarifUrl: sarifUrl ?? null
    },
    inputs: {
      baselineFile,
      candidateFile,
      configPath
    },
    status,
    files,
    ciReport,
    diff,
    bundle,
    manifest: null
  };

  result.manifest = buildReviewManifest(result);
  writeJson(files.manifest, result.manifest);
  writeText(files.readme, formatReviewReadme(result));

  return result;
}

export function formatReviewReport(result, { root = process.cwd() } = {}) {
  const lines = [
    "AgentLens Review",
    `Status: ${result.status.passed ? "PASS" : "FAIL"}`,
    `Baseline: ${toDisplayPath(result.inputs.baselineFile, root)}`,
    `Candidate: ${toDisplayPath(result.inputs.candidateFile, root)}`,
    `Artifact pack: ${toDisplayPath(result.outDir, root)}`,
    `Diff regressions: ${result.status.diffRegressions}`,
    "",
    "Generated files:",
    `- CI summary: ${toDisplayPath(result.files.ciSummary, root)}`,
    `- PR comment: ${toDisplayPath(result.files.prComment, root)}`,
    `- Diff report: ${toDisplayPath(result.files.diffText, root)}`,
    `- Diff dashboard: ${toDisplayPath(result.files.diffDashboard, root)}`,
    `- Run bundle: ${toDisplayPath(result.files.bundleIndex, root)}`,
    `- Review manifest: ${toDisplayPath(result.files.manifest, root)}`,
    `- README: ${toDisplayPath(result.files.readme, root)}`
  ];

  if (result.files.sarif) lines.push(`- SARIF: ${toDisplayPath(result.files.sarif, root)}`);

  lines.push("", "Review result:");
  if (result.ciReport.failed === 0 && result.ciReport.total > 0) {
    lines.push("- CI gates passed for copied traces.");
  } else {
    lines.push(`- CI gates failed: ${result.ciReport.failed}/${result.ciReport.total} trace(s).`);
  }
  if (result.diff.regressions.length === 0) {
    lines.push("- No diff regressions detected.");
  } else {
    for (const regression of result.diff.regressions) lines.push(`- ${regression}`);
  }

  return lines.join("\n");
}
