import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMcpRun, finishMcpRun } from "../src/adapters/mcp.js";
import { McpStdioTraceSession, traceMcpStdioToolCall } from "../src/adapters/mcp-stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(__dirname, "../examples/mcp-stdio-server.mjs");

test("traceMcpStdioToolCall records a real stdio JSON-RPC tool call", async () => {
  const run = createMcpRun({
    app: "test-agent",
    name: "stdio success",
    server: "agentlens-demo-policy-server"
  });

  const result = await traceMcpStdioToolCall(run, {
    command: process.execPath,
    args: [serverPath],
    server: "agentlens-demo-policy-server",
    tool: "policy.lookup",
    input: { topic: "damaged item refund" },
    permission: "read-only"
  });

  finishMcpRun(run, "passed");

  assert.equal(result.structuredContent.sourceId, "policy-refund-30d");
  assert.equal(run.events.length, 3);
  assert.equal(run.events[0].type, "mcp.tools");
  assert.equal(run.events[0].output.total, 1);
  assert.equal(run.events[1].type, "tool.call");
  assert.equal(run.events[1].metadata.transport, "stdio");
  assert.equal(run.events[1].metadata.protocolVersion, "2025-06-18");
  assert.equal(run.events[2].type, "tool.result");
  assert.equal(run.events[2].status, "ok");
  assert.equal(run.events[2].metadata.diagnostics.command, process.execPath);
});

test("traceMcpStdioToolCall records JSON-RPC tool errors", async () => {
  const run = createMcpRun({
    app: "test-agent",
    name: "stdio failure",
    server: "agentlens-demo-policy-server"
  });

  await assert.rejects(
    () =>
      traceMcpStdioToolCall(run, {
        command: process.execPath,
        args: [serverPath],
        server: "agentlens-demo-policy-server",
        tool: "missing.tool",
        input: {},
        permission: "read-only"
      }),
    /Unknown tool/
  );

  assert.equal(run.events.length, 4);
  assert.equal(run.events[0].type, "mcp.tools");
  assert.equal(run.events[1].type, "tool.call");
  assert.equal(run.events[2].type, "tool.result");
  assert.equal(run.events[2].status, "error");
  assert.equal(run.events[3].type, "error");
});

test("McpStdioTraceSession reuses one server for multiple traced calls", async () => {
  const run = createMcpRun({
    app: "test-agent",
    name: "stdio session",
    server: "agentlens-demo-policy-server"
  });
  const session = new McpStdioTraceSession(run, {
    command: process.execPath,
    args: [serverPath],
    server: "agentlens-demo-policy-server"
  });

  try {
    await session.initialize();
    const first = await session.callTool("policy.lookup", {
      input: { topic: "damaged item refund" },
      permission: "read-only"
    });
    const second = await session.callTool("policy.lookup", {
      input: { topic: "receipt missing" },
      permission: "read-only"
    });

    assert.equal(first.structuredContent.sourceId, "policy-refund-30d");
    assert.equal(second.structuredContent.sourceId, "policy-refund-30d");
    assert.equal(run.events.length, 5);
    assert.equal(run.events[0].type, "mcp.tools");
    assert.equal(run.events.filter((event) => event.type === "tool.call").length, 2);
    assert.equal(run.events.filter((event) => event.type === "tool.result").length, 2);
    assert.equal(run.events[2].metadata.diagnostics.notificationCount, 0);
    assert.equal(typeof session.diagnostics().pid, "number");
  } finally {
    session.close();
  }
});
