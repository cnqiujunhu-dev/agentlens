import { addEvent, createRun, finishRun } from "../src/trace.js";
import { initWorkspace, writeTrace } from "../src/store.js";

initWorkspace(process.cwd());

const run = createRun({
  app: "example-agent",
  name: "minimal traced run"
});

addEvent(run, {
  type: "llm.prompt",
  name: "answer",
  input: {
    messages: [{ role: "user", content: "What is AgentLens?" }]
  }
});

addEvent(run, {
  type: "llm.response",
  name: "answer",
  durationMs: 120,
  output: {
    content: "AgentLens records, replays, evaluates, and visualizes AI agent runs.",
    citations: ["local-example"]
  }
});

finishRun(run, "passed");
writeTrace(".agentlens/runs/basic-example.json", run);
console.log("Wrote .agentlens/runs/basic-example.json");
