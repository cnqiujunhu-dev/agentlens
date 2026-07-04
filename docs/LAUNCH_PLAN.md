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
- Static trace diff dashboards.
- JSON report output for CLI automation.
- GitHub Actions Markdown summary output.
- GitHub Action status/count outputs for downstream workflow steps.
- Workspace doctor for local setup, trace, eval config, and CI checks.
- Validation command for trace and eval files.
- Redacted share bundles for issues, pull requests, and support threads.
- JSON eval engine.
- Generic LLM call adapter.
- Static HTML dashboard.
- Local dashboard server.
- Dashboard JSON APIs and live file-change refresh.
- Dashboard timeline filters for long traces.
- Release audit script.
- Composite GitHub Action for `agentlens ci`.
- Apache-2.0 license.
- Contribution, support, security, and code of conduct docs.
- Pull request template.
- GitHub Actions smoke-test workflow.
- Unit tests for trace, eval, and dashboard escaping.
- Failure-case demo for forbidden tools and missing citations.
- GitHub issue templates.
- README dashboard preview asset.
- Batch `agentlens ci` command.
- MCP-style tool-call adapter MVP.
- MCP adapter documentation and demo.
- MCP stdio JSON-RPC transport demo.
- Reusable MCP stdio trace sessions with tool inventory and diagnostics.
- MCP policy eval rules.
- MCP tool inventory and risk scanner.
- Reviewed-risk policy exceptions for MCP tools.
- Owner and expiry checks for MCP risk exceptions.
- JSONL streaming trace writer and materializer.
- Public JavaScript API and package exports.
- Launch demo artifact generator.
- README launch GIF generated from launch dashboard artifacts.
- Release checklist, demo recording guide, and launch post draft.
- Trace redaction CLI and API.
- Real dashboard screenshot for README.
- Trace/Eval JSON Schemas.
- OpenAI-compatible and Anthropic-compatible provider adapter helpers.
- LangGraph-style node adapter and demo eval pack.

Missing before a serious public launch:

- Release tag.
- Public repository remote.

## Priority 1: Make The Project Trustworthy

Do these before asking strangers to star it:

1. Add the release tag.
2. Publish the GitHub repository.
3. Run the release checklist before public posting.
4. Keep `npm run verify`, `npm run release:audit`, and the GitHub Action smoke test green as adapters are added.

## Priority 2: Make The Product Real

The MVP becomes much more credible when it works with one real ecosystem:

1. Add a LangGraph or generic tool-call adapter example.
2. Add richer dashboards for MCP exception review history.
3. Add framework adapter examples.

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

- One popular framework adapter.
- First release tag.
