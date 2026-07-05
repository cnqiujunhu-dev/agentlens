import test from "node:test";
import assert from "node:assert/strict";
import { addAgentMessage, createMultiAgentRun, traceAgentTask } from "../src/adapters/multi-agent.js";
import { finishRun } from "../src/trace.js";

test("addAgentMessage records multi-agent messages", () => {
  const run = createMultiAgentRun({ app: "test", name: "chat", framework: "autogen", workflow: "planner-reviewer" });

  const event = addAgentMessage(run, {
    agent: "planner",
    content: "I will search policy first.",
    metadata: { turn: 1 }
  });

  assert.equal(run.metadata.framework, "autogen");
  assert.equal(event.type, "agent.message");
  assert.equal(event.name, "planner");
  assert.equal(event.output.content, "I will search policy first.");
  assert.equal(event.metadata.adapter, "multi-agent");
  assert.equal(event.metadata.workflow, "planner-reviewer");
  assert.equal(event.metadata.turn, 1);
});

test("traceAgentTask records task start and end events", async () => {
  const run = createMultiAgentRun({ app: "test", name: "crew", framework: "crewai" });

  const output = await traceAgentTask(
    run,
    {
      agent: "researcher",
      role: "researcher",
      name: "lookup-policy",
      input: { messages: [{ role: "user", content: "refund?" }] }
    },
    async (input) => ({ answer: "Refund within 30 days.", messages: input.messages })
  );
  finishRun(run, "passed");

  assert.equal(output.answer, "Refund within 30 days.");
  assert.equal(run.events.length, 2);
  assert.equal(run.events[0].type, "agent.task.start");
  assert.equal(run.events[0].metadata.agent, "researcher");
  assert.equal(run.events[0].metadata.inputSummary.messages, 1);
  assert.equal(run.events[1].type, "agent.task.end");
  assert.equal(run.events[1].metadata.outputSummary.messages, 1);
});

test("traceAgentTask records task errors", async () => {
  const run = createMultiAgentRun({ app: "test", name: "crew", framework: "crewai" });

  await assert.rejects(
    () => traceAgentTask(run, { agent: "reviewer", name: "review-answer" }, async () => {
      throw new Error("missing citation");
    }),
    /missing citation/
  );

  assert.equal(run.events.length, 3);
  assert.equal(run.events[1].type, "agent.task.end");
  assert.equal(run.events[1].status, "error");
  assert.equal(run.events[2].type, "error");
  assert.equal(run.events[2].name, "crewai.reviewer.review-answer");
});
