import { addEvent, createRun, finishRun } from "./trace.js";

function isoAt(base, offsetMs) {
  return new Date(base.getTime() + offsetMs).toISOString();
}

export function createDemoRun() {
  const base = new Date();
  const run = createRun({
    app: "agentlens-demo",
    name: "support-agent refund policy question",
    metadata: {
      environment: "local",
      framework: "manual-demo"
    }
  });

  run.startedAt = isoAt(base, 0);

  addEvent(run, {
    ts: isoAt(base, 20),
    type: "note",
    name: "run.started",
    output: "User asked whether a damaged item can be refunded."
  });

  addEvent(run, {
    ts: isoAt(base, 45),
    type: "chain.start",
    name: "support-refund-flow",
    input: {
      question: "My item arrived damaged. Can I get a refund?"
    },
    metadata: {
      framework: "manual-demo",
      workflow: "support-refund-flow"
    }
  });

  addEvent(run, {
    ts: isoAt(base, 90),
    type: "llm.prompt",
    name: "planner",
    provider: "openai-compatible",
    model: "gpt-4.1",
    input: {
      messages: [
        { role: "system", content: "Answer support questions using tools when policy evidence is needed." },
        { role: "user", content: "My item arrived damaged. Can I get a refund?" }
      ]
    }
  });

  addEvent(run, {
    ts: isoAt(base, 770),
    type: "llm.response",
    name: "planner",
    provider: "openai-compatible",
    model: "gpt-4.1",
    durationMs: 680,
    usage: {
      inputTokens: 43,
      outputTokens: 31,
      costUsd: 0.0009
    },
    output: {
      content: "I should look up the refund policy before answering.",
      toolCalls: [
        {
          name: "kb.search",
          input: { query: "damaged item refund policy" }
        }
      ]
    }
  });

  addEvent(run, {
    ts: isoAt(base, 800),
    type: "agent.task.start",
    name: "lookup-refund-policy",
    input: {
      query: "damaged item refund policy"
    },
    metadata: {
      framework: "manual-demo",
      workflow: "support-refund-flow",
      agent: "policy_researcher",
      role: "researcher"
    }
  });

  addEvent(run, {
    ts: isoAt(base, 840),
    type: "tool.call",
    name: "kb.search",
    input: {
      query: "damaged item refund policy"
    },
    metadata: {
      mcpServer: "knowledge-base",
      permission: "read-only"
    }
  });

  addEvent(run, {
    ts: isoAt(base, 910),
    type: "retrieval.query",
    name: "policy-search",
    input: {
      query: "damaged item refund policy",
      topK: 3
    }
  });

  addEvent(run, {
    ts: isoAt(base, 1058),
    type: "retrieval.result",
    name: "policy-search",
    durationMs: 148,
    output: {
      chunks: [
        {
          id: "refund-policy-30d",
          score: 0.91,
          text: "Refunds are available within 30 days when proof of purchase is provided."
        },
        {
          id: "damaged-item-policy",
          score: 0.87,
          text: "For damaged items, support may request a photo before approving a refund or replacement."
        }
      ]
    }
  });

  addEvent(run, {
    ts: isoAt(base, 1090),
    type: "tool.result",
    name: "kb.search",
    status: "ok",
    durationMs: 250,
    output: {
      resultCount: 2,
      sourceIds: ["refund-policy-30d", "damaged-item-policy"]
    }
  });

  addEvent(run, {
    ts: isoAt(base, 1120),
    type: "agent.task.end",
    name: "lookup-refund-policy",
    output: {
      sourceIds: ["refund-policy-30d", "damaged-item-policy"],
      resultCount: 2
    },
    metadata: {
      framework: "manual-demo",
      workflow: "support-refund-flow",
      agent: "policy_researcher",
      role: "researcher"
    }
  });

  addEvent(run, {
    ts: isoAt(base, 1210),
    type: "llm.prompt",
    name: "final-answer",
    provider: "openai-compatible",
    model: "gpt-4.1",
    input: {
      messages: [
        { role: "system", content: "Answer using retrieved policy evidence. Cite source ids." },
        { role: "tool", content: "refund-policy-30d; damaged-item-policy" }
      ]
    }
  });

  addEvent(run, {
    ts: isoAt(base, 1810),
    type: "llm.response",
    name: "final-answer",
    provider: "openai-compatible",
    model: "gpt-4.1",
    durationMs: 600,
    usage: {
      inputTokens: 57,
      outputTokens: 49,
      costUsd: 0.0012
    },
    output: {
      content: "Yes. If the item arrived damaged, you can request a refund within 30 days with proof of purchase. Support may ask for a photo of the damage before approving the refund or replacement.",
      citations: ["refund-policy-30d", "damaged-item-policy"]
    }
  });

  addEvent(run, {
    ts: isoAt(base, 1820),
    type: "chain.end",
    name: "support-refund-flow",
    output: {
      finalEvent: "final-answer",
      citations: ["refund-policy-30d", "damaged-item-policy"]
    },
    metadata: {
      framework: "manual-demo",
      workflow: "support-refund-flow"
    }
  });

  run.endedAt = isoAt(base, 1830);
  return finishRun(run, "passed");
}
