import { createMcpRun, finishMcpRun, traceMcpToolCall } from "../src/adapters/mcp.js";
import { renderDashboard } from "../src/dashboard.js";
import { createDemoRun } from "../src/demo.js";
import { evaluateTrace, formatEvalReport, loadEvalConfig } from "../src/eval.js";
import { JsonlTraceWriter, readJsonlTrace } from "../src/jsonl.js";
import { ensureDir, initWorkspace, writeText, writeTrace } from "../src/store.js";
import { addEvent, finishRun } from "../src/trace.js";

const launchDir = ".agentlens/launch";
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
console.log(`- ${launchDir}/mcp-policy.html`);
console.log(`- ${launchDir}/unsafe-agent.html`);
console.log(`- ${launchDir}/streaming-agent.jsonl`);
