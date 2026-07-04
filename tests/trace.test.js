import test from "node:test";
import assert from "node:assert/strict";
import { addEvent, createRun, finishRun, TRACE_SCHEMA_VERSION, validateTrace } from "../src/trace.js";

test("createRun returns a valid empty trace", () => {
  const run = createRun({ app: "unit-agent", name: "trace test" });
  const result = validateTrace(run);

  assert.equal(run.schemaVersion, TRACE_SCHEMA_VERSION);
  assert.equal(run.app, "unit-agent");
  assert.equal(run.name, "trace test");
  assert.equal(run.status, "running");
  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
});

test("addEvent normalizes required event fields", () => {
  const run = createRun();
  const event = addEvent(run, {
    type: "tool.call",
    name: "kb.search",
    input: { query: "refund policy" }
  });

  assert.match(event.id, /^evt_/);
  assert.equal(event.type, "tool.call");
  assert.equal(event.status, "ok");
  assert.equal(run.events.length, 1);
  assert.deepEqual(event.input, { query: "refund policy" });
});

test("finishRun preserves an existing endedAt timestamp", () => {
  const run = createRun();
  run.endedAt = "2026-01-01T00:00:00.000Z";

  finishRun(run, "failed");

  assert.equal(run.endedAt, "2026-01-01T00:00:00.000Z");
  assert.equal(run.status, "failed");
});

test("validateTrace reports malformed events", () => {
  const result = validateTrace({
    schemaVersion: TRACE_SCHEMA_VERSION,
    runId: "run_bad",
    startedAt: "2026-01-01T00:00:00.000Z",
    events: [{ id: "evt_missing_type", ts: "2026-01-01T00:00:00.001Z" }]
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.includes("events[0].type is required"));
});
