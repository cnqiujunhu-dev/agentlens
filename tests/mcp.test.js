import test from "node:test";
import assert from "node:assert/strict";
import { createMcpRun, finishMcpRun, traceMcpToolCall } from "../src/adapters/mcp.js";

test("traceMcpToolCall records successful MCP-style tool calls", async () => {
  const run = createMcpRun({ app: "unit", name: "mcp success", server: "test-server" });

  const output = await traceMcpToolCall(
    run,
    {
      server: "test-server",
      tool: "kb.search",
      input: { query: "refund" },
      permission: "read-only"
    },
    async (input) => ({ hits: [{ id: "doc-1", query: input.query }] })
  );

  finishMcpRun(run, "passed");

  assert.equal(output.hits[0].id, "doc-1");
  assert.equal(run.metadata.adapter, "mcp");
  assert.equal(run.events[0].type, "tool.call");
  assert.equal(run.events[1].type, "tool.result");
  assert.equal(run.events[1].metadata.server, "test-server");
});

test("traceMcpToolCall records result and error events on failure", async () => {
  const run = createMcpRun({ app: "unit", name: "mcp failure", server: "test-server" });

  await assert.rejects(
    () =>
      traceMcpToolCall(
        run,
        {
          server: "test-server",
          tool: "danger.run",
          input: { command: "delete" },
          permission: "write"
        },
        async () => {
          throw new Error("blocked");
        }
      ),
    /blocked/
  );

  assert.equal(run.events.length, 3);
  assert.equal(run.events[1].type, "tool.result");
  assert.equal(run.events[1].status, "error");
  assert.equal(run.events[2].type, "error");
});
