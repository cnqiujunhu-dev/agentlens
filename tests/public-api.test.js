import test from "node:test";
import assert from "node:assert/strict";
import {
  addEvent,
  compareTraces,
  createLangGraphRun,
  createMcpRun,
  createRun,
  doctorWorkspace,
  evaluateTrace,
  buildShareBundle,
  formatDoctorReport,
  formatTraceDiff,
  finishRun,
  formatCiSarif,
  formatScanReport,
  formatScanSarif,
  JsonlTraceWriter,
  McpStdioTraceSession,
  readSchema,
  redactTrace,
  renderDiffDashboard,
  renderReplay,
  scanTrace,
  scanMcpTools,
  summarizeTrace,
  traceAnthropicCompatibleMessage,
  traceLangGraphNode,
  traceLlmCall,
  traceOpenAiCompatibleChat,
  traceMcpToolCall,
  traceMcpStdioSession,
  validateEvalConfig
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
  const diff = compareTraces(run, run);
  const bundle = buildShareBundle(run);
  const scan = scanTrace(run);
  const ciSarif = formatCiSarif({ results: [{ file: "trace.json", scanReport: scan }] });

  assert.equal(summary.eventCount, 2);
  assert.equal(report.passed, true);
  assert.equal(scan.passed, true);
  assert.equal(validateEvalConfig({ version: "agentlens.eval.v1", name: "api", assertions: [] }).valid, true);
  assert.equal(diff.deltas.eventCount, 0);
  assert.match(bundle.summaryMarkdown, /AgentLens Share Bundle/);
  assert.match(formatTraceDiff(diff), /AgentLens Trace Diff/);
  assert.match(renderDiffDashboard(diff), /AgentLens Trace Diff/);
  assert.match(formatScanReport(scan), /Scan:/);
  assert.equal(formatScanSarif(scan).version, "2.1.0");
  assert.equal(ciSarif.version, "2.1.0");
  assert.match(formatDoctorReport(doctorWorkspace(process.cwd())), /AgentLens Doctor/);
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
  assert.equal(scanMcpTools({ tools: [{ name: "search", permission: "read-only" }] }).tools[0].risk, "low");
  assert.equal(typeof McpStdioTraceSession, "function");
  assert.equal(typeof traceMcpStdioSession, "function");
});

test("public API exports LangGraph-style helpers", async () => {
  const run = createLangGraphRun({ app: "api-test", name: "langgraph api" });
  const output = await traceLangGraphNode(run, { name: "planner", input: { messages: [] } }, async (state) => ({
    ...state,
    planned: true
  }));

  assert.equal(output.planned, true);
  assert.equal(run.events[0].type, "framework.node.start");
  assert.equal(run.events[1].type, "framework.node.end");
});

test("public API exports LLM helper", async () => {
  const run = createRun({ app: "api-test", name: "llm api" });

  await traceLlmCall(run, { name: "answer", input: { messages: [] } }, async () => "ok");

  assert.equal(run.events.length, 2);
  assert.equal(run.events[1].output.content, "ok");
  assert.equal(typeof traceOpenAiCompatibleChat, "function");
  assert.equal(typeof traceAnthropicCompatibleMessage, "function");
});
