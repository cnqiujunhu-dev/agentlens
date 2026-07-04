# AgentLens Launch Plan

This document keeps the GitHub launch focused on product trust, developer experience, and distribution.

## Current State

Built:

- Trace schema.
- Local run store.
- CLI.
- Demo trace generator.
- Inspect summary.
- Replay transcript.
- JSON eval engine.
- Static HTML dashboard.
- Apache-2.0 license.
- Contribution and security docs.
- GitHub Actions smoke-test workflow.
- Unit tests for trace, eval, and dashboard escaping.
- Failure-case demo for forbidden tools and missing citations.
- GitHub issue templates.
- README dashboard preview asset.
- Batch `agentlens ci` command.
- MCP-style tool-call adapter MVP.
- MCP adapter documentation and demo.
- MCP stdio JSON-RPC transport demo.
- MCP policy eval rules.
- JSONL streaming trace writer and materializer.
- Public JavaScript API and package exports.
- Launch demo artifact generator.
- Trace redaction CLI and API.

Missing before a serious public launch:

- One production-oriented framework adapter or hardened MCP transport integration.
- Real browser screenshot or GIF generated from `.agentlens/launch/*.html`.
- Release tag.

## Priority 1: Make The Project Trustworthy

Do these before asking strangers to star it:

1. Harden the MCP stdio transport demo into a production-oriented adapter.
2. Replace the SVG preview with a real screenshot or GIF.
3. Record a short launch GIF from `.agentlens/launch/support-agent.html`.
4. Tag the first release.
5. Keep the CI workflow green as adapters are added.

## Priority 2: Make The Product Real

The MVP becomes much more credible when it works with one real ecosystem:

1. Add a tiny JavaScript wrapper for LLM calls.
2. Add MCP tool schema capture and policy reporting.
3. Add a LangGraph or generic tool-call adapter example.
4. Add a scanner for dangerous MCP capabilities.
5. Add a live local dashboard mode.

## Priority 3: Make The README Convert

The GitHub README should do five jobs fast:

1. Show the pain: AI agents are hard to debug.
2. Show the payoff: trace, replay, eval, dashboard.
3. Show a five-minute demo.
4. Show concrete output.
5. Show a believable roadmap.

Avoid vague claims such as "production-ready" before adapters, tests, and CI exist.

## Launch Sequence

### Soft Launch

- Publish repo.
- Ask 5-10 AI/devtool builders for feedback.
- Fix install friction and unclear docs.
- Collect the first real traces from non-demo users.

### Public Launch

- Launch on Hacker News with a technical post.
- Share a short demo thread on X/Twitter.
- Post to relevant communities: agent builders, RAG developers, MCP builders, local AI communities.
- Publish a short article: "How to debug AI agent runs with trace, replay, and evals."

### After Launch

- Respond to issues within 24 hours.
- Convert repeated questions into docs.
- Ship one visible improvement every few days for the first two weeks.
- Keep the roadmap public and concrete.

## Star Growth Hooks

Good star-worthy hooks:

- "Chrome DevTools for AI agents."
- "Replay failed agent runs without calling the model again."
- "CI checks for tool-using agents."
- "Static trace reports for GitHub issues."

Avoid hooks that sound like every other agent project:

- "Build better agents."
- "The ultimate AI framework."
- "All-in-one LLM platform."

## Next Milestone

Target `v0.2.0`:

- Hardened MCP transport adapter or one popular framework adapter.
- Real launch GIF or screenshot.
- First release tag.
