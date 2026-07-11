import { summarizeTrace } from "./inspect.js";

function countValues(values) {
  const counts = new Map();
  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function diffCounts(left = {}, right = {}) {
  const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort((a, b) => a.localeCompare(b));
  return keys.map((key) => ({
    name: key,
    baseline: left[key] ?? 0,
    candidate: right[key] ?? 0,
    delta: (right[key] ?? 0) - (left[key] ?? 0)
  }));
}

function workflowRows(baselineWorkflow = {}, candidateWorkflow = {}) {
  const rows = [
    ["Chain events", "chains"],
    ["Task events", "tasks"],
    ["Workflow errors", "errors"]
  ];
  return rows.map(([name, key]) => ({
    name,
    baseline: baselineWorkflow[key] ?? 0,
    candidate: candidateWorkflow[key] ?? 0,
    delta: (candidateWorkflow[key] ?? 0) - (baselineWorkflow[key] ?? 0)
  }));
}

function delta(candidate, baseline) {
  if (candidate === null || baseline === null) return null;
  return candidate - baseline;
}

function statusRank(status) {
  if (status === "passed") return 0;
  if (status === "running") return 1;
  if (status === "failed") return 2;
  return 1;
}

function regressionSummary(baseline, candidate) {
  const regressions = [];
  const workflow = workflowRows(baseline.workflow, candidate.workflow);
  const workflowErrorDelta = workflow.find((item) => item.name === "Workflow errors")?.delta ?? 0;
  const errorDelta = candidate.errors - baseline.errors;

  if (statusRank(candidate.status) > statusRank(baseline.status)) {
    regressions.push(`status changed from ${baseline.status} to ${candidate.status}`);
  }
  if (candidate.errors > baseline.errors) {
    regressions.push(`errors increased by ${candidate.errors - baseline.errors}`);
  }
  if (workflowErrorDelta > Math.max(errorDelta, 0)) {
    regressions.push(`workflow error markers increased by ${workflowErrorDelta - Math.max(errorDelta, 0)}`);
  }
  for (const row of workflow.filter((item) => item.name !== "Workflow errors" && item.delta < 0)) {
    regressions.push(`${row.name.toLowerCase()} decreased by ${Math.abs(row.delta)}`);
  }
  if (candidate.totalCostUsd > baseline.totalCostUsd) {
    regressions.push(`cost increased by $${(candidate.totalCostUsd - baseline.totalCostUsd).toFixed(4)}`);
  }
  return regressions;
}

export function compareTraces(baselineTrace, candidateTrace) {
  const baseline = summarizeTrace(baselineTrace);
  const candidate = summarizeTrace(candidateTrace);
  const baselineTools = countValues(baseline.tools);
  const candidateTools = countValues(candidate.tools);

  return {
    baseline,
    candidate,
    deltas: {
      eventCount: candidate.eventCount - baseline.eventCount,
      errors: candidate.errors - baseline.errors,
      totalCostUsd: candidate.totalCostUsd - baseline.totalCostUsd,
      totalLlmTokens: candidate.totalLlmTokens - baseline.totalLlmTokens,
      totalKnownDurationMs: candidate.totalKnownDurationMs - baseline.totalKnownDurationMs,
      wallTimeMs: delta(candidate.wallTimeMs, baseline.wallTimeMs),
      workflow: {
        chains: candidate.workflow.chains - baseline.workflow.chains,
        tasks: candidate.workflow.tasks - baseline.workflow.tasks,
        errors: candidate.workflow.errors - baseline.workflow.errors
      }
    },
    workflow: workflowRows(baseline.workflow, candidate.workflow),
    eventTypes: diffCounts(baseline.byType, candidate.byType),
    tools: diffCounts(baselineTools, candidateTools),
    regressions: regressionSummary(baseline, candidate)
  };
}

function formatDelta(value, formatter = String) {
  if (value === null) return "unknown";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${formatter(value)}`;
}

function formatUsdDelta(value) {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toFixed(4)}`;
}

function formatTable(title, rows) {
  const lines = [title];
  if (rows.length === 0) {
    lines.push("  none");
    return lines;
  }

  for (const row of rows) {
    lines.push(`  ${row.name}: ${row.baseline} -> ${row.candidate} (${formatDelta(row.delta)})`);
  }
  return lines;
}

export function formatTraceDiff(diff) {
  const lines = [
    "AgentLens Trace Diff",
    `Baseline: ${diff.baseline.name} (${diff.baseline.runId})`,
    `Candidate: ${diff.candidate.name} (${diff.candidate.runId})`,
    "",
    "Summary:",
    `  Status: ${diff.baseline.status} -> ${diff.candidate.status}`,
    `  Events: ${diff.baseline.eventCount} -> ${diff.candidate.eventCount} (${formatDelta(diff.deltas.eventCount)})`,
    `  Errors: ${diff.baseline.errors} -> ${diff.candidate.errors} (${formatDelta(diff.deltas.errors)})`,
    `  LLM tokens: ${diff.baseline.totalLlmTokens} -> ${diff.candidate.totalLlmTokens} (${formatDelta(diff.deltas.totalLlmTokens)})`,
    `  Cost: $${diff.baseline.totalCostUsd.toFixed(4)} -> $${diff.candidate.totalCostUsd.toFixed(4)} (${formatDelta(diff.deltas.totalCostUsd, formatUsdDelta)})`,
    `  Known duration: ${diff.baseline.totalKnownDurationMs}ms -> ${diff.candidate.totalKnownDurationMs}ms (${formatDelta(diff.deltas.totalKnownDurationMs, (value) => `${value}ms`)})`,
    `  Wall time: ${diff.baseline.wallTimeMs ?? "unknown"}ms -> ${diff.candidate.wallTimeMs ?? "unknown"}ms (${formatDelta(diff.deltas.wallTimeMs, (value) => `${value}ms`)})`,
    ""
  ];

  lines.push(...formatTable("Workflow:", diff.workflow));
  lines.push("");
  lines.push(...formatTable("Event Types:", diff.eventTypes));
  lines.push("");
  lines.push(...formatTable("Tools:", diff.tools));
  lines.push("");
  lines.push("Regressions:");
  if (diff.regressions.length === 0) {
    lines.push("  none detected");
  } else {
    for (const regression of diff.regressions) lines.push(`  ${regression}`);
  }

  return lines.join("\n");
}
