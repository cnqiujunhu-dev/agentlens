import { addEvent, createRun, finishRun } from "../trace.js";

function now() {
  return new Date().toISOString();
}

function durationSince(startedAtMs) {
  return Math.max(0, Date.now() - startedAtMs);
}

function normalizeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack
  };
}

export function createMcpRun({ app = "mcp-agent", name = "mcp tool run", server, metadata = {} } = {}) {
  return createRun({
    app,
    name,
    metadata: {
      adapter: "mcp",
      server,
      ...metadata
    }
  });
}

export async function traceMcpToolCall(run, call, execute) {
  if (!run) throw new Error("traceMcpToolCall requires a run");
  if (!call?.tool) throw new Error("traceMcpToolCall requires call.tool");
  if (typeof execute !== "function") throw new Error("traceMcpToolCall requires an execute function");

  const startedAtMs = Date.now();
  const metadata = {
    adapter: "mcp",
    protocol: "mcp",
    server: call.server,
    permission: call.permission ?? "unknown",
    ...(call.metadata ?? {})
  };

  addEvent(run, {
    ts: now(),
    type: "tool.call",
    name: call.tool,
    input: call.input ?? {},
    metadata
  });

  try {
    const output = await execute(call.input ?? {});
    addEvent(run, {
      ts: now(),
      type: "tool.result",
      name: call.tool,
      status: "ok",
      durationMs: durationSince(startedAtMs),
      output,
      metadata
    });
    return output;
  } catch (error) {
    const normalized = normalizeError(error);
    addEvent(run, {
      ts: now(),
      type: "tool.result",
      name: call.tool,
      status: "error",
      durationMs: durationSince(startedAtMs),
      output: normalized,
      metadata
    });
    addEvent(run, {
      ts: now(),
      type: "error",
      name: `mcp.${call.tool}`,
      status: "error",
      output: normalized,
      metadata
    });
    throw error;
  }
}

export function finishMcpRun(run, status = "passed") {
  return finishRun(run, status);
}
