# AgentLens Launch Copy

Use this when publishing the first public GitHub version.

## One-Line Positioning

AgentLens is local-first DevTools for AI agents: turn model, tool, retrieval, and workflow runs into replayable traces, eval gates, static dashboards, and PR artifacts.

## Short Taglines

- Chrome DevTools for AI agent runs.
- Replay failed agent runs without calling the model again.
- CI checks, scan gates, and PR artifacts for tool-using agents.
- Secret and prompt-injection scans for agent traces.
- SARIF output for agent trace findings.
- Batch SARIF for CI run directories.
- Static trace dashboards for GitHub issues and pull requests.
- Workflow review for chains, agent tasks, and paired error markers.
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

The core idea is simple: every agent run should be inspectable after the fact. AgentLens records LLM prompts/responses, tool calls, retrieval events, chain/task boundaries, errors, usage, and metadata into a plain trace file. From that trace you can replay the timeline, run JSON eval rules, scan for leaked secrets and prompt-injection phrases, redact secrets, generate a static dashboard, build a PR review pack, or fail CI.

What ships today:
- trace JSON schema and deterministic replay
- JSON eval rules and CI gates
- local security scan with SARIF output
- static dashboards with Security Scan, Tool Calls, Workflow Review, filters, and timeline jumps
- run bundles and before/after review packs for PRs
- stable PR comment Markdown for GitHub workflows
- copyable PR comment example for README, launch posts, and release notes
- generic LLM wrappers plus OpenAI-compatible and Anthropic-compatible adapter helpers
- LangGraph-style, AutoGen-style, CrewAI-style, MCP-style, and MCP stdio demos
- zero-dependency Python trace writer and `agentlens_trace.adapters` bridge helpers
- OpenTelemetry/OpenInference-style OTLP JSON export
- JSONL streaming traces and materialization
- redacted share bundles for issues and support threads

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
LLM prompts, responses, tool calls, retrieval events, chain/task boundaries, errors, usage, and metadata.

From one trace you can:
- replay the timeline
- run eval rules
- fail CI
- scan for leaked secrets and risky tool calls
- upload scan findings as SARIF
- redact secrets
- generate a static dashboard
- attach a dashboard, run bundle, or PR review pack to GitHub

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
Local-first DevTools for AI agents. Trace, replay, evaluate, scan, redact, and share model/tool-call runs before production.
```

## GitHub Release Notes

```text
AgentLens v0.4.0 is the review-automation release.

Highlights:
- Workflow Review signals in dashboards, eval rules, diff reports, run bundle manifests, PR comments, and review packs.
- `agentlens review` writes before/after PR review packs with CI summaries, SARIF, diff dashboards, run bundles, README files, and machine-readable review manifests.
- Review manifests now include JSON Schema validation, provenance metadata, uploaded artifact/SARIF links, and GitHub Action outputs for downstream PR bots.
- `agentlens init --review` scaffolds a copyable before/after review workflow with artifact upload and marker-based PR comment upsert.
- Launch material now includes a copyable PR comment example.

Use docs/RELEASE_NOTES_V0.4.0.md for the full release notes.
```

## Demo Flow

```bash
npm run verify
npm run launch:demo
npm run release:dashboard-screenshot
npm run release:gif
npm run diff:dashboard
npm run release:preflight:local
```

Open:

```text
.agentlens/launch/support-agent.html
.agentlens/launch/support-agent-workflow.html
.agentlens/launch/mcp-policy.html
.agentlens/launch/langgraph-style.html
.agentlens/launch/unsafe-agent.html
.agentlens/reports/diff-demo.html
```

See [DEMO_RECORDING.md](DEMO_RECORDING.md) for the launch GIF shot list and [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) before publishing.
