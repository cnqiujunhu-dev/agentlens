import { addAgentMessage, createMultiAgentRun, traceAgentTask } from "../src/adapters/multi-agent.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { addEvent, finishRun } from "../src/trace.js";

initWorkspace(process.cwd());

const run = createMultiAgentRun({
  app: "autogen-style-demo",
  name: "refund review chat",
  framework: "autogen",
  workflow: "planner-researcher-reviewer"
});

addAgentMessage(run, {
  agent: "user_proxy",
  role: "user",
  content: "Can we refund a damaged item if the customer has a receipt?"
});

const plan = await traceAgentTask(
  run,
  {
    agent: "planner",
    role: "assistant",
    name: "plan-refund-answer",
    input: { question: "Can we refund a damaged item if the customer has a receipt?" }
  },
  async (input) => ({
    question: input.question,
    steps: ["lookup-policy", "check-exceptions", "draft-answer"]
  })
);

addAgentMessage(run, {
  agent: "planner",
  content: "Research the refund policy, then have the reviewer check the answer.",
  output: { role: "assistant", content: "Research the refund policy, then have the reviewer check the answer.", plan }
});

const research = await traceAgentTask(
  run,
  {
    agent: "researcher",
    role: "assistant",
    name: "lookup-refund-policy",
    input: { topic: "damaged item refund", plan }
  },
  async (input) => {
    addEvent(run, {
      type: "retrieval.query",
      name: "policy-search",
      input,
      metadata: { framework: "autogen", agent: "researcher" }
    });
    const result = {
      sourceId: "policy-refund-30d",
      text: "Damaged items can be refunded within 30 days with proof of purchase."
    };
    addEvent(run, {
      type: "retrieval.result",
      name: "policy-search",
      durationMs: 48,
      output: { results: [result] },
      metadata: { framework: "autogen", agent: "researcher" }
    });
    return {
      finding: result.text,
      citations: [result.sourceId]
    };
  }
);

addAgentMessage(run, {
  agent: "researcher",
  content: research.finding,
  output: { role: "assistant", content: research.finding, citations: research.citations }
});

const finalAnswer = await traceAgentTask(
  run,
  {
    agent: "reviewer",
    role: "assistant",
    name: "review-final-answer",
    input: { research }
  },
  async (input) => ({
    content: `${input.research.finding} The reviewer confirmed no policy exception is needed.`,
    citations: input.research.citations
  })
);

addEvent(run, {
  type: "llm.response",
  name: "final-answer",
  output: finalAnswer,
  usage: { inputTokens: 92, outputTokens: 38, costUsd: 0.0004 },
  metadata: { framework: "autogen", agent: "reviewer" }
});

addAgentMessage(run, {
  agent: "reviewer",
  content: finalAnswer.content,
  output: { role: "assistant", ...finalAnswer }
});

finishRun(run, "passed");
writeTrace(".agentlens/runs/autogen-style-demo.json", run);
console.log("Wrote .agentlens/runs/autogen-style-demo.json");
