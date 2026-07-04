import { addEvent, createRun } from "../trace.js";

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

function stateSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: typeof value };
  const keys = Object.keys(value);
  const summary = { keys };
  if (Array.isArray(value.messages)) summary.messages = value.messages.length;
  if (Array.isArray(value.steps)) summary.steps = value.steps.length;
  if (Array.isArray(value.toolCalls)) summary.toolCalls = value.toolCalls.length;
  return summary;
}

export function createLangGraphRun({ app = "langgraph-agent", name = "langgraph run", graph = undefined, metadata = {} } = {}) {
  return createRun({
    app,
    name,
    metadata: {
      adapter: "langgraph",
      framework: "langgraph",
      graph,
      ...metadata
    }
  });
}

export async function traceLangGraphNode(run, node, execute) {
  if (!run) throw new Error("traceLangGraphNode requires a run");
  if (!node?.name) throw new Error("traceLangGraphNode requires node.name");
  if (typeof execute !== "function") throw new Error("traceLangGraphNode requires an execute function");

  const input = node.input ?? {};
  const metadata = {
    adapter: "langgraph",
    framework: "langgraph",
    node: node.name,
    graph: node.graph,
    stateSummary: stateSummary(input),
    ...(node.metadata ?? {})
  };
  const startedAtMs = Date.now();

  addEvent(run, {
    type: "framework.node.start",
    name: node.name,
    input,
    metadata
  });

  try {
    const output = await execute(input);
    addEvent(run, {
      type: "framework.node.end",
      name: node.name,
      durationMs: durationSince(startedAtMs),
      output,
      metadata: {
        ...metadata,
        outputSummary: stateSummary(output)
      }
    });
    return output;
  } catch (error) {
    const normalized = normalizeError(error);
    addEvent(run, {
      type: "framework.node.end",
      name: node.name,
      status: "error",
      durationMs: durationSince(startedAtMs),
      output: normalized,
      metadata
    });
    addEvent(run, {
      type: "error",
      name: `langgraph.${node.name}`,
      status: "error",
      output: normalized,
      metadata
    });
    throw error;
  }
}

export function wrapLangGraphNode(run, nodeName, execute, options = {}) {
  if (typeof execute !== "function") throw new Error("wrapLangGraphNode requires an execute function");

  return async function wrappedLangGraphNode(state, config) {
    return traceLangGraphNode(
      run,
      {
        name: nodeName,
        input: state,
        graph: options.graph,
        metadata: {
          ...(options.metadata ?? {}),
          configurable: options.captureConfig ? config?.configurable : undefined
        }
      },
      (input) => execute(input, config)
    );
  };
}
