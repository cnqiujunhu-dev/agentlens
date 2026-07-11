import path from "node:path";
import { fileURLToPath } from "node:url";
import { createLangGraphRun, wrapLangGraphNode } from "../src/adapters/langgraph.js";
import { createMcpRun, finishMcpRun, traceMcpToolCall } from "../src/adapters/mcp.js";
import { traceMcpStdioToolCall } from "../src/adapters/mcp-stdio.js";
import { renderDashboard } from "../src/dashboard.js";
import { createDemoRun } from "../src/demo.js";
import { evaluateTrace, formatEvalReport, loadEvalConfig } from "../src/eval.js";
import { JsonlTraceWriter, readJsonlTrace } from "../src/jsonl.js";
import { ensureDir, initWorkspace, writeText, writeTrace } from "../src/store.js";
import { addEvent, finishRun } from "../src/trace.js";

const launchDir = ".agentlens/launch";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mcpStdioServerPath = path.resolve(__dirname, "../examples/mcp-stdio-server.mjs");
initWorkspace(process.cwd());
ensureDir(launchDir);

function writeEvalReport(filePath, trace, configPath) {
  const report = evaluateTrace(trace, loadEvalConfig(configPath));
  writeText(filePath, formatEvalReport(report));
  return report;
}

const supportTrace = createDemoRun();
writeTrace(`${launchDir}/support-agent.json`, supportTrace);
writeText(`${launchDir}/support-agent.html`, renderDashboard(supportTrace));
writeText(`${launchDir}/support-agent-workflow.html`, renderDashboard(supportTrace, { sections: ["workflow", "timeline"] }));
writeEvalReport(`${launchDir}/support-agent.eval.txt`, supportTrace, "evals/default.json");

const mcpTrace = createMcpRun({
  app: "mcp-demo-agent",
  name: "launch demo: MCP policy lookup",
  server: "local-policy-server"
});

addEvent(mcpTrace, {
  type: "llm.prompt",
  name: "planner",
  input: {
    messages: [{ role: "user", content: "Can a damaged item be refunded?" }]
  }
});

const mcpResult = await traceMcpToolCall(
  mcpTrace,
  {
    server: "local-policy-server",
    tool: "policy.lookup",
    input: { topic: "damaged item refund" },
    permission: "read-only"
  },
  async (input) => ({
    topic: input.topic,
    sourceId: "policy-refund-30d",
    text: "Damaged items can be refunded within 30 days with proof of purchase."
  })
);

addEvent(mcpTrace, {
  type: "llm.response",
  name: "final-answer",
  output: {
    content: `Refund is available: ${mcpResult.text}`,
    citations: [mcpResult.sourceId]
  }
});

finishMcpRun(mcpTrace, "passed");
writeTrace(`${launchDir}/mcp-policy.json`, mcpTrace);
writeText(`${launchDir}/mcp-policy.html`, renderDashboard(mcpTrace));
writeEvalReport(`${launchDir}/mcp-policy.eval.txt`, mcpTrace, "evals/mcp-policy.json");

const mcpStdioTrace = createMcpRun({
  app: "mcp-stdio-demo-agent",
  name: "launch demo: MCP stdio policy lookup",
  server: "agentlens-demo-policy-server"
});

addEvent(mcpStdioTrace, {
  type: "llm.prompt",
  name: "planner",
  input: {
    messages: [{ role: "user", content: "Can a damaged item be refunded?" }]
  }
});

const mcpStdioResult = await traceMcpStdioToolCall(mcpStdioTrace, {
  command: process.execPath,
  args: [mcpStdioServerPath],
  server: "agentlens-demo-policy-server",
  tool: "policy.lookup",
  input: { topic: "damaged item refund" },
  permission: "read-only"
});

addEvent(mcpStdioTrace, {
  type: "llm.response",
  name: "final-answer",
  output: {
    content: `Refund is available: ${mcpStdioResult.structuredContent.text}`,
    citations: [mcpStdioResult.structuredContent.sourceId]
  }
});

