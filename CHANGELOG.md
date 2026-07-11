# Changelog

## Unreleased

### Added

- LlamaIndex-like QueryBundle and source node fixture coverage for `agentlens_trace.adapters`.
- CrewAI-like agent, task, tool, and task output object fixture coverage for `agentlens_trace.adapters`.
- LangChain-style chain boundary and callback error fixture coverage for `agentlens_trace.adapters`.
- Static dashboard Workflow Review section for chain boundaries, agent tasks, and error markers.
- Reproducible dashboard screenshot generation for README assets.
- Focused launch dashboard artifact for showcasing Workflow Review in README GIFs.
- Run bundle index and `manifest.json` workflow counts for chain, task, and workflow error review.
- Workflow eval assertions for minimum chain/task boundaries and maximum workflow error markers.
- Trace diff and static diff dashboard workflow deltas for chain, task, and workflow error regressions.

### Changed

- Demo traces now include chain and agent task boundary events so the default dashboard shows non-empty Workflow Review content.
- Default, LangGraph, and multi-agent eval packs now gate workflow error markers, and the multi-agent pack requires task boundaries.
- README, Chinese README, launch copy, launch post, and demo recording guide now lead with artifact review outcomes and current Workflow Review dashboard capabilities.
- Python framework bridge helpers now normalize LlamaIndex-style query bundles, `NodeWithScore`-style source nodes, node metadata, source citations, and usage metadata into readable AgentLens trace fields.
- CrewAI-style bridge helpers now normalize agent roles, task descriptions, expected outputs, tool objects, and task output objects into readable AgentLens task and tool events.
- LangChain-style bridge helpers now record chain start/end boundaries plus retriever, tool, chain, and LLM error callback events with paired AgentLens `error` markers.
- Default quickstart, review, and GitHub Action dashboard bundles now include the `workflow` section.

## 0.3.1

### Added

- Trusted Publishing workflow for `agentlens-trace` TestPyPI and PyPI releases.
- Packed npm tarball install smoke check through `npm run pack:smoke`.
- npm publishing guide for the JavaScript CLI/API package.
- npm publish dry-run check through `npm run npm:publish:check`.
- Post-publish npm registry smoke check through `npm run npm:postpublish:check`.

### Changed

- Renamed the npm distribution to `agentlens-devtools`; the CLI command remains `agentlens`, avoiding the unrelated occupied `agentlens` npm package name.

## 0.3.0

### Added

- PR comment Markdown renderer for `agentlens ci` via `--pr-comment-md`.
- Composite GitHub Action `pr-comment` input for writing reusable PR comment bodies.
- Marker-based GitHub Actions example for upserting AgentLens PR comments.
- Configurable static dashboard sections via `agentlens dashboard --sections`, `agentlens share --sections`, and `agentlens bundle --sections`.
- Governance guide for reviewed MCP risk exceptions with owner and expiry review workflow.
- Static dashboard timeline jumps for errors, high-risk calls, final responses, and last events.
- Static dashboard tool call groups for repeated-call review by risk, latency, server, permission, and one-click timeline filtering.
- Shareable static dashboard filter links for PR and issue review.
- Dashboard review workflow guide for PR artifacts, dashboard sections, and filtered view links.
- Agent review packs through `agentlens review` for baseline/candidate traces, PR comments, SARIF, diff dashboards, and run bundles.
- Composite GitHub Action review pack inputs and outputs for baseline/candidate traces.
- Run bundle `manifest.json` output with summary counts and per-trace review metadata.
- Composite GitHub Action `bundle` and `bundle-sections` inputs for generating static run bundle artifacts.
- Quickstart artifact pack through `agentlens quickstart`, generating trace, eval, scan, dashboard, PR comment, OTLP, run bundle, and share bundle outputs.
- Market analysis and positioning guide comparing AgentLens with Langfuse, LangSmith, Phoenix, Helicone, OpenLLMetry, OpenLIT, and Braintrust.
- Simplified Chinese README with language switching from the English README.
- LLM SDK wrapper cookbook for OpenAI-compatible, Anthropic-compatible, custom SDK, error handling, CI, and redaction workflows.
- OpenTelemetry/OpenInference-style OTLP JSON export via `agentlens otel`, `buildOtelTrace`, and `writeOtelTrace`.
- Batch OTLP JSON export via `agentlens otel-batch`, `writeOtelBatch`, and `agentlens.otel-batch.v1` manifests.
- `npm run otel:batch` release gate for generating batch OTLP manifests from `.agentlens/runs`.
- Zero-dependency sync/async Python trace writer examples and `npm run demo:python` verification flow.
- PyPI-ready `agentlens-trace` package skeleton and `npm run python:package` smoke verification.
- Local installed-package Python release smoke check through `npm run python:publish:check`.
- Python publishing guide for TestPyPI, PyPI Trusted Publishing, versioning, and rollback.
- Python project starter scaffolding through `agentlens init --python`.
- Zero-dependency Python bridge helpers under `agentlens_trace.adapters`.
- Python adapter smoke coverage for object-shaped prompts, enum-like payload keys, usage metadata, and source document citations.
- Package-level Python adapter demo via `python -m agentlens_trace.adapters`.
- Python framework cookbook and `npm run demo:python:frameworks` verification flow for LangChain-style, LlamaIndex-style, and CrewAI-style trace boundaries.
- LangChain-like object payload fixture for document, prompt, message, generation, and token-usage adapter checks.

