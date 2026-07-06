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
- Agent regression PR demo artifacts for before/after review.
- `agentlens review` artifact packs for real baseline/candidate traces.
- JSON report output for CLI automation.
- GitHub Actions Markdown summary output.
- GitHub Action status/count outputs for downstream workflow steps.
- GitHub Action review pack outputs for baseline/candidate trace handoffs.
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
- Release preflight script for clean worktree, remote, tag, GIF, audit, and verify checks.
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
- Local security scan for secret leaks, prompt injection phrases, and high-risk tool calls.
- CI scan gates through `agentlens ci --scan` and the composite GitHub Action.
- SARIF export for scan findings.
- Dashboard Security Scan panel.
- Public roadmap.
- Market analysis against Langfuse, LangSmith, Phoenix, Helicone, OpenLLMetry, OpenLIT, and Braintrust.
- Bilingual README entry points for English and Simplified Chinese audiences.
- Quickstart artifact pack through `agentlens quickstart`.
- LLM SDK wrapper cookbook for wiring existing provider clients into AgentLens traces.
- OpenTelemetry/OpenInference-style OTLP JSON export for local trace files and batch run directories.
- Minimal zero-dependency sync/async Python trace writer demo for Python agent and RAG projects.
- PyPI-ready `agentlens-trace` package skeleton and smoke verification.
- Local installed-package smoke check through `npm run python:publish:check`.
- Python publishing guide for TestPyPI, PyPI Trusted Publishing, versioning, and rollback.
- Trusted Publishing workflow for TestPyPI/PyPI package handoff.
- Python project starter scaffold through `agentlens init --python`.
- Zero-dependency Python bridge helpers under `agentlens_trace.adapters`.
- Python framework cookbook demo for LangChain-style, LlamaIndex-style, and CrewAI-style projects.
- LangChain-like object payload fixture for Python adapter compatibility checks.
- Packed npm tarball install smoke check for clean-project quickstart validation.
- Publishable npm package identity as `agentlens-devtools` with `agentlens` CLI command.
- npm publish dry-run check for package metadata, packed files, and bin-field stability.

Public launch status:

- Repository is public at `https://github.com/cnqiujunhu-dev/agentlens`.
- `main` is pushed and configured as the default branch.
- Latest published tag is `v0.3.0`; follow-up hardening is tracking toward the next patch or minor release.
- GitHub Actions is expected to pass for both `main` and each release tag.

## Priority 1: Keep The Project Trustworthy

Do these before asking more strangers to star it:

1. Run the release checklist before public posting.
2. Publish or explicitly defer the `agentlens-devtools` npm package before broad public posting.
3. Run `npm run release:preflight` before each release.
4. Keep `npm run verify`, `npm run release:audit`, and the GitHub Action smoke test green as adapters are added.
5. Convert launch feedback into focused issues and docs updates.

## Priority 2: Make The Product Real

The MVP becomes much more credible when it works with one real ecosystem:

1. Harden the LangGraph adapter against common graph/node shapes.
2. Expand AutoGen and CrewAI-style examples into deeper cookbook notes.
3. Add richer dashboards for MCP exception review history.

## Priority 3: Make The README Convert

The GitHub README should do five jobs fast:

1. Show the pain: AI agents are hard to debug.
2. Show the payoff: trace, replay, eval, dashboard.
3. Show a five-minute demo.
4. Show concrete output.
5. Show a believable roadmap.
6. Let Chinese-speaking developers switch to the Chinese README immediately.

See [ROADMAP.md](ROADMAP.md) for the public roadmap.

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

Target `v0.3.0`:

- Started: PR comment renderer for CI summaries.
- Configurable dashboard sections for eval, scan, MCP risk, and diff.
- Governance docs for reviewed MCP risk exceptions.
- Started: OpenTelemetry/OpenInference-style OTLP JSON export.
- Started: Python trace writer path for Python-heavy teams.
