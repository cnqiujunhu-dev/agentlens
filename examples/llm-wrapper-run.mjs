import { traceLlmCall } from "../src/adapters/llm.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { createRun, finishRun } from "../src/trace.js";

initWorkspace(process.cwd());

const run = createRun({
  app: "llm-wrapper-demo",
  name: "generic LLM wrapper demo"
});

await traceLlmCall(
  run,
  {
    name: "final-answer",
    provider: "mock-openai-compatible",
    model: "demo-model",
    input: {
      messages: [{ role: "user", content: "What is AgentLens?" }]
    }
  },
  async () => ({
    content: "AgentLens traces, replays, evaluates, redacts, and shares AI agent runs.",
    citations: ["agentlens-readme"],
    usage: {
      inputTokens: 8,
      outputTokens: 11,
      costUsd: 0.0001
    }
  })
);

finishRun(run, "passed");
writeTrace(".agentlens/runs/llm-wrapper-demo.json", run);
console.log("Wrote .agentlens/runs/llm-wrapper-demo.json");
