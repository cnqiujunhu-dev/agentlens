import test from "node:test";
import assert from "node:assert/strict";
import {
  addEvent,
  createMcpRun,
  createRun,
  evaluateTrace,
  finishRun,
  JsonlTraceWriter,
  readSchema,
  redactTrace,
  renderReplay,
  summarizeTrace,
  traceAnthropicCompatibleMessage,
  traceLlmCall,
  traceOpenAiCompatibleChat,
  traceMcpToolCall
} from "../src/index.js";

test("public API exports core trace and eval helpers", () => {
  const run = createRun({ app: "api-test", name: "public api" });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  finishRun(run, "passed");

  const summary = summarizeTrace(run);
  const report = evaluateTrace(run, {
    name: "api",
    assertions: [{ id: "citations", type: "required-citations", min: 1 }]
  });

  assert.equal(summary.eventCount, 2);
  assert.equal(report.passed, true);
  assert.match(renderReplay(run), /LLM RESPONSE/);
  assert.equal(redactTrace(run).metadata.redacted, true);
  assert.equal(readSchema("trace").title, "AgentLens Trace v1");
});

test("public API exports streaming and MCP helpers", async () => {
  assert.equal(typeof JsonlTraceWriter, "function");

  const run = createMcpRun({ app: "api-test", name: "mcp api", server: "server" });
  const result = await traceMcpToolCall(
    run,
    { server: "server", tool: "echo", input: { value: "ok" }, permission: "read-only" },
    async (input) => input
  );

  assert.deepEqual(result, { value: "ok" });
  assert.equal(run.events.length, 2);
});

test("public API exports LLM helper", async () => {
  const run = createRun({ app: "api-test", name: "llm api" });

  await traceLlmCall(run, { name: "answer", input: { messages: [] } }, async () => "ok");

  assert.equal(run.events.length, 2);
  assert.equal(run.events[1].output.content, "ok");
  assert.equal(typeof traceOpenAiCompatibleChat, "function");
  assert.equal(typeof traceAnthropicCompatibleMessage, "function");
});