### Changed

- Updated GitHub Action examples and release gates for `cnqiujunhu-dev/agentlens@v0.3.0`.

## 0.2.0

### Added

- Multi-agent adapter helpers for agent messages and task spans.
- AutoGen-style and CrewAI-style runnable demos with a shared multi-agent eval pack.
- Runnable agent regression PR demo that emits CI summary, SARIF, diff dashboard, and run bundle artifacts.
- README regression PR diff screenshot asset and generation script.

### Changed

- Updated GitHub Actions references to Node 24-backed major versions: `actions/checkout@v7` and `actions/setup-node@v6`.
- Updated the composite action default Node.js version to 22.
- Added GitHub CI smoke coverage for the multi-agent demos.
- Replaced placeholder GitHub Action examples with the public `cnqiujunhu-dev/agentlens@v0.2.0` action reference.

## 0.1.0

Initial MVP.

### Added

- AgentLens Trace v1 JSON schema.
- CLI commands: `init`, `demo`, `inspect`, `replay`, `eval`, `ci`, `materialize`, `redact`, and `dashboard`.
- Deterministic replay transcript.
- JSON eval engine with baseline rules.
- Generic LLM call adapter.
- LLM-specific eval pack.
- MCP-style tool-call adapter.
- Zero-dependency MCP stdio JSON-RPC transport demo.
- Reusable MCP stdio trace sessions with tool inventory and diagnostics.
- MCP policy eval pack for server allowlists, required metadata, and forbidden permissions.
- JSONL streaming trace writer and materializer.
- Trace redaction CLI and API.
- Trace and eval JSON Schemas.
- Static HTML dashboard renderer.
- Local dashboard server for trace files and runs directories.
- Release audit script for required files, README sections, exports, and pack contents.
- Composite GitHub Action for running `agentlens ci` in PR workflows.
- OpenAI-compatible and Anthropic-compatible provider adapter helpers.
- LangGraph-style node adapter, demo, and eval pack.
- MCP tool inventory events, schema capture, and risk scanning.
- Reviewed exceptions for MCP high-risk tool policies.
- Owner and expiry validation for MCP risk exceptions.
- Local dashboard JSON APIs and file-change refresh.
- Dashboard timeline filters for event type, status, text, and MCP risk.
- Trace diff CLI and API for before/after run comparisons.
- Static HTML trace diff dashboards.
- JSON output for inspect, eval, CI, and diff CLI reports.
- Markdown CI summaries for GitHub Actions.
- GitHub Action status and count outputs for downstream workflow steps.
- Workspace doctor CLI and API for local setup, trace, eval config, and CI checks.
- Trace and eval validation CLI and API.
- Redacted share bundle CLI and API for issue, PR, and support handoffs.
- `agentlens init` scaffolds starter eval config and a GitHub Action example.
- Launch demo artifact generator.
- Launch demo artifact for the LangGraph-style adapter.
- README launch GIF generated from launch dashboard artifacts.
- Release preflight script for final GitHub publication checks.
- Local security scan CLI and API for secret-shaped values, prompt injection phrases, and risky tool calls.
- CI can combine eval rules with local scan gates via `agentlens ci --scan`.
- `agentlens scan --sarif` exports SARIF 2.1.0 for GitHub code scanning and compatible tools.
- `agentlens ci --scan --sarif` exports combined SARIF for all scanned traces in a run directory.
- Static dashboards include a Security Scan panel with severity, rule, path, event context, and redacted samples.
- Static run bundles generate an index page and per-trace dashboards for run directories.
- Share bundles include `scan.txt` generated from the redacted trace.
- Public roadmap covering release status, integration milestones, good first issues, and non-goals.
- Public GitHub repository target and publication blocker notes.
- Release checklist, demo recording guide, and launch post draft.
- Public JavaScript API and package exports.
- GitHub Actions CI workflow.
- Pull request template, support docs, and code of conduct.
- Issue templates, contribution docs, security docs, and Apache-2.0 license.
