import test from "node:test";
import assert from "node:assert/strict";
import { compareTraces, formatTraceDiff } from "../src/diff.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

function run(name, status = "passed") {
  const trace = createRun({ app: "diff-test", name });
  addEvent(trace, {
    type: "llm.prompt",
    name: "planner"
  });
  addEvent(trace, {
    type: "llm.response",
    name: "final",
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      costUsd: 0.01
    },
    output: {
      content: "ok",
      citations: ["doc"]
    }
  });
  return finishRun(trace, status);
}

test("compareTraces reports event, cost, and tool deltas", () => {
  const baseline = run("baseline");
  const candidate = run("candidate", "failed");
  addEvent(candidate, {
    type: "tool.call",
    name: "database.delete",
    metadata: { toolRisk: "critical" }
  });
  addEvent(candidate, {
    type: "error",
    name: "blocked",
    status: "error"
  });

  const diff = compareTraces(baseline, candidate);

  assert.equal(diff.deltas.eventCount, 2);
  assert.equal(diff.deltas.errors, 1);
  assert.equal(diff.eventTypes.find((item) => item.name === "tool.call").delta, 1);
  assert.equal(diff.tools.find((item) => item.name === "database.delete").candidate, 1);
  assert.ok(diff.regressions.some((item) => item.includes("status changed")));
});

test("formatTraceDiff renders a readable report", () => {
  const baseline = run("baseline");
  const candidate = run("candidate");
  candidate.events[1].usage.costUsd = 0.005;
  const text = formatTraceDiff(compareTraces(baseline, candidate));

  assert.match(text, /AgentLens Trace Diff/);
  assert.match(text, /Event Types:/);
  assert.match(text, /-\$0\.0050/);
  assert.match(text, /Regressions:/);
});
