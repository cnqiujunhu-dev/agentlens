export function summarizeTrace(trace) {
  const byType = new Map();
  const tools = [];
  const workflow = {
    chains: 0,
    tasks: 0,
    errors: 0
  };
  let errors = 0;
  let totalCostUsd = 0;
  let totalLlmTokens = 0;
  let totalKnownDurationMs = 0;

  for (const event of trace.events) {
    const type = String(event.type ?? "");
    byType.set(type, (byType.get(type) ?? 0) + 1);

    if (type === "error" || event.status === "error") errors += 1;
    if (type.startsWith("chain.")) workflow.chains += 1;
    if (type.startsWith("agent.task.")) workflow.tasks += 1;
    if (type === "error" || event.status === "error" || type.endsWith(".error")) workflow.errors += 1;
    if (type === "tool.call") tools.push(event.name ?? "unnamed-tool");
    if (typeof event.durationMs === "number") totalKnownDurationMs += event.durationMs;
    if (typeof event.usage?.costUsd === "number") totalCostUsd += event.usage.costUsd;
    if (typeof event.usage?.inputTokens === "number") totalLlmTokens += event.usage.inputTokens;
    if (typeof event.usage?.outputTokens === "number") totalLlmTokens += event.usage.outputTokens;
  }

  const wallTimeMs =
    trace.startedAt && trace.endedAt
      ? Math.max(0, new Date(trace.endedAt).getTime() - new Date(trace.startedAt).getTime())
      : null;

  return {
    runId: trace.runId,
    app: trace.app,
    name: trace.name,
    status: trace.status,
    startedAt: trace.startedAt,
    endedAt: trace.endedAt,
    wallTimeMs,
    eventCount: trace.events.length,
    byType: Object.fromEntries([...byType.entries()].sort(([a], [b]) => a.localeCompare(b))),
    tools,
    workflow,
    errors,
    totalCostUsd,
    totalLlmTokens,
    totalKnownDurationMs
  };
}

export function formatSummary(summary) {
  const workflow = summary.workflow ?? { chains: 0, tasks: 0, errors: 0 };
  const lines = [
    `Run: ${summary.runId}`,
    `App: ${summary.app}`,
    `Name: ${summary.name}`,
    `Status: ${summary.status}`,
    `Events: ${summary.eventCount}`,
    `Wall time: ${summary.wallTimeMs ?? "unknown"} ms`,
    `Known event duration: ${summary.totalKnownDurationMs} ms`,
    `LLM tokens: ${summary.totalLlmTokens}`,
    `Estimated cost: $${summary.totalCostUsd.toFixed(4)}`,
    `Errors: ${summary.errors}`,
    `Workflow: ${workflow.chains} chain events, ${workflow.tasks} task events, ${workflow.errors} workflow errors`,
    "",
    "Events by type:"
  ];

  for (const [type, count] of Object.entries(summary.byType)) {
    lines.push(`  ${type}: ${count}`);
  }

  lines.push("", "Tools:");
  if (summary.tools.length === 0) {
    lines.push("  none");
  } else {
    for (const tool of summary.tools) lines.push(`  ${tool}`);
  }

  return lines.join("\n");
}
