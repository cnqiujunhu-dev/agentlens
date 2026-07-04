import fs from "node:fs";
import path from "node:path";
import { evaluateTrace } from "./eval.js";
import { scanTrace, SEVERITY_ORDER } from "./scan.js";
import { readTrace } from "./store.js";

function walkJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsonFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

export function discoverTraceFiles(runsDir) {
  return walkJsonFiles(runsDir);
}

function blockingScanFindings(scanReport) {
  if (!scanReport) return [];
  if (scanReport.failOnSeverity === "none") return [];
  const threshold = SEVERITY_ORDER[scanReport.failOnSeverity] ?? SEVERITY_ORDER.high;
  return scanReport.findings.filter((finding) => SEVERITY_ORDER[finding.severity] >= threshold);
}

export function runCi({ runsDir = ".agentlens/runs", config, scan = false, scanFailOnSeverity = "high" }) {
  const files = discoverTraceFiles(runsDir);
  const results = [];

  for (const file of files) {
    try {
      const trace = readTrace(file);
      const report = evaluateTrace(trace, config);
      const scanReport = scan ? scanTrace(trace, { failOnSeverity: scanFailOnSeverity }) : null;
      const passed = report.passed && (!scanReport || scanReport.passed);
      results.push({
        file,
        traceId: trace.runId,
        name: trace.name,
        passed,
        report,
        ...(scanReport ? { scanReport } : {})
      });
    } catch (error) {
      results.push({
        file,
        traceId: null,
        name: null,
        passed: false,
        error: error.message
      });
    }
  }

  return {
    runsDir,
    scan: {
      enabled: Boolean(scan),
      failOnSeverity: scanFailOnSeverity
    },
    total: results.length,
    passed: results.filter((result) => result.passed).length,
    failed: results.filter((result) => !result.passed).length,
    results
  };
}

export function formatCiReport(summary) {
  const lines = [
    `AgentLens CI`,
    `Runs: ${summary.runsDir}`,
    `Status: ${summary.failed === 0 ? "PASS" : "FAIL"}`,
    `Total: ${summary.total}, Passed: ${summary.passed}, Failed: ${summary.failed}`,
    `Scan: ${summary.scan?.enabled ? `enabled, fail on ${summary.scan.failOnSeverity}` : "disabled"}`,
    ""
  ];

  if (summary.total === 0) {
    lines.push("No trace files found.");
    return lines.join("\n");
  }

  for (const result of summary.results) {
    lines.push(`[${result.passed ? "PASS" : "FAIL"}] ${result.file}`);

    if (result.error) {
      lines.push(`  error: ${result.error}`);
      continue;
    }

    lines.push(`  trace: ${result.traceId}`);
    lines.push(`  name: ${result.name}`);

    for (const assertion of result.report.results.filter((item) => !item.passed)) {
      lines.push(`  failed: ${assertion.id} - ${assertion.message}`);
    }

    if (result.scanReport) {
      lines.push(`  scan: ${result.scanReport.passed ? "PASS" : "FAIL"} (${result.scanReport.summary.findings} findings)`);
      for (const finding of blockingScanFindings(result.scanReport)) {
        lines.push(`  scan failed: [${finding.severity.toUpperCase()}] ${finding.ruleId} - ${finding.message} at ${finding.path}`);
      }
    }
  }

  return lines.join("\n");
}

function escapeMarkdownCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\r", " ")
    .replaceAll("\n", " ");
}

function failedAssertions(result) {
  if (result.error) return [result.error];
  const evalFailures = (result.report?.results ?? [])
    .filter((item) => !item.passed)
    .map((item) => `${item.id}: ${item.message}`);
  const scanFailures = blockingScanFindings(result.scanReport).map(
    (finding) => `scan/${finding.ruleId}: [${finding.severity}] ${finding.message} at ${finding.path}`
  );
  return [...evalFailures, ...scanFailures];
}

export function formatCiMarkdown(summary) {
  const status = summary.failed === 0 && summary.total > 0 ? "PASS" : "FAIL";
  const lines = [
    "## AgentLens CI",
    "",
    `**Status:** ${status}`,
    `**Runs:** \`${escapeMarkdownCell(summary.runsDir)}\``,
    `**Total:** ${summary.total} | **Passed:** ${summary.passed} | **Failed:** ${summary.failed}`,
    `**Scan:** ${summary.scan?.enabled ? `enabled, fail on ${summary.scan.failOnSeverity}` : "disabled"}`,
    ""
  ];

  if (summary.total === 0) {
    lines.push("No trace files found.");
    return lines.join("\n");
  }

  lines.push("| Trace | Status | Failures |");
  lines.push("| --- | --- | --- |");

  for (const result of summary.results) {
    const failures = failedAssertions(result);
    lines.push(`| \`${escapeMarkdownCell(result.file)}\` | ${result.passed ? "PASS" : "FAIL"} | ${failures.length > 0 ? escapeMarkdownCell(failures.join("; ")) : "none"} |`);
  }

  return lines.join("\n");
}
