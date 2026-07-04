import { createMcpRun, finishMcpRun, traceMcpToolCall } from "../src/adapters/mcp.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { addEvent } from "../src/trace.js";

initWorkspace(process.cwd());

const run = createMcpRun({
  app: "mcp-demo-agent",
  name: "mcp policy lookup",
  server: "local-policy-server"
});

addEvent(run, {
  type: "llm.prompt",
  name: "planner",
  input: {
    messages: [
      { role: "system", content: "Use MCP tools for policy lookups and cite returned source ids." },
      { role: "user", content: "Can a damaged item be refunded?" }
    ]
  }
});

const tools = {
  "policy.lookup": async ({ topic }) => ({
    topic,
    sourceId: "policy-refund-30d",
    text: "Damaged items can be refunded within 30 days with proof of purchase."
  })
};

const result = await traceMcpToolCall(
  run,
  {
    server: "local-policy-server",
    tool: "policy.lookup",
    input: { topic: "damaged item refund" },
    permission: "read-only"
  },
  (input) => tools["policy.lookup"](input)
);

addEvent(run, {
  type: "llm.response",
  name: "final-answer",
  output: {
    content: `Refund is available: ${result.text}`,
    citations: [result.sourceId]
  }
});

finishMcpRun(run, "passed");
writeTrace(".agentlens/runs/mcp-demo.json", run);
console.log("Wrote .agentlens/runs/mcp-demo.json");
