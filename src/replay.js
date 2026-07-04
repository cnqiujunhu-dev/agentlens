function deltaMs(trace, event) {
  return Math.max(0, new Date(event.ts).getTime() - new Date(trace.startedAt).getTime());
}

function compact(value, max = 220) {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

function messageLines(messages = []) {
  return messages.map((message) => `    ${message.role}: ${compact(message.content, 180)}`);
}

function formatEvent(trace, event, index) {
  const prefix = `${String(index + 1).padStart(2, "0")} [+${String(deltaMs(trace, event)).padStart(4, " ")}ms]`;
  const name = event.name ? ` ${event.name}` : "";
  const status = event.status && event.status !== "ok" ? ` (${event.status})` : "";

  if (event.type === "llm.prompt") {
    return [
      `${prefix} LLM PROMPT${name}${status}`,
      ...messageLines(event.input?.messages)
    ].join("\n");
  }

  if (event.type === "llm.response") {
    const lines = [`${prefix} LLM RESPONSE${name}${status} ${event.durationMs ?? "?"}ms`];
    if (event.output?.content) lines.push(`    content: ${compact(event.output.content, 260)}`);
    if (event.output?.toolCalls?.length) lines.push(`    toolCalls: ${compact(event.output.toolCalls)}`);
    if (event.output?.citations?.length) lines.push(`    citations: ${event.output.citations.join(", ")}`);
    return lines.join("\n");
  }

  if (event.type === "tool.call") {
    return [
      `${prefix} TOOL CALL${name}${status}`,
      `    input: ${compact(event.input)}`
    ].join("\n");
  }

  if (event.type === "tool.result") {
    return [
      `${prefix} TOOL RESULT${name}${status} ${event.durationMs ?? "?"}ms`,
      `    output: ${compact(event.output)}`
    ].join("\n");
  }

  if (event.type === "retrieval.query") {
    return [
      `${prefix} RETRIEVAL QUERY${name}${status}`,
      `    input: ${compact(event.input)}`
    ].join("\n");
  }

  if (event.type === "retrieval.result") {
    const chunkCount = event.output?.chunks?.length ?? 0;
    return [
      `${prefix} RETRIEVAL RESULT${name}${status} ${event.durationMs ?? "?"}ms`,
      `    chunks: ${chunkCount}`,
      `    output: ${compact(event.output)}`
    ].join("\n");
  }

  if (event.type === "error") {
    return [
      `${prefix} ERROR${name}${status}`,
      `    ${compact(event.output ?? event.error ?? event.message)}`
    ].join("\n");
  }

  return [
    `${prefix} ${event.type.toUpperCase()}${name}${status}`,
    `    ${compact(event.output ?? event.input ?? event.metadata)}`
  ].join("\n");
}

export function renderReplay(trace) {
  const lines = [
    `Replay: ${trace.runId}`,
    `App: ${trace.app}`,
    `Name: ${trace.name}`,
    `Status: ${trace.status}`,
    ""
  ];

  trace.events.forEach((event, index) => {
    lines.push(formatEvent(trace, event, index));
  });

  return lines.join("\n");
}
