# AgentLens Launch Copy

Use this when publishing the first public GitHub version.

## One-Line Positioning

AgentLens is local-first DevTools for AI agents: trace, replay, eval, redact, and share every model and tool call before production.

## Short Taglines

- Chrome DevTools for AI agent runs.
- Replay failed agent runs without calling the model again.
- CI checks for tool-using agents.
- Static trace reports for GitHub issues.
- MCP policy checks for agent tool calls.

## Hacker News

Title:

```text
Show HN: AgentLens - local-first trace, replay, and evals for AI agents
```

Post:

```text
Hi HN,

I built AgentLens, a local-first DevTools stack for AI agent runs.

The core idea is simple: every agent run should be inspectable after the fact. AgentLens records LLM prompts/responses, tool calls, retrieval events, errors, usage, and metadata into a plain trace file. From that trace you can replay the timeline, run JSON eval rules, redact secrets, generate a static dashboard, or fail CI.

Current MVP:
- trace JSON schema
- deterministic replay
- JSON eval rules
- generic LLM call wrapper
- LLM-specific eval pack
- batch CI command
- static HTML dashboard
- local dashboard server
- JSONL streaming traces
- MCP-style tool-call adapter
- stdio JSON-RPC MCP transport demo
- MCP policy checks
- trace redaction before sharing

It is intentionally not another agent framework. It is meant to sit around frameworks and make agent behavior debuggable.

I am looking for feedback from people building tool-using agents, RAG workflows, MCP servers, or agent CI checks.
```

## X / Twitter Thread

```text
I built AgentLens: local-first DevTools for AI agent runs.

Agents are easy to demo and hard to debug. When a run fails, you need to know:
- what the model saw
- which tool it called
- what retrieval returned
- why the answer changed
- whether it violated policy

AgentLens records every run as a plain trace:
LLM prompts, responses, tool calls, retrieval events, errors, usage, and metadata.

From one trace you can:
- replay the timeline
- run eval rules
- fail CI
- redact secrets
- generate a static dashboard
- attach the report to a GitHub issue

The MVP also includes MCP-style tool tracing and policy rules:
- allowed MCP servers
- required tool metadata
- forbidden write/admin/destructive permissions

It is not another agent framework.
It is the debugging and governance layer around agent frameworks.

Repo: <link>
```

Current target repo:

```text
https://github.com/cnqiujunhu-dev/agentlens
```

## Product Hunt Short Description

```text
Local-first DevTools for AI agents. Trace, replay, evaluate, redact, and share model/tool-call runs before production.
```

## GitHub Release Notes

```text
AgentLens v0.1.0 is the first MVP release.

Highlights:
- Trace AI agent runs as readable local JSON.
- Wrap generic LLM calls without binding to one SDK.
- Replay model/tool/retrieval timelines deterministically.
- Run JSON eval rules locally or in CI.
- Generate static HTML dashboards.
- Stream long-running traces as JSONL.
- Trace MCP-style tool calls and enforce MCP policy rules.
- Redact secrets before sharing traces publicly.

This release is designed for early feedback from agent, RAG, MCP, and AI infrastructure builders.
```

## Demo Flow

```bash
npm run verify
npm run launch:demo
npm run release:gif
npm run diff:dashboard
npm run release:preflight:local
```

Open:

```text
.agentlens/launch/support-agent.html
.agentlens/launch/mcp-policy.html
.agentlens/launch/langgraph-style.html
.agentlens/launch/unsafe-agent.html
.agentlens/reports/diff-demo.html
```

See [DEMO_RECORDING.md](DEMO_RECORDING.md) for the launch GIF shot list and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before publishing.
