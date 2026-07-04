import test from "node:test";
import assert from "node:assert/strict";
import { addMcpToolManifest, createMcpRun, finishMcpRun, scanMcpTools, traceMcpToolCall } from "../src/adapters/mcp.js";

test("traceMcpToolCall records successful MCP-style tool calls", async () => {
  const run = createMcpRun({ app: "unit", name: "mcp success", server: "test-server" });

  const output = await traceMcpToolCall(
    run,
    {
      server: "test-server",
      tool: "kb.search",
      input: { query: "refund" },
      permission: "read-only",
      toolSchema: {
        type: "object",
        properties: {
          query: { type: "string" }
        }
      }
    },
    async (input) => ({ hits: [{ id: "doc-1", query: input.query }] })
  );

  finishMcpRun(run, "passed");

  assert.equal(output.hits[0].id, "doc-1");
  assert.equal(run.metadata.adapter, "mcp");
  assert.equal(run.events[0].type, "tool.call");
  assert.equal(run.events[0].metadata.toolRisk, "medium");
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

test("scanMcpTools classifies MCP tool risk", () => {
  const scan = scanMcpTools({
    server: "test-server",
    tools: [
      {
        name: "policy.lookup",
        description: "Read policy text.",
        permission: "read-only",
        inputSchema: { type: "object", properties: { topic: { type: "string" } } }
      },
      {
        name: "database.delete",
        description: "Delete rows from a database.",
        inputSchema: { type: "object", properties: { sql: { type: "string" } } }
      }
    ]
  });

  assert.equal(scan.total, 2);
  assert.equal(scan.tools[0].risk, "low");
  assert.equal(scan.tools[1].risk, "critical");
  assert.equal(scan.riskCounts.low, 1);
  assert.equal(scan.riskCounts.critical, 1);
});

test("addMcpToolManifest records tool inventory events", () => {
  const run = createMcpRun({ app: "unit", name: "manifest", server: "test-server" });
  const manifest = addMcpToolManifest(run, {
    server: "test-server",
    tools: [{ name: "policy.lookup", description: "Read policy text.", permission: "read-only" }]
  });

  assert.equal(manifest.total, 1);
  assert.equal(run.events[0].type, "mcp.tools");
  assert.equal(run.events[0].output.tools[0].risk, "low");
});
