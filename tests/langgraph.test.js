import test from "node:test";
import assert from "node:assert/strict";
import { createLangGraphRun, traceLangGraphNode, wrapLangGraphNode } from "../src/adapters/langgraph.js";
import { finishRun } from "../src/trace.js";

test("traceLangGraphNode records node start and end events", async () => {
  const run = createLangGraphRun({ app: "test", name: "graph", graph: "support" });

  const output = await traceLangGraphNode(
    run,
    { name: "planner", input: { messages: [{ role: "user", content: "refund?" }], steps: [] } },
    async (state) => ({ ...state, steps: ["lookup-policy"] })
  );
  finishRun(run, "passed");

  assert.deepEqual(output.steps, ["lookup-policy"]);
  assert.equal(run.metadata.framework, "langgraph");
  assert.equal(run.events.length, 2);
  assert.equal(run.events[0].type, "framework.node.start");
  assert.equal(run.events[0].metadata.stateSummary.messages, 1);
  assert.equal(run.events[1].type, "framework.node.end");
  assert.equal(run.events[1].metadata.outputSummary.steps, 1);
});

test("traceLangGraphNode records node errors", async () => {
  const run = createLangGraphRun({ app: "test", name: "graph" });

  await assert.rejects(
    () => traceLangGraphNode(run, { name: "responder", input: { messages: [] } }, async () => {
      throw new Error("model unavailable");
    }),
    /model unavailable/
  );

  assert.equal(run.events.length, 3);
  assert.equal(run.events[1].type, "framework.node.end");
  assert.equal(run.events[1].status, "error");
  assert.equal(run.events[2].type, "error");
  assert.equal(run.events[2].name, "langgraph.responder");
});

test("wrapLangGraphNode wraps existing node functions", async () => {
  const run = createLangGraphRun({ app: "test", name: "graph" });
  const node = wrapLangGraphNode(
    run,
    "planner",
    async (state, config) => ({
      ...state,
      configured: config.configurable.threadId
    }),
    { captureConfig: true }
  );

  const output = await node({ messages: [] }, { configurable: { threadId: "thread-1" } });

  assert.equal(output.configured, "thread-1");
  assert.equal(run.events[0].metadata.configurable.threadId, "thread-1");
});
