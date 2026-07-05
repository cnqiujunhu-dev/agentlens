# AgentLens Launch Post

Use this as the first long-form launch post for GitHub, Hacker News, or a technical blog.

## Title Options

- AgentLens: local-first DevTools for AI agent runs
- Debugging AI agents with traces, replay, evals, and CI
- I built a local-first trace and eval tool for AI agents

## Short Version

```text
AgentLens is local-first DevTools for AI agents. It records model calls, tool calls, retrieval events, errors, usage, and metadata into plain trace files, then lets you replay runs, run JSON evals, redact sensitive fields, generate static dashboards, and fail CI.

It is not another agent framework. It is meant to sit around agent frameworks and make agent behavior debuggable.
```

## Long Post Draft

```text
AI agents are easy to demo and hard to debug.

When a run fails, the useful questions are usually basic:

- What did the model actually see?
- Which tool did it call?
- What did retrieval return?
- Did the final answer cite the right source?
- Did the agent violate a latency, cost, safety, or tool policy?
- Can the same failure be reproduced in CI?

I built AgentLens to make those questions answerable from local files.

AgentLens records an agent run as a readable trace: LLM prompts, LLM responses, tool calls, tool results, retrieval events, errors, usage, and metadata. From that trace you can replay the timeline without calling the model again, run JSON eval rules, redact sensitive fields before sharing, generate static HTML dashboards, or fail a pull request with a GitHub Action.

The current MVP includes:

- Trace v1 JSON schema.
- CLI commands for demo, inspect, replay, eval, CI, redact, dashboard, and diff.
- Static HTML dashboards and before/after diff dashboards.
- JSON output for automation.
- Markdown summaries for GitHub Actions.
- JSONL streaming traces for long-running agents.
- Generic LLM wrappers and OpenAI-compatible / Anthropic-compatible adapter helpers.
- MCP-style tool tracing, MCP stdio transport demo, tool inventory capture, and policy checks.
- Local release audit and GitHub Action smoke tests.

The design goal is boring interoperability: no hosted account, no required runtime dependency, and no need to rewrite your agent around a new framework. AgentLens should sit beside the code you already have and give you inspectable artifacts when the run succeeds, fails, or regresses.

The first public repository and `v0.1.0` release are live. The next priorities are feedback from people building real tool-using agents, RAG workflows, MCP servers, or agent CI checks, followed by deeper framework adapters.

Repo: <link>
```

## Posting Checklist

Before posting:

- Replace `<link>` with the public GitHub URL.
- Confirm the README GIF or screenshot renders on GitHub.
- Run `npm run verify` and `npm run release:audit`.
- Link directly to the quick demo section in the README.
- Invite specific feedback on adapters, eval rules, and MCP policy checks.

## First Reply Template

Use this when someone asks how AgentLens differs from an agent framework:

```text
AgentLens is intentionally not a framework. It does not decide planning, memory, routing, or model choice for you.

The goal is to capture what happened in a run and make it inspectable: timeline replay, eval rules, redaction, dashboards, CI checks, and MCP/tool policy review.
```
