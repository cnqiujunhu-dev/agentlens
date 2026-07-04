import { makeId } from "./core/ids.js";

export const TRACE_SCHEMA_VERSION = "agentlens.trace.v1";

export function createRun({ app = "agentlens-demo", name = "untitled run", metadata = {} } = {}) {
  return {
    schemaVersion: TRACE_SCHEMA_VERSION,
    runId: makeId("run"),
    app,
    name,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: "running",
    metadata,
    events: []
  };
}

export function addEvent(run, event) {
  if (!run || !Array.isArray(run.events)) {
    throw new Error("Cannot add event to an invalid trace run");
  }

  const normalized = {
    id: event.id ?? makeId("evt"),
    ts: event.ts ?? new Date().toISOString(),
    type: event.type ?? "note",
    status: event.status ?? "ok"
  };

  for (const [key, value] of Object.entries(event)) {
    if (value !== undefined && !(key in normalized)) {
      normalized[key] = value;
    }
  }

  run.events.push(normalized);
  return normalized;
}

export function finishRun(run, status = "passed") {
  run.endedAt = run.endedAt ?? new Date().toISOString();
  run.status = status;
  return run;
}

export function validateTrace(trace) {
  const errors = [];

  if (!trace || typeof trace !== "object") errors.push("trace must be an object");
  if (trace?.schemaVersion !== TRACE_SCHEMA_VERSION) errors.push(`schemaVersion must be ${TRACE_SCHEMA_VERSION}`);
  if (!trace?.runId) errors.push("runId is required");
  if (!trace?.startedAt) errors.push("startedAt is required");
  if (!Array.isArray(trace?.events)) errors.push("events must be an array");

  for (const [index, event] of (trace?.events ?? []).entries()) {
    if (!event.id) errors.push(`events[${index}].id is required`);
    if (!event.ts) errors.push(`events[${index}].ts is required`);
    if (!event.type) errors.push(`events[${index}].type is required`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
