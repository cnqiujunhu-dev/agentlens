# AgentLens Roadmap

AgentLens is early, but the direction is intentionally narrow: local-first DevTools for agent traces, evals, scan gates, and shareable debugging artifacts. This roadmap is public so contributors can see what is finished, what is next, and what is deliberately out of scope.

## v0.1.0 Launch Baseline

The first public release should prove that an agent run can be captured, inspected, evaluated, scanned, shared, and reproduced without a hosted service.

Shipped:

- Trace v1 JSON schema and validation.
- CLI for `init`, `quickstart`, `demo`, `inspect`, `replay`, `review`, `eval`, `scan`, `ci`, `redact`, `share`, `dashboard`, `serve`, `diff`, and `validate`.
- Local security scan for leaked secrets, prompt injection phrases, and risky tool calls.
- Single-trace and batch SARIF export for scan findings.
- CI scan gates through `agentlens ci --scan` and the composite GitHub Action.
- Redacted share bundles with dashboard, eval report, scan report, and summary.
- Static run bundles with an index page and per-trace dashboards.
- Static dashboards with timeline filters and a Security Scan panel.
- Deterministic replay and before/after trace diff dashboards.
- JSON eval rules for core agent quality checks, cost, latency, citations, MCP policies, and reviewed MCP risk exceptions.
- Generic LLM wrapper plus OpenAI-compatible, Anthropic-compatible, LangGraph-style, MCP-style, and MCP stdio tracing helpers.
- JSONL streaming trace writer and materializer.
- Release audit, release preflight, launch GIF, launch post draft, issue templates, and community docs.

Release status:

- Public repository: `https://github.com/cnqiujunhu-dev/agentlens`.
- Default branch: `main`.
- First release: `v0.1.0`.
- Latest release target: `v0.2.0`.
- GitHub CI is expected to stay green for `main` and release tags.

## v0.2.0 Integration Release

Goal: make AgentLens feel useful with real agent stacks, not just demos.

Shipped:

- Multi-agent adapter helpers with AutoGen-style and CrewAI-style runnable examples.
- Runnable agent regression PR example that shows eval, scan, dashboard, SARIF, and diff together.
- README regression PR screenshot and reproducible screenshot generation script.
- Node 24-backed GitHub Action dependencies and Node 22 default runtime.

Next:

- Harden the LangGraph adapter against common node and graph shapes.
- Expand AutoGen and CrewAI-style examples into deeper cookbook notes.
- Improve dashboard navigation for long traces and repeated tool calls.
- Add more scan rules with documented false-positive tradeoffs.

## v0.3.0 Team Workflow Release

Goal: make trace review ergonomic for teams using GitHub issues, PRs, and CI.

Started after v0.2.0:

- PR comment renderer for CI summaries.
- Configurable dashboard sections for summary, event types, scan, tool calls, filters, and timeline.
- Governance docs for reviewed MCP risk exceptions.
- Timeline jump links for errors, high-risk calls, final responses, and last events.
- Tool call groups for repeated-call review by risk, latency, server, permission, and one-click timeline filtering.
- Shareable dashboard filter links for PR and issue review.
- Dashboard review workflow docs for PR artifacts, compact sections, and filtered views.
- Agent review packs through `agentlens review`.
- Run bundle `manifest.json` for PR bots, dashboard indexes, and CI artifact automation.
- GitHub Action `bundle` and `bundle-sections` inputs for uploadable run bundle artifacts.
- GitHub Action review pack inputs and outputs for baseline/candidate traces.
- Market analysis and bilingual README positioning for English and Chinese launch audiences.
- Quickstart artifact pack through `agentlens quickstart`.
- LLM SDK wrapper cookbook for existing provider clients, error handling, CI, and redaction patterns.
- OpenTelemetry/OpenInference-style OTLP JSON export for local trace files.
- Minimal zero-dependency sync/async Python trace writer examples and verified demo.
- PyPI-ready `agentlens-trace` package skeleton and verified package smoke test.
- Python project starter scaffold through `agentlens init --python`.
- Importable zero-dependency Python bridge helpers under `agentlens_trace.adapters`.
- Python framework cookbook patterns for LangChain-style, LlamaIndex-style, and CrewAI-style trace boundaries.

Candidates:

- Collector/protobuf export hardening for teams that already use Langfuse, Phoenix, OpenLIT, or existing APM.
- Publish the Python trace writer package and harden framework bridge helpers against real LangChain, LlamaIndex, and CrewAI payload shapes.
- Richer dashboards for MCP exception review history.

## Good First Issues

- Add focused eval assertion tests.
- Improve dashboard empty states and mobile layout.
- Add more examples for provider-style SDK wrappers.
- Improve scan rule descriptions and false-positive examples.
- Add docs for common CI layouts.

## Non-Goals For Now

- Agent orchestration framework features.
- Hosted trace storage.
- Vendor-specific lock-in.
- Heavy runtime dependencies.
- Claims of complete observability or security coverage.

## Success Metrics

- A new user can run the five-minute demo from a clean clone.
- A real project can add `agentlens ci --scan` without changing its agent framework.
- A failing trace can be attached to an issue as a redacted share bundle.
- A maintainer can inspect an agent regression without rerunning the model.
