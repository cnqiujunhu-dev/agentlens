# AgentLens Demo Recording Guide

This guide is for recording the first README GIF, launch video, or social demo clip.

## Goal

Record a 60-90 second product demo that proves AgentLens can make an AI agent run inspectable without a cloud account.

The clip should show:

- A trace timeline with model, tool, retrieval, and final answer events.
- An eval report that can pass or fail CI.
- A static dashboard that can be shared in an issue or PR.
- A Security Scan panel that catches leaked secrets and risky trace content.
- A Workflow Review section that surfaces chain boundaries, agent tasks, and error markers.
- A run bundle index for multiple traces.
- MCP policy checks for tool-using agents.
- A before/after diff dashboard for regressions.

## Setup

Run:

```bash
npm run verify
npm run launch:demo
npm run release:dashboard-screenshot
npm run release:gif
npm run bundle:demo
npm run diff:dashboard
```

Open:

```text
.agentlens/launch/support-agent.html
.agentlens/launch/support-agent-workflow.html
.agentlens/launch/mcp-policy.html
.agentlens/launch/langgraph-style.html
.agentlens/launch/unsafe-agent.html
.agentlens/reports/bundle-demo/index.html
.agentlens/reports/diff-demo.html
README.md
```

Use a 1280x720 or 1440x900 browser window. Keep the terminal font at a readable size.

## Shot List

| Time | Shot | What to show |
| --- | --- | --- |
| 0-8s | README top | Local-first DevTools for AI agents, screenshot, zero dependencies |
| 8-22s | Quick demo commands | `init`, `demo`, `inspect`, `replay`, `eval`, `dashboard` |
| 22-40s | Support dashboard | Security Scan panel, Workflow Review, timeline, costs, latency, final answer, citations |
| 40-55s | CI and evals | Passing eval output, scan gate, and policy rule names |
| 55-68s | MCP policy | MCP tool metadata, risk labels, and blocked unsafe action |
| 68-80s | Framework adapter | LangGraph-style node start/end events |
| 80-90s | Bundle and diff | Run bundle index, baseline vs candidate regressions, and tool/event deltas |

## Narration

Keep the story technical and concrete:

```text
AgentLens records every AI agent run as a local trace: model prompts, responses, tool calls, retrieval, usage, and metadata.

From that trace you can replay the run, run JSON eval rules, scan for leaked secrets, redact sensitive fields, fail CI, and generate static dashboards with tool groups, workflow review, and timeline filters for issues or pull requests.

It is not an agent framework. It is the debugging and governance layer around whatever agent stack you already use.
```

Avoid claims such as `production-ready`, `enterprise-grade`, or `complete observability platform` until real framework adapters and external users exist.

## Export Targets

Preferred README asset:

```text
docs/assets/agentlens-demo.gif
```

Optional higher-quality launch asset:

```text
docs/assets/agentlens-demo.mp4
```

Quality checklist:

- GIF stays under 10 MB if used in the README.
- No secrets, tokens, local usernames, or private paths are visible.
- Text is readable on GitHub at normal README width.
- The first 3 seconds show the product name and dashboard.
- The final frame shows a useful result, not a blank terminal.

## Scripted README Assets

The committed README screenshot and GIF can be regenerated with:

```bash
npm run release:dashboard-screenshot
npm run release:gif
```

The screenshot script captures `.agentlens/launch/support-agent.html` and writes `docs/assets/dashboard-screenshot.png`. The GIF script screenshots launch dashboard artifacts and writes `docs/assets/agentlens-demo.gif`.

## After Manual Recording

Update `docs/RELEASE_CHECKLIST.md` if the recording process changes.

Then run:

```bash
npm run release:audit
```
