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
- Launch demo artifact generator.
- Public JavaScript API and package exports.
- GitHub Actions CI workflow.
- Issue templates, contribution docs, security docs, and Apache-2.0 license.
