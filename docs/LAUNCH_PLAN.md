# AgentLens Launch Plan

This document keeps the GitHub launch focused on product trust, developer experience, and distribution.

## Current State

Built:

- Trace schema.
- Local run store.
- CLI.
- Init scaffolding for starter evals and GitHub Action examples.
- Demo trace generator.
- Inspect summary.
- Replay transcript.
- Trace diff CLI and API.
- JSON report output for CLI automation.
- GitHub Actions Markdown summary output.
- JSON eval engine.
- Generic LLM call adapter.
- Static HTML dashboard.
- Local dashboard server.
- Dashboard JSON APIs and live file-change refresh.
- Dashboard timeline filters for long traces.
- Release audit script.
- Composite GitHub Action for `agentlens ci`.
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
- MCP tool inventory and risk scanner.
- Reviewed-risk policy exceptions for MCP tools.
- JSONL streaming trace writer and materializer.
- Public JavaScript API and package exports.
- Launch demo artifact generator.
- Trace redaction CLI and API.
- Real dashboard screenshot for README.
- Trace/Eval JSON Schemas.
- OpenAI-compatible and Anthropic-compatible provider adapter helpers.

Missing before a serious public launch:

- One production-oriented framework adapter or hardened MCP transport integration.
- Release GIF generated from `.agentlens/launch/*.html`.
- Release tag.

## Priority 1: Make The Project Trustworthy

Do these before asking strangers to star it:

1. Harden the MCP stdio transport demo into a production-oriented adapter.
2. Record a short launch GIF from `.agentlens/launch/support-agent.html`.
3. Add the release tag.
4. Publish the GitHub repository.
5. Keep `npm run verify`, `npm run release:audit`, and the GitHub Action smoke test green as adapters are added.

## Priority 2: Make The Product Real

The MVP becomes much more credible when it works with one real ecosystem:

1. Add expiring owners for reviewed MCP risk exceptions.
2. Add a LangGraph or generic tool-call adapter example.
3. Add dashboard diff views using the trace diff API.

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
