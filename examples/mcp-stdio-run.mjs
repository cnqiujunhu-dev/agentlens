import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMcpRun, finishMcpRun } from "../src/adapters/mcp.js";
import { traceMcpStdioToolCall } from "../src/adapters/mcp-stdio.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { addEvent } from "../src/trace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, "mcp-stdio-server.mjs");

initWorkspace(process.cwd());

const run = createMcpRun({
  app: "mcp-stdio-demo-agent",
  name: "mcp stdio policy lookup",
  server: "agentlens-demo-policy-server"
});

addEvent(run, {
  type: "llm.prompt",
  name: "planner",
  input: {
    messages: [
      { role: "system", content: "Use the MCP policy server and cite the returned source id." },
      { role: "user", content: "Can a damaged item be refunded?" }
    ]
  }
});

const result = await traceMcpStdioToolCall(run, {
  command: process.execPath,
  args: [serverPath],
  server: "agentlens-demo-policy-server",
  tool: "policy.lookup",
  input: { topic: "damaged item refund" },
  permission: "read-only"
});

const payload = result.structuredContent ?? JSON.parse(result.content?.[0]?.text ?? "{}");

addEvent(run, {
  type: "llm.response",
  name: "final-answer",
  output: {
    content: `Refund is available: ${payload.text}`,
    citations: [payload.sourceId]
  }
});

finishMcpRun(run, "passed");
writeTrace(".agentlens/runs/mcp-stdio-demo.json", run);
console.log("Wrote .agentlens/runs/mcp-stdio-demo.json");
