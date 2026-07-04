import { createLangGraphRun, wrapLangGraphNode } from "../src/adapters/langgraph.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { finishRun } from "../src/trace.js";

initWorkspace(process.cwd());

const run = createLangGraphRun({
  app: "langgraph-style-demo",
  name: "support graph",
  graph: "support-refund-flow"
});

const planner = wrapLangGraphNode(run, "planner", async (state) => ({
  ...state,
  steps: [...(state.steps ?? []), "lookup-refund-policy"],
  messages: [
    ...(state.messages ?? []),
    { role: "assistant", content: "I should look up the refund policy before answering." }
  ]
}));

const responder = wrapLangGraphNode(run, "responder", async (state) => ({
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

let state = {
  messages: [{ role: "user", content: "Can I refund a damaged item?" }],
  steps: []
};

state = await planner(state);
state = await responder(state);

finishRun(run, "passed");
writeTrace(".agentlens/runs/langgraph-style-demo.json", run);
console.log("Wrote .agentlens/runs/langgraph-style-demo.json");