finishMcpRun(mcpStdioTrace, "passed");
writeTrace(`${launchDir}/mcp-stdio.json`, mcpStdioTrace);
writeText(`${launchDir}/mcp-stdio.html`, renderDashboard(mcpStdioTrace));
writeEvalReport(`${launchDir}/mcp-stdio.eval.txt`, mcpStdioTrace, "evals/mcp-policy.json");

const langGraphTrace = createLangGraphRun({
  app: "langgraph-style-demo",
  name: "launch demo: LangGraph-style support flow",
  graph: "support-refund-flow"
});

const plannerNode = wrapLangGraphNode(langGraphTrace, "planner", async (state) => ({
  ...state,
  steps: [...(state.steps ?? []), "lookup-refund-policy"],
  messages: [
    ...(state.messages ?? []),
    { role: "assistant", content: "I should look up refund policy before answering." }
  ]
}));
const responderNode = wrapLangGraphNode(langGraphTrace, "responder", async (state) => ({
  ...state,
  final: {
    content: "Damaged items can be refunded within 30 days with proof of purchase.",
    citations: ["policy-refund-30d"]
  },
  messages: [
    ...(state.messages ?? []),
    { role: "assistant", content: "Damaged items can be refunded within 30 days with proof of purchase." }
  ]
}));

let graphState = {
  messages: [{ role: "user", content: "Can I refund a damaged item?" }],
  steps: []
};
graphState = await plannerNode(graphState);
graphState = await responderNode(graphState);
finishRun(langGraphTrace, "passed");
writeTrace(`${launchDir}/langgraph-style.json`, langGraphTrace);
writeText(`${launchDir}/langgraph-style.html`, renderDashboard(langGraphTrace));
writeEvalReport(`${launchDir}/langgraph-style.eval.txt`, langGraphTrace, "evals/langgraph-basic.json");

const failingTrace = createDemoRun();
failingTrace.app = "unsafe-agent";
failingTrace.name = "launch demo: unsafe tool call";
addEvent(failingTrace, {
  type: "tool.call",
  name: "delete_database",
  input: { table: "customers" },
  metadata: { permission: "write" }
});
addEvent(failingTrace, {
  type: "tool.result",
  name: "delete_database",
  status: "error",
  output: { message: "Blocked by policy" }
});
finishRun(failingTrace, "failed");
writeTrace(`${launchDir}/unsafe-agent.json`, failingTrace);
writeText(`${launchDir}/unsafe-agent.html`, renderDashboard(failingTrace));
writeEvalReport(`${launchDir}/unsafe-agent.eval.txt`, failingTrace, "evals/default.json");

const jsonlWriter = new JsonlTraceWriter(`${launchDir}/streaming-agent.jsonl`, {
  app: "streaming-agent",
  name: "launch demo: JSONL streaming"
});
jsonlWriter.addEvent({ type: "llm.prompt", name: "planner" });
jsonlWriter.addEvent({
  type: "llm.response",
  name: "final-answer",
  output: { content: "Streaming trace captured.", citations: ["stream-doc"] }
});
jsonlWriter.finish("passed");
const jsonlTrace = readJsonlTrace(`${launchDir}/streaming-agent.jsonl`);
writeTrace(`${launchDir}/streaming-agent.json`, jsonlTrace);
writeEvalReport(`${launchDir}/streaming-agent.eval.txt`, jsonlTrace, "evals/default.json");

console.log(`Launch demo artifacts written to ${launchDir}`);
console.log(`- ${launchDir}/support-agent.html`);
console.log(`- ${launchDir}/support-agent-workflow.html`);
console.log(`- ${launchDir}/mcp-policy.html`);
console.log(`- ${launchDir}/mcp-stdio.html`);
console.log(`- ${launchDir}/langgraph-style.html`);
console.log(`- ${launchDir}/unsafe-agent.html`);
console.log(`- ${launchDir}/streaming-agent.jsonl`);
