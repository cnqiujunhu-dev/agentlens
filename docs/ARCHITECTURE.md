# AgentLens Architecture

## Product Position

AgentLens is a local-first AI agent DevTools stack. It focuses on observability, replay, and evals for agent runs that use LLMs, tools, RAG, MCP servers, browser automation, code execution, or internal APIs.

The project should stay framework-neutral. It should integrate with agent frameworks, not compete with them.

## System Layers

```text
1. Collection Layer
   - SDK hooks
   - LLM provider wrappers
   - Generic LLM call adapter
   - MCP/tool call adapters
   - Browser/code/RAG adapters

2. Trace Layer
   - AgentLens Trace v1 JSON
   - Trace JSON Schema
   - JSONL streaming trace records
   - Event normalization
   - Local run store

3. Analysis Layer
   - Run inspection
   - Replay transcript
   - Eval assertions
   - Eval JSON Schema
   - Safety and latency checks
   - Batch CI evaluation

4. Presentation Layer
   - CLI summaries
   - Static HTML dashboard
   - Later: live local server and VS Code extension

5. Integration Layer
   - CI exit codes
   - MCP-style tool-call adapter
   - MCP stdio JSON-RPC transport demo
   - GitHub Action
   - Framework plugins
   - Enterprise policy packs
```

## Trace Design

AgentLens uses append-friendly event records. Small runs can be stored as one readable JSON file. Long-running agents can stream JSONL records and materialize them back into the same trace model.

JSONL streaming is also supported for long-running agents. JSONL traces can be materialized back into standard AgentLens Trace v1 JSON before replay, eval, or dashboard rendering.

Required run fields:

- `schemaVersion`
- `runId`
- `app`
- `name`
- `startedAt`
- `endedAt`
- `status`
- `events`

Required event fields:

- `id`
- `ts`
- `type`

Recommended event fields:

- `name`
- `status`
- `input`
- `output`
- `durationMs`
- `metadata`

## Eval Design

Eval rules should be explicit, source-controlled, and CI-friendly. The MVP starts with JSON assertions:

- required event types
- maximum errors
- forbidden tools
- maximum tool duration
- maximum total cost
- required final response
- required citations
- MCP server allowlists
- forbidden tool permissions
- required tool metadata

Later versions can add:

- semantic judge plugins
- custom JavaScript/Python assertions
- golden trace comparison
- policy packs for MCP and code agents

## Dashboard Design

The first dashboard is a generated static HTML file. It does not require a web server. It should show:

- run metadata
- event counts
- latency and cost summary
- timeline
- tool calls and results
- retrieval activity
- errors and policy failures

## Roadmap

### Iteration 1: Trace Core

- Create trace schema.
- Generate demo traces.
- Inspect local trace files.

### Iteration 2: Replay and Eval

- Convert trace events into a readable replay transcript.
- Evaluate trace files against JSON assertions.
- Return non-zero exit code on failed evals.

### Iteration 3: Dashboard

- Generate static HTML report.
- Highlight failed or slow events.
- Make traces easy to share in GitHub issues.

### Post-MVP

- Harden MCP transport adapter.
- LangGraph adapter.
- OpenAI/Anthropic SDK wrappers.
- MCP server scanner.
- GitHub Action.
- Live mode.
- VS Code extension.
