# LangGraph-Style Adapter

AgentLens includes a zero-dependency adapter for tracing LangGraph-style node functions. It does not import or pin a LangGraph package version; instead, it wraps the node functions you already run and records framework node events into an AgentLens trace.

## Why This Exists

Graph-based agents are hard to debug when state moves through planner, router, tool, and responder nodes. The adapter captures:

- graph and node names
- node input and output
- state summaries for common fields such as `messages`, `steps`, and `toolCalls`
- duration
- errors

## Example

```js
import { createLangGraphRun, finishRun, wrapLangGraphNode } from "agentlens";

const run = createLangGraphRun({
  app: "support-agent",
  name: "support graph",
  graph: "support-refund-flow"
});

const planner = wrapLangGraphNode(run, "planner", async (state) => ({
  ...state,
  steps: [...(state.steps ?? []), "lookup-refund-policy"]
}));

const responder = wrapLangGraphNode(run, "responder", async (state) => ({
  ...state,
  final: {
    content: "Damaged items can be refunded within 30 days.",
    citations: ["policy-refund-30d"]
  }
}));

let state = { messages: [{ role: "user", content: "Can I refund a damaged item?" }], steps: [] };
state = await planner(state);
state = await responder(state);
finishRun(run, "passed");
```

Run the local demo:

```bash
npm run demo:langgraph
node ./bin/agentlens.js replay .agentlens/runs/langgraph-style-demo.json
node ./bin/agentlens.js eval .agentlens/runs/langgraph-style-demo.json --config evals/langgraph-basic.json
```

## Events

The adapter records:

- `framework.node.start`
- `framework.node.end`
- `error` when a node throws

The trace remains plain AgentLens JSON and can be replayed, validated, redacted, bundled, and viewed in the dashboard.

## Notes

Use this adapter around LangGraph node functions or similar graph-node functions. For model calls inside a node, combine it with `traceLlmCall` or provider-style LLM adapters. For MCP/tool calls inside a node, combine it with `traceMcpToolCall` or `McpStdioTraceSession`.
