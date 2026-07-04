import { JsonlTraceWriter, readJsonlTrace } from "../src/jsonl.js";
import { initWorkspace, writeTrace } from "../src/store.js";

initWorkspace(process.cwd());

const writer = new JsonlTraceWriter(".agentlens/runs/jsonl-demo.jsonl", {
  app: "streaming-agent",
  name: "jsonl streaming demo",
  metadata: {
    mode: "streaming"
  }
});

writer.addEvent({
  type: "llm.prompt",
  name: "planner",
  input: {
    messages: [{ role: "user", content: "Find the refund policy and answer with citations." }]
  }
});

writer.addEvent({
  type: "tool.call",
  name: "kb.search",
  input: {
    query: "refund policy damaged items"
  },
  metadata: {
    permission: "read-only"
  }
});

writer.addEvent({
  type: "tool.result",
  name: "kb.search",
  durationMs: 42,
  output: {
    sourceIds: ["refund-policy-30d"]
  }
});

writer.addEvent({
  type: "llm.response",
  name: "final-answer",
  output: {
    content: "Damaged items can be refunded within 30 days with proof of purchase.",
    citations: ["refund-policy-30d"]
  }
});

writer.finish("passed");

const trace = readJsonlTrace(".agentlens/runs/jsonl-demo.jsonl");
writeTrace(".agentlens/runs/jsonl-demo.materialized.json", trace);
console.log("Wrote .agentlens/runs/jsonl-demo.jsonl");
console.log("Wrote .agentlens/runs/jsonl-demo.materialized.json");
