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

## Trace Diff

```js
import { compareTraces, formatTraceDiff, readTrace } from "agentlens";

const baseline = readTrace(".agentlens/runs/baseline.json");
const candidate = readTrace(".agentlens/runs/candidate.json");
const diff = compareTraces(baseline, candidate);

console.log(formatTraceDiff(diff));
```

## CLI JSON Output

```bash
agentlens inspect .agentlens/runs/demo.json --json
agentlens eval .agentlens/runs/demo.json --config evals/default.json --json
agentlens ci --runs .agentlens/runs --config evals/default.json --json
agentlens diff .agentlens/runs/baseline.json .agentlens/runs/candidate.json --json
```

## Generic LLM Calls

```js
import { createRun, finishRun, traceLlmCall } from "agentlens";

const run = createRun({
  app: "support-agent",
  name: "llm wrapper"
});

await traceLlmCall(
  run,
  {
    name: "final-answer",
    provider: "openai-compatible",
    model: "demo-model",
    input: {
      messages: [{ role: "user", content: "What is AgentLens?" }]
    }
  },
  async (input) => {
    return yourLlmClient.chat(input);
  }
);

finishRun(run, "passed");
```

## Provider-Style LLM Calls

```js
import { createRun, finishRun, traceOpenAiCompatibleChat } from "agentlens";

const run = createRun({
  app: "support-agent",
  name: "provider wrapper"
});

await traceOpenAiCompatibleChat(run, {
  client: yourClient,
  params: {
    model: "your-chat-model",
    messages: [{ role: "user", content: "What is AgentLens?" }]
  }
});

finishRun(run, "passed");
```

For message-style SDKs, use `traceAnthropicCompatibleMessage(run, { client, params })`. Both helpers delegate to `traceLlmCall`, so they produce the same `llm.prompt`, `llm.response`, usage, and error events.

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

## Schemas

```js
import { listSchemas, readSchema, schemaPath } from "agentlens";

console.log(listSchemas());
console.log(schemaPath("trace"));
console.log(readSchema("eval"));
```

## Dashboard Server

```js
import { createDashboardServer, listen } from "agentlens";

const server = createDashboardServer(".agentlens/runs");
const address = await listen(server, {
  host: "127.0.0.1",
  port: 4317
});

console.log(address);
```

The server also exposes local JSON endpoints:

```text
GET /api/runs
GET /api/trace/<relative-trace-path>
GET /api/stat/<relative-trace-path>
```

When serving a single trace file, use `GET /api/trace` and `GET /api/stat`. HTML pages rendered by `agentlens serve` poll the stat endpoint and refresh when the underlying trace file changes.

Dashboard HTML includes timeline filters for event type, status, text search, and MCP risk. The static `agentlens dashboard` output keeps the same filtering UI without requiring a server.

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
