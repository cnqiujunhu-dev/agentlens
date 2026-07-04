# AgentLens API

AgentLens can be used as a CLI or imported as a JavaScript library.

## Core Trace

```js
import { addEvent, createRun, finishRun, writeTrace } from "agentlens";

const run = createRun({
  app: "support-agent",
  name: "refund question"
});

addEvent(run, {
  type: "llm.prompt",
  name: "planner",
  input: {
    messages: [{ role: "user", content: "Can I get a refund?" }]
  }
});

addEvent(run, {
  type: "llm.response",
  name: "final-answer",
  output: {
    content: "Yes, within 30 days with proof of purchase.",
    citations: ["refund-policy-30d"]
  }
});

finishRun(run, "passed");
writeTrace(".agentlens/runs/refund.json", run);
```

## Eval

```js
import { evaluateTrace, formatEvalReport, readTrace } from "agentlens";

const trace = readTrace(".agentlens/runs/refund.json");
const report = evaluateTrace(trace, {
  name: "citation-policy",
  assertions: [{ id: "citations", type: "required-citations", min: 1 }]
});

console.log(formatEvalReport(report));
```

## JSONL Streaming

```js
import { JsonlTraceWriter, readJsonlTrace } from "agentlens";

const writer = new JsonlTraceWriter(".agentlens/runs/live.jsonl", {
  app: "live-agent",
  name: "streaming run"
});

writer.addEvent({ type: "llm.prompt", name: "planner" });
writer.addEvent({ type: "llm.response", name: "final-answer" });
writer.finish("passed");

const trace = readJsonlTrace(".agentlens/runs/live.jsonl");
```

## Redaction

```js
import { readTrace, redactTrace, writeTrace } from "agentlens";

const trace = readTrace(".agentlens/runs/demo.json");
const redacted = redactTrace(trace, {
  keys: ["authorization", "token", "customerEmail"]
});

writeTrace(".agentlens/runs/demo.redacted.json", redacted);
```

## MCP-Style Tool Calls

```js
import { createMcpRun, finishMcpRun, traceMcpToolCall } from "agentlens";

const run = createMcpRun({
  app: "mcp-agent",
  name: "policy lookup",
  server: "local-policy-server"
});

await traceMcpToolCall(
  run,
  {
    server: "local-policy-server",
    tool: "policy.lookup",
    input: { topic: "refund policy" },
    permission: "read-only"
  },
  async (input) => ({ sourceId: "policy", topic: input.topic })
);

finishMcpRun(run, "passed");
```

## MCP Stdio Transport

```js
import { createMcpRun, finishMcpRun, traceMcpStdioToolCall } from "agentlens";

const run = createMcpRun({
  app: "mcp-agent",
  name: "stdio policy lookup",
  server: "agentlens-demo-policy-server"
});

await traceMcpStdioToolCall(run, {
  command: process.execPath,
  args: ["./examples/mcp-stdio-server.mjs"],
  server: "agentlens-demo-policy-server",
  tool: "policy.lookup",
  input: { topic: "refund policy" },
  permission: "read-only"
});

finishMcpRun(run, "passed");
```
