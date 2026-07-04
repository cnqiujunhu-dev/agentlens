import test from "node:test";
import assert from "node:assert/strict";
import { compareTraces } from "../src/diff.js";
import { renderDiffDashboard } from "../src/diff-dashboard.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

function makeTrace(name, status = "passed") {
  const run = createRun({ app: "diff-dashboard-test", name });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, status);
}

test("renderDiffDashboard renders static diff HTML", () => {
  const baseline = makeTrace("<baseline>");
  const candidate = makeTrace("candidate", "failed");
  addEvent(candidate, { type: "error", name: "failure", status: "error" });

  const html = renderDiffDashboard(compareTraces(baseline, candidate));

  assert.match(html, /AgentLens Trace Diff/);
  assert.match(html, /Regressions/);
  assert.match(html, /Event Types/);
  assert.match(html, /Tools/);
  assert.equal(html.includes("<baseline>"), false);
  assert.match(html, /&lt;baseline&gt;/);
});
