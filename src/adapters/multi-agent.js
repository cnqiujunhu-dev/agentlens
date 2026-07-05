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

function compactSummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { type: typeof value };
  const summary = { keys: Object.keys(value) };
  if (Array.isArray(value.messages)) summary.messages = value.messages.length;
  if (Array.isArray(value.tasks)) summary.tasks = value.tasks.length;
  if (Array.isArray(value.artifacts)) summary.artifacts = value.artifacts.length;
  if (Array.isArray(value.toolCalls)) summary.toolCalls = value.toolCalls.length;
  return summary;
}

function frameworkMetadata({ framework, workflow, agent, role, metadata = {} }) {
  return {
    adapter: "multi-agent",
    framework,
    workflow,
    agent,
    role,
    ...metadata
  };
}

export function createMultiAgentRun({
  app = "multi-agent",
  name = "multi-agent run",
  framework = "multi-agent",
  workflow = undefined,
  metadata = {}
} = {}) {
  return createRun({
    app,
    name,
    metadata: {
      adapter: "multi-agent",
      framework,
      workflow,
      ...metadata
    }
  });
}

export function addAgentMessage(run, { agent, role = "assistant", content = undefined, input = undefined, output = undefined, framework, workflow, metadata = {} } = {}) {
  if (!run) throw new Error("addAgentMessage requires a run");
  if (!agent) throw new Error("addAgentMessage requires an agent");

  const eventOutput =
    output ??
    {
      role,
      content
    };

  return addEvent(run, {
    type: "agent.message",
    name: agent,
    input,
    output: eventOutput,
    metadata: frameworkMetadata({
      framework: framework ?? run.metadata?.framework ?? "multi-agent",
      workflow: workflow ?? run.metadata?.workflow,
      agent,
      role,
      metadata
    })
  });
}

export async function traceAgentTask(run, task, execute) {
  if (!run) throw new Error("traceAgentTask requires a run");
  if (!task?.agent) throw new Error("traceAgentTask requires task.agent");
  if (!task?.name) throw new Error("traceAgentTask requires task.name");
  if (typeof execute !== "function") throw new Error("traceAgentTask requires an execute function");

  const input = task.input ?? {};
  const metadata = frameworkMetadata({
    framework: task.framework ?? run.metadata?.framework ?? "multi-agent",
    workflow: task.workflow ?? run.metadata?.workflow,
    agent: task.agent,
    role: task.role,
    metadata: {
      task: task.name,
      inputSummary: compactSummary(input),
      ...(task.metadata ?? {})
    }
  });
  const startedAtMs = Date.now();

  addEvent(run, {
    type: "agent.task.start",
    name: task.name,
    input,
    metadata
  });

  try {
    const output = await execute(input);
    addEvent(run, {
      type: "agent.task.end",
      name: task.name,
      durationMs: durationSince(startedAtMs),
      output,
      metadata: {
        ...metadata,
        outputSummary: compactSummary(output)
      }
    });
    return output;
  } catch (error) {
    const normalized = normalizeError(error);
    addEvent(run, {
      type: "agent.task.end",
      name: task.name,
      status: "error",
      durationMs: durationSince(startedAtMs),
      output: normalized,
      metadata
    });
    addEvent(run, {
      type: "error",
      name: `${metadata.framework}.${task.agent}.${task.name}`,
      status: "error",
      output: normalized,
      metadata
    });
    throw error;
  }
}
