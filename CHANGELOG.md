# Changelog

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
- MCP policy eval pack for server allowlists, required metadata, and forbidden permissions.
- JSONL streaming trace writer and materializer.
- Trace redaction CLI and API.
- Trace and eval JSON Schemas.
- Static HTML dashboard renderer.
- Local dashboard server for trace files and runs directories.
- Release audit script for required files, README sections, exports, and pack contents.
- Composite GitHub Action for running `agentlens ci` in PR workflows.
- OpenAI-compatible and Anthropic-compatible provider adapter helpers.
- MCP tool inventory events, schema capture, and risk scanning.
- Reviewed exceptions for MCP high-risk tool policies.
- Owner and expiry validation for MCP risk exceptions.
- Local dashboard JSON APIs and file-change refresh.
- Dashboard timeline filters for event type, status, text, and MCP risk.
- Trace diff CLI and API for before/after run comparisons.
- Static HTML trace diff dashboards.
- JSON output for inspect, eval, CI, and diff CLI reports.
- Markdown CI summaries for GitHub Actions.
- Workspace doctor CLI and API for local setup, trace, eval config, and CI checks.
- Redacted share bundle CLI and API for issue, PR, and support handoffs.
- `agentlens init` scaffolds starter eval config and a GitHub Action example.
- Launch demo artifact generator.
- Release checklist, demo recording guide, and launch post draft.
- Public JavaScript API and package exports.
- GitHub Actions CI workflow.
- Pull request template, support docs, and code of conduct.
- Issue templates, contribution docs, security docs, and Apache-2.0 license.
