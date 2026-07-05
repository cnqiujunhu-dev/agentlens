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

## Security Scan

```js
import { formatScanReport, formatScanSarif, readTrace, scanTrace } from "agentlens";

const trace = readTrace(".agentlens/runs/refund.json");
const report = scanTrace(trace, { failOnSeverity: "high" });

console.log(formatScanReport(report));
console.log(JSON.stringify(formatScanSarif(report, { traceFile: ".agentlens/runs/refund.json" }), null, 2));
```

## Trace Diff

```js
import { compareTraces, formatTraceDiff, readTrace, renderDiffDashboard } from "agentlens";

const baseline = readTrace(".agentlens/runs/baseline.json");
const candidate = readTrace(".agentlens/runs/candidate.json");
const diff = compareTraces(baseline, candidate);

console.log(formatTraceDiff(diff));
const html = renderDiffDashboard(diff);
```

## CLI JSON Output

```bash
agentlens inspect .agentlens/runs/demo.json --json
agentlens eval .agentlens/runs/demo.json --config evals/default.json --json
agentlens scan .agentlens/runs/demo.json --json --sarif .agentlens/reports/agentlens-scan.sarif
agentlens ci --runs .agentlens/runs --config evals/default.json --scan --json --sarif .agentlens/reports/agentlens-ci.sarif
agentlens bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,timeline
agentlens diff .agentlens/runs/baseline.json .agentlens/runs/candidate.json --json
agentlens diff-dashboard .agentlens/runs/baseline.json .agentlens/runs/candidate.json --out .agentlens/reports/diff.html
```

For GitHub Actions summaries or local reports:

```bash
agentlens ci --runs .agentlens/runs --config evals/default.json --summary-md agentlens-summary.md
agentlens ci --runs .agentlens/runs --config evals/default.json --scan --pr-comment-md agentlens-pr-comment.md
```

## Workspace Doctor

```js
import { doctorWorkspace, formatDoctorReport } from "agentlens";

const report = doctorWorkspace(process.cwd());
console.log(formatDoctorReport(report));
```

CLI:

```bash
agentlens doctor
agentlens doctor --json
```

## Share Bundles

```js
import { writeShareBundle } from "agentlens";

const bundle = writeShareBundle({
  traceFile: ".agentlens/runs/demo.json",
  configPath: "evals/default.json",
  outDir: ".agentlens/share/demo",
  sections: "summary,timeline"
});

console.log(bundle.files);
```

CLI:

```bash
agentlens share .agentlens/runs/demo.json --config evals/default.json --out .agentlens/share/demo --sections summary,timeline
```

Share bundles include `scan.txt`, generated after redaction.

## Run Bundles

```js
import { writeRunBundle } from "agentlens";

const result = writeRunBundle({
  runsDir: ".agentlens/runs",
  outDir: ".agentlens/reports/bundle",
  sections: "summary,timeline"
});

console.log(result.index);
console.log(result.manifest);
```

Run bundles also write `manifest.json` with `schemaVersion: "agentlens.run-bundle.v1"`, summary counts, per-trace dashboard filenames, scan status, and invalid trace errors for automation.

## Validation

```js
import { formatValidationReport, validateArtifact, validateEvalConfig } from "agentlens";

const traceReport = validateArtifact("trace", ".agentlens/runs/demo.json");
const evalReport = validateEvalConfig({
  version: "agentlens.eval.v1",
  name: "local",
  assertions: []
});

console.log(formatValidationReport(traceReport));
console.log(evalReport.valid);
```

CLI:

```bash
agentlens validate trace .agentlens/runs/demo.json
agentlens validate eval evals/default.json --json
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

See [LLM_SDK_COOKBOOK.md](LLM_SDK_COOKBOOK.md) for OpenAI-compatible, Anthropic-compatible, custom SDK, error handling, CI, and redaction patterns.

## LangGraph-Style Nodes

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

const state = await planner({ messages: [{ role: "user", content: "Can I refund this?" }], steps: [] });
finishRun(run, "passed");
```

## Multi-Agent Workflows

```js
import { addAgentMessage, createMultiAgentRun, finishRun, traceAgentTask } from "agentlens";

const run = createMultiAgentRun({
  app: "support-agent",
  name: "refund review",
  framework: "autogen",
  workflow: "planner-researcher-reviewer"
});

addAgentMessage(run, {
  agent: "planner",
  content: "Research the refund policy before answering."
});

const research = await traceAgentTask(
  run,
  {
    agent: "researcher",
    role: "assistant",
    name: "lookup-refund-policy",
    input: { topic: "damaged item refund" }
  },
  async () => ({ finding: "Refunds are available within 30 days.", citations: ["policy-refund-30d"] })
);

finishRun(run, research.citations.length > 0 ? "passed" : "failed");
```

See [MULTI_AGENT_ADAPTERS.md](MULTI_AGENT_ADAPTERS.md) for AutoGen-style and CrewAI-style examples.

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

Dashboard HTML includes timeline filters for event type, status, text search, and MCP risk. Filter state is stored in `#agentlens-filter?...` links, so reviewers can copy a static URL to the current filtered view. It also includes tool call groups with repeated-call counts, risk, latency, server, permission, first/last links, and one-click timeline filters. Timeline jump links point to the first error, first high-risk tool call, first tool call, final response, and last event. The static `agentlens dashboard` output keeps the same filtering UI without requiring a server. Pass `--sections summary,event-types,scan,tool-calls,filters,timeline` to render a focused report for PR comments, incident notes, or support handoffs.

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

For multiple calls against the same server process:

```js
import { McpStdioTraceSession, createMcpRun, finishMcpRun } from "agentlens";

const run = createMcpRun({
  app: "mcp-agent",
  name: "stdio session",
  server: "agentlens-demo-policy-server"
});

const session = new McpStdioTraceSession(run, {
  command: process.execPath,
  args: ["./examples/mcp-stdio-server.mjs"],
  server: "agentlens-demo-policy-server"
});

try {
  await session.initialize();
  await session.callTool("policy.lookup", { input: { topic: "refund policy" }, permission: "read-only" });
  await session.callTool("policy.lookup", { input: { topic: "damaged item" }, permission: "read-only" });
  finishMcpRun(run, "passed");
} finally {
  session.close();
}
```
