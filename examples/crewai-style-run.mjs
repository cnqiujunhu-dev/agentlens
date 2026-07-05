import { addAgentMessage, createMultiAgentRun, traceAgentTask } from "../src/adapters/multi-agent.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { addEvent, finishRun } from "../src/trace.js";

initWorkspace(process.cwd());

const run = createMultiAgentRun({
  app: "crewai-style-demo",
  name: "support response crew",
  framework: "crewai",
  workflow: "research-review-write"
});

addAgentMessage(run, {
  agent: "manager",
  role: "system",
  content: "Assign a researcher, compliance reviewer, and writer to answer the refund question."
});

const research = await traceAgentTask(
  run,
  {
    agent: "policy_researcher",
    role: "researcher",
    name: "research-refund-policy",
    input: { customerQuestion: "The item arrived damaged. Can I get a refund?" }
  },
  async (input) => {
    addEvent(run, {
      type: "tool.call",
      name: "kb.search",
      input: { query: input.customerQuestion },
      metadata: { framework: "crewai", agent: "policy_researcher", permission: "read-only" }
    });
    const output = {
      citation: "policy-refund-30d",
      policy: "Refunds are available within 30 days for damaged items when proof of purchase is provided."
    };
    addEvent(run, {
      type: "tool.result",
      name: "kb.search",
      durationMs: 64,
      output,
      metadata: { framework: "crewai", agent: "policy_researcher", permission: "read-only" }
    });
    return output;
  }
);

const review = await traceAgentTask(
  run,
  {
    agent: "compliance_reviewer",
    role: "reviewer",
    name: "review-policy-answer",
    input: { research }
  },
  async (input) => ({
    approved: true,
    notes: "Answer cites policy and does not promise shipping reimbursement.",
    citations: [input.research.citation]
  })
);

const finalAnswer = await traceAgentTask(
  run,
  {
    agent: "support_writer",
    role: "writer",
    name: "write-customer-answer",
    input: { research, review }
  },
  async (input) => ({
    content:
      "Yes. Damaged items can be refunded within 30 days when the customer provides proof of purchase. Start the return from the order page and attach a photo of the damage.",
    citations: input.review.citations
  })
);

addEvent(run, {
  type: "llm.response",
  name: "final-answer",
  output: finalAnswer,
  usage: { inputTokens: 118, outputTokens: 44, costUsd: 0.0005 },
  metadata: { framework: "crewai", agent: "support_writer" }
});

addAgentMessage(run, {
  agent: "support_writer",
  content: finalAnswer.content,
  output: { role: "assistant", ...finalAnswer }
});

finishRun(run, "passed");
writeTrace(".agentlens/runs/crewai-style-demo.json", run);
console.log("Wrote .agentlens/runs/crewai-style-demo.json");
