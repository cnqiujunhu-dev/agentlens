import fs from "node:fs";
import path from "node:path";
import { evaluateTrace } from "./eval.js";
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

export function runCi({ runsDir = ".agentlens/runs", config }) {
  const files = discoverTraceFiles(runsDir);
  const results = [];

  for (const file of files) {
    try {
      const trace = readTrace(file);
      const report = evaluateTrace(trace, config);
      results.push({
        file,
        traceId: trace.runId,
        name: trace.name,
        passed: report.passed,
        report
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
  return (result.report?.results ?? [])
    .filter((item) => !item.passed)
    .map((item) => `${item.id}: ${item.message}`);
}

export function formatCiMarkdown(summary) {
  const status = summary.failed === 0 && summary.total > 0 ? "PASS" : "FAIL";
  const lines = [
    "## AgentLens CI",
    "",
    `**Status:** ${status}`,
    `**Runs:** \`${escapeMarkdownCell(summary.runsDir)}\``,
    `**Total:** ${summary.total} | **Passed:** ${summary.passed} | **Failed:** ${summary.failed}`,
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
