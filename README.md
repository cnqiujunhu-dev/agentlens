# AgentLens

Trace, replay, evaluate, and share AI agent runs before they break in production.

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

Languages: [English](README.md) | [简体中文](README.zh-CN.md)

AgentLens is a local-first DevTools stack for AI agents, multi-agent workflows, tool calls, RAG flows, and MCP-style integrations. It turns one recorded run into reviewable evidence: a readable trace, deterministic replay, JSON evals, security scan, static dashboard, PR comment, SARIF, and CI artifact bundle.

```text
agent run -> trace -> replay -> eval + scan -> dashboard -> PR artifact
```

![AgentLens demo](docs/assets/agentlens-demo.gif)

Static screenshot: [dashboard-screenshot.png](docs/assets/dashboard-screenshot.png)

## What You Get From One Run

| Artifact | What it answers |
| --- | --- |
| Trace JSON | What did the model see, which tools ran, what did retrieval return, and where did errors happen? |
| Replay transcript | Can a teammate understand the timeline without rerunning the model? |
| Eval and scan gates | Did the run violate citation, latency, cost, workflow, safety, secret, or tool-risk rules? |
| Static dashboard | Can reviewers inspect tool groups, workflow boundaries, security findings, and timeline filters in a browser? |
| PR review pack | Can before/after traces become a CI summary, PR comment, SARIF, diff dashboard, and downloadable run bundle? |

No hosted account, database, collector, or long-running dashboard service is required for the core workflow.

## 30-Second Quickstart

Use the clone path until the npm package is published:

```bash
git clone https://github.com/cnqiujunhu-dev/agentlens.git
cd agentlens
npm install
node ./bin/agentlens.js quickstart --python
node ./bin/agentlens.js ci --runs .agentlens/quickstart/runs --config .agentlens/evals/default.json --scan
```

Open `.agentlens/quickstart/reports/dashboard.html` for the trace dashboard, or attach `.agentlens/quickstart/reports/bundle/index.html` as a static CI artifact.

The quickstart writes a complete artifact pack under `.agentlens/quickstart/`, so you can inspect the product without wiring your own agent first.

## PR Regression Review

AgentLens can turn recorded before/after agent runs into pull request artifacts: a CI summary, stable PR comment body, SARIF scan findings, a static diff dashboard, and a run bundle reviewers can open without rerunning the model.

```bash
npm run demo:regression-pr
```

![AgentLens regression PR diff](docs/assets/regression-pr-diff.png)

## Why AgentLens

AI agents are easy to demo and hard to debug.

When an agent fails, teams usually lose time answering the same questions:

- What did the model see?
- Which tool did it call?
- What did retrieval return?
- Why did the final answer change?
- Did the run violate a cost, latency, safety, or citation rule?
- Can this failure be reproduced in CI?

AgentLens makes those questions inspectable with plain local files. No cloud account is required.

Use it first when you need to debug one failed agent run, review a risky tool call, prove a RAG answer cited the right source, or stop an agent regression from merging.

## Market Positioning

AgentLens is not trying to replace Langfuse, LangSmith, Phoenix, Helicone, OpenLIT, OpenLLMetry, or Braintrust. Those projects are strong full-platform or telemetry-stack choices. AgentLens is the lightweight local and CI artifact layer you can adopt before a hosted observability platform: trace a run, replay it, scan it, diff it, gate it in CI, and attach static evidence to a pull request. The wedge is not tracking every production request; it is making one failed or changed agent run reviewable in a PR, issue, support thread, or incident note.

See [MARKET_ANALYSIS.md](docs/MARKET_ANALYSIS.md) for the detailed comparison and roadmap implications.

## What You Get

- Trace model for LLM prompts, responses, tool calls, retrieval, errors, usage, and metadata.
- `agentlens quickstart` artifact pack for a one-command local demo with trace, eval, scan, dashboard, PR comment, OTLP, run bundle, and share bundle outputs.
- Publishable npm package name `agentlens-devtools` with CLI command `agentlens`.
- Generic LLM wrapper for tracing model calls from any SDK.
- OpenAI-compatible and Anthropic-compatible provider adapter helpers.
- LLM SDK cookbook for wiring existing provider clients into local traces.
- Zero-dependency sync/async Python trace writer example for Python agent and RAG projects.
- PyPI-ready `agentlens-trace` package skeleton with import name `agentlens_trace`.
- Zero-dependency Python adapter helpers under `agentlens_trace.adapters`.
- Local installed-package smoke check through `npm run python:publish:check`.
- Python publishing guide for TestPyPI, PyPI Trusted Publishing, versioning, and rollback.
- `.github/workflows/python-publish.yml` Trusted Publishing workflow for TestPyPI and PyPI handoff.
- Tarball install smoke check through `npm run pack:smoke` for packaged CLI and API confidence.
- npm publish dry-run check through `npm run npm:publish:check` for package metadata, packed files, and registry publish readiness.
- Post-publish npm smoke check through `npm run npm:postpublish:check` for registry installs and one-command quickstart confidence.
- `agentlens init --python` starter scaffold for Python projects.
- Python framework cookbook for `AgentLensLangChainBridge`, `AgentLensLlamaIndexBridge`, and `AgentLensCrewAIBridge` trace boundaries.
- LangChain-like object payload fixture for Python adapter confidence.
- OpenTelemetry/OpenInference-style OTLP JSON export for single traces and batch run directories.
- LangGraph-style node adapter for tracing graph-based agent steps.
- Multi-agent helpers with AutoGen-style and CrewAI-style runnable examples.
- Deterministic replay that reconstructs the timeline without calling a model again.
- Trace diff reports for before/after agent regressions.
- Static diff dashboards for sharing before/after regressions.
- `agentlens review` for turning baseline/candidate traces into a PR-ready review pack.
- Static run bundles for reviewing a directory of traces as a CI artifact, including workflow counts in the index.
- Machine-readable `manifest.json` output for run bundle automation, including workflow counts for PR bots.
- Dashboard review workflow for PR artifacts, compact sections, and filtered view links.
- Runnable agent regression PR demo that emits CI summary, SARIF, diff dashboard, and run bundle artifacts.
- JSON output for inspect, eval, CI, and diff automation.
- Markdown CI summaries for GitHub Actions.
- PR comment Markdown output for GitHub review workflows.
- Upsert PR comment workflow using the stable `agentlens-ci-comment` marker.
- GitHub Action outputs for downstream workflow steps.
- GitHub Action run bundle and `bundle-manifest` outputs for uploadable PR review artifacts.
- GitHub Action review pack outputs for baseline/candidate traces.
- Workspace doctor for checking local setup, traces, eval config, and CI wiring.
- Validation command for trace files and eval configs.
- Local security scan for secret leaks, prompt injection phrases, and high-risk tool calls.
- SARIF output for uploading agent trace scan findings to GitHub code scanning.
- Batch SARIF output from CI scan gates for run directories.
- Redacted share bundle generation for GitHub issues, PRs, and support threads.
- JSON eval rules for required events, forbidden tools, error budgets, workflow gates, cost budgets, latency budgets, and citation checks.
- MCP policy rules for server allowlists, required tool metadata, and forbidden tool permissions.
- MCP tool inventory and risk scanning.
- Zero-dependency stdio JSON-RPC MCP transport demo.
- MCP stdio trace sessions for reusing a server process across multiple tool calls.
- Static HTML dashboard with timeline filters and security scan findings for issues, PRs, and incident notes.
- Configurable dashboard sections for compact PR comments, support bundles, and focused trace reviews.
- Tool call groups that summarize repeated tool calls with risk, latency, first/last links, and one-click timeline filters.
- Workflow Review dashboard section for chain boundaries, agent tasks, and paired error markers.
- Local dashboard server with JSON APIs and file-change refresh.
- Timeline filters for event type, status, search text, MCP risk, and shareable filtered view links.
- Timeline jumps for errors, high-risk tool calls, final responses, and last events.
- Composite GitHub Action for failing PRs on agent eval regressions and scan findings.
- Zero runtime dependencies in the MVP.

## Install

After the npm package is published, use `agentlens-devtools` as the package name and `agentlens` as the CLI command:

```bash
npm exec --package agentlens-devtools -- agentlens quickstart --python
npm install -D agentlens-devtools
npx agentlens doctor
```

Do not use `npm install agentlens`: that npm name is already occupied by an unrelated package. Until the npm package is published, use the clone-based Quick Demo below.

## Quick Demo

```bash
npm install
node ./bin/agentlens.js quickstart --python
node ./bin/agentlens.js init
node ./bin/agentlens.js init --python
node ./bin/agentlens.js doctor
node ./bin/agentlens.js demo --out .agentlens/runs/demo.json
node ./bin/agentlens.js inspect .agentlens/runs/demo.json
node ./bin/agentlens.js replay .agentlens/runs/demo.json
node ./bin/agentlens.js redact .agentlens/runs/demo.json --out .agentlens/runs/demo.redacted.json
node ./bin/agentlens.js otel .agentlens/runs/demo.json --out .agentlens/reports/demo.otlp.json
node ./bin/agentlens.js otel-batch .agentlens/runs --out .agentlens/reports/otel
npm run otel:batch
npm run demo:python
npm run demo:python:frameworks
npm run python:package
npm run python:publish:check
npm run pack:smoke
npm run npm:publish:check
PYTHONPATH=python/agentlens-trace/src python -m agentlens_trace.adapters --out .agentlens/runs/python-adapters-demo.json
node ./bin/agentlens.js share .agentlens/runs/demo.json --config .agentlens/evals/default.json --out .agentlens/share/demo --sections summary,timeline
node ./bin/agentlens.js eval .agentlens/runs/demo.json --config .agentlens/evals/default.json
node ./bin/agentlens.js scan .agentlens/runs/demo.json
node ./bin/agentlens.js validate trace .agentlens/runs/demo.json
node ./bin/agentlens.js validate eval .agentlens/evals/default.json
node ./bin/agentlens.js ci --runs .agentlens/runs --config .agentlens/evals/default.json --scan
node ./bin/agentlens.js ci --runs .agentlens/runs --config .agentlens/evals/default.json --scan --pr-comment-md .agentlens/reports/pr-comment.md
node ./bin/agentlens.js dashboard .agentlens/runs/demo.json --out .agentlens/reports/demo.html --sections summary,timeline
node ./bin/agentlens.js bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,timeline
node ./bin/agentlens.js serve .agentlens/runs --port 4317
npm run demo:regression-pr
```

`agentlens quickstart` writes an isolated artifact pack under `.agentlens/quickstart/`, including a passing demo trace, eval report, scan report, dashboard, OTLP JSON, PR comment Markdown, run bundle, and redacted share bundle. See [QUICKSTART_ARTIFACTS.md](docs/QUICKSTART_ARTIFACTS.md).

`agentlens init` creates starter files under `.agentlens/`, including an editable eval config and a copyable GitHub Action example. `agentlens init --python` also creates `.agentlens/python/basic_run.py`, `.agentlens/python/agentlens_trace.py`, and `.agentlens/examples/python-github-action.yml`.

Python users can start from the `agentlens-trace` package skeleton in `python/agentlens-trace/`, from `examples/python-basic-run.py` and `examples/python-async-run.py`, or run `npm run demo:python` to write AgentLens-compatible sync/async traces, validate them, evaluate them, scan them, and export OTLP JSON. The package exposes `AgentLensRun`, `trace_llm_call`, `trace_async_llm_call`, and framework helpers through `agentlens_trace.adapters`. `npm run python:publish:check` installs the package into a temporary target directory and verifies the installed package entrypoints before a release.

See [PYTHON_PUBLISHING.md](docs/PYTHON_PUBLISHING.md) for the Python package release path, including TestPyPI rehearsal, PyPI Trusted Publishing, versioning, and rollback.

For framework-shaped Python projects, run `npm run demo:python:frameworks` or see `examples/python-framework-cookbook-run.py` for LangChain-style callbacks, LlamaIndex-style event hooks, and CrewAI-style task boundaries backed by `AgentLensLangChainBridge`, `AgentLensLlamaIndexBridge`, and `AgentLensCrewAIBridge`. The same demo gate also runs `examples/python-langchain-fixture-run.py`, which covers LangChain-like document, prompt, message, generation, and token-usage payloads.

Package-style users can also run `PYTHONPATH=python/agentlens-trace/src python -m agentlens_trace.adapters --out .agentlens/runs/python-adapters-demo.json` to generate an adapter demo trace directly from the Python package.

Want this in GitHub Actions?

```yaml
- name: Run AgentLens evals
  uses: cnqiujunhu-dev/agentlens@v0.3.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    scan-fail-on: high
    bundle: .agentlens/reports/bundle
    bundle-sections: summary,scan,tool-calls,workflow,filters,timeline
```

Need schemas for editor or CI tooling?

```bash
node ./bin/agentlens.js schema trace
node ./bin/agentlens.js schema eval
```

Want to see eval failures?

```bash
npm run demo:fail
node ./bin/agentlens.js eval .agentlens/runs/failing-demo.json --config evals/default.json
```

Want to compare a regression against the healthy demo?

```bash
npm run demo
npm run diff:demo
npm run diff:dashboard
node ./bin/agentlens.js review .agentlens/runs/demo.json .agentlens/runs/failing-demo.json --config evals/default.json --out .agentlens/review
```

`agentlens review` writes a PR-ready artifact pack with copied traces, eval policy, CI summary, PR comment Markdown, SARIF, diff dashboard, and run bundle. See [AGENT_REVIEW.md](docs/AGENT_REVIEW.md).

Want to wrap a generic LLM call?

```bash
npm run demo:llm
node ./bin/agentlens.js replay .agentlens/runs/llm-wrapper-demo.json
node ./bin/agentlens.js eval .agentlens/runs/llm-wrapper-demo.json --config evals/llm-basic.json
```

See the [LLM SDK cookbook](docs/LLM_SDK_COOKBOOK.md) for OpenAI-compatible, Anthropic-compatible, custom SDK, error handling, CI, and redaction patterns.

Want provider-style SDK adapters without adding SDK dependencies?

```bash
npm run demo:providers
node ./bin/agentlens.js replay .agentlens/runs/provider-adapters-demo.json
node ./bin/agentlens.js eval .agentlens/runs/provider-adapters-demo.json --config evals/llm-basic.json
```

Want to trace LangGraph-style node functions?

```bash
npm run demo:langgraph
node ./bin/agentlens.js replay .agentlens/runs/langgraph-style-demo.json
node ./bin/agentlens.js eval .agentlens/runs/langgraph-style-demo.json --config evals/langgraph-basic.json
```

Want to trace AutoGen-style or CrewAI-style multi-agent workflows?

```bash
npm run demo:autogen
node ./bin/agentlens.js replay .agentlens/runs/autogen-style-demo.json
node ./bin/agentlens.js eval .agentlens/runs/autogen-style-demo.json --config evals/multi-agent-basic.json
npm run demo:crewai
node ./bin/agentlens.js replay .agentlens/runs/crewai-style-demo.json
node ./bin/agentlens.js eval .agentlens/runs/crewai-style-demo.json --config evals/multi-agent-basic.json
```

Want to trace an MCP-style tool call?

```bash
npm run demo:mcp
node ./bin/agentlens.js replay .agentlens/runs/mcp-demo.json
node ./bin/agentlens.js eval .agentlens/runs/mcp-demo.json --config evals/mcp-policy.json
```

Want a real stdio JSON-RPC MCP transport demo?

```bash
npm run demo:mcp:stdio
node ./bin/agentlens.js replay .agentlens/runs/mcp-stdio-demo.json
node ./bin/agentlens.js eval .agentlens/runs/mcp-stdio-demo.json --config evals/mcp-policy.json
```

Need to reuse one MCP stdio server for multiple calls? Use `McpStdioTraceSession` from the JavaScript API.

Want append-friendly streaming traces?

```bash
npm run demo:jsonl
node ./bin/agentlens.js materialize .agentlens/runs/jsonl-demo.jsonl --out .agentlens/runs/jsonl-demo.json
```

Preparing launch screenshots or a demo recording?

```bash
npm run launch:demo
npm run release:gif
npm run bundle:demo
npm run share:demo
npm run release:audit
npm run release:preflight:local
```

This writes shareable traces, eval reports, and dashboards into `.agentlens/launch/`.

Sharing a trace publicly?

```bash
node ./bin/agentlens.js redact .agentlens/runs/demo.json --out .agentlens/runs/demo.redacted.json
node ./bin/agentlens.js scan .agentlens/runs/demo.redacted.json
```

Eval output:

```text
Eval: baseline-agent-quality
Status: PASS

[PASS] has-core-events: All required event types are present
[PASS] no-errors: Found 0 errors
[PASS] no-workflow-errors: Found 0 workflow errors
[PASS] no-dangerous-tools: No forbidden tools were called
[PASS] tool-latency-budget: All tool results are within 3000ms
[PASS] cost-budget: Cost $0.0021 within budget
[PASS] has-final-answer: Final LLM response is present
[PASS] final-answer-has-citation: Final response has 2 citations
```

Replay output:

```text
01 [+  90ms] LLM PROMPT planner
02 [+ 770ms] LLM RESPONSE planner 680ms
03 [+ 840ms] TOOL CALL kb.search
04 [+1058ms] RETRIEVAL RESULT policy-search 148ms
05 [+1810ms] LLM RESPONSE final-answer 600ms
```

## How It Works

```mermaid
flowchart LR
  A[Agent / App / MCP Server] --> B[Trace Adapter]
  B --> C[AgentLens Trace JSON]
  C --> D[Replay Transcript]
  C --> E[Eval Rules]
  C --> F[Static Dashboard]
  C --> H[Security Scan]
  E --> G[CI Exit Code]
  H --> G
```

The MVP stores each run as a single JSON file:

```json
{
  "schemaVersion": "agentlens.trace.v1",
  "runId": "run_...",
  "app": "support-agent",
  "name": "refund policy question",
  "status": "passed",
  "events": [
    { "type": "llm.prompt" },
    { "type": "tool.call" },
    { "type": "tool.result" },
    { "type": "llm.response" }
  ]
}
```

## CLI

```text
agentlens init
agentlens init [--python]
agentlens quickstart [--python]
agentlens doctor [--json]
agentlens demo [--out path]
agentlens inspect <trace-file> [--json]
agentlens replay <trace-file>
agentlens review <baseline-trace> <candidate-trace> [--config path] [--out dir] [--no-scan] [--fail-on-failure]
agentlens diff <baseline-trace> <candidate-trace> [--json]
agentlens diff-dashboard <baseline-trace> <candidate-trace> [--out path]
agentlens eval <trace-file> [--config path] [--json]
agentlens scan <trace-file> [--json] [--fail-on low|medium|high|critical|none] [--sarif path]
agentlens ci [--runs dir] [--config path] [--json] [--summary-md path] [--pr-comment-md path]
agentlens otel <trace-file> [--out path] [--service-name name]
agentlens otel-batch [runs-dir] [--out dir] [--service-name name]
agentlens schema <trace|eval> [--out path]
agentlens validate <trace|eval> <file> [--json]
agentlens materialize <jsonl-file> [--out path]
agentlens redact <trace-file> [--out path] [--keys key1,key2]
agentlens share <trace-file> [--config path] [--out dir] [--keys key1,key2] [--sections summary,event-types,scan,tool-calls,workflow,filters,timeline]
agentlens dashboard <trace-file> [--out path] [--sections summary,event-types,scan,tool-calls,workflow,filters,timeline]
agentlens bundle [runs-dir] [--out dir] [--sections summary,event-types,scan,tool-calls,workflow,filters,timeline]
agentlens serve [trace-file|runs-dir] [--host host] [--port port]
```

## JavaScript API

```js
import { addEvent, createRun, evaluateTrace, finishRun, scanTrace, writeTrace } from "agentlens-devtools";

const run = createRun({ app: "support-agent", name: "refund question" });
addEvent(run, { type: "llm.prompt", name: "planner" });
addEvent(run, {
  type: "llm.response",
  name: "final-answer",
  output: { content: "Refunds are available within 30 days.", citations: ["refund-policy"] }
});
finishRun(run, "passed");
writeTrace(".agentlens/runs/refund.json", run);

const report = evaluateTrace(run, {
  name: "citation-policy",
  assertions: [{ id: "citations", type: "required-citations", min: 1 }]
});

const scan = scanTrace(run);
```

See [API.md](docs/API.md) for trace, eval, scan, JSONL, and MCP helper examples.

## Launch Materials

- [Launch plan](docs/LAUNCH_PLAN.md)
- [Launch copy](docs/LAUNCH_COPY.md)
- [Release checklist](docs/RELEASE_CHECKLIST.md)
- [Demo recording guide](docs/DEMO_RECORDING.md)
- [Launch post draft](docs/LAUNCH_POST.md)
- [Roadmap](docs/ROADMAP.md)
- [Market analysis](docs/MARKET_ANALYSIS.md)
- [Quickstart artifacts](docs/QUICKSTART_ARTIFACTS.md)
- [Agent review packs](docs/AGENT_REVIEW.md)
- [LLM SDK cookbook](docs/LLM_SDK_COOKBOOK.md)
- [Python trace writer](docs/PYTHON_TRACE_WRITER.md)
- [Python publishing](docs/PYTHON_PUBLISHING.md)
- [npm publishing](docs/NPM_PUBLISHING.md)
- [Python framework cookbook](docs/PYTHON_FRAMEWORK_COOKBOOK.md)
- [OpenTelemetry export](docs/OTEL_EXPORT.md)
- [Agent regression PR example](docs/AGENT_REGRESSION_PR.md)
- [GitHub Action](docs/GITHUB_ACTION.md)
- [Run bundles](docs/RUN_BUNDLES.md)
- [Dashboard review workflow](docs/DASHBOARD_REVIEW.md)
- [Security scan](docs/SECURITY_SCAN.md)
- [MCP risk exceptions](docs/MCP_RISK_EXCEPTIONS.md)
- [LangGraph-style adapter](docs/LANGGRAPH_ADAPTER.md)
- [Multi-agent adapters](docs/MULTI_AGENT_ADAPTERS.md)
- [Changelog](CHANGELOG.md)
- [JSON schemas](docs/SCHEMAS.md)

Before publishing, run `npm run release:preflight` after configuring the GitHub remote and tagging the release. Use `npm run release:preflight:local` for local checks before the remote and tag exist.

## Community

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Support](SUPPORT.md)
- [Security](SECURITY.md)

## Eval Rules

Rules live in JSON so they can be reviewed, versioned, and run in CI.

```json
{
  "name": "baseline-agent-quality",
  "assertions": [
    {
      "id": "no-dangerous-tools",
      "type": "forbidden-tools",
      "tools": ["rm", "delete_database", "git.reset.hard"]
    },
    {
      "id": "final-answer-has-citation",
      "type": "required-citations",
      "min": 1
    },
    {
      "id": "no-workflow-errors",
      "type": "max-workflow-errors",
      "max": 0
    },
    {
      "id": "has-agent-task-boundaries",
      "type": "min-workflow-tasks",
      "min": 2
    }
  ]
}
```

## Security Scan

`agentlens scan` is a local heuristic pass for issues that are easy to miss in raw traces:

- secret-shaped values such as API keys, GitHub tokens, JWTs, and bearer tokens
- sensitive fields that were not redacted
- prompt injection phrases in prompt, retrieval, and response content
- declared or inferred high-risk tool calls

```bash
agentlens scan .agentlens/runs/demo.json
agentlens scan .agentlens/runs/demo.json --fail-on medium
agentlens scan .agentlens/runs/demo.json --json
agentlens scan .agentlens/runs/demo.json --sarif .agentlens/reports/agentlens-scan.sarif
agentlens ci --runs .agentlens/runs --config evals/default.json --scan --scan-fail-on high
agentlens ci --runs .agentlens/runs --config evals/default.json --scan --scan-fail-on none --sarif .agentlens/reports/agentlens-ci.sarif
```

The default threshold fails on `high` and `critical` findings. Medium findings, such as prompt-injection phrases, are reported as warnings unless you opt into `--fail-on medium`. CI can run the same scan with `--scan --scan-fail-on high`. Use `--sarif` on `scan` for one trace or on `ci --scan` for a run directory when you want GitHub code scanning or another SARIF consumer to ingest trace findings. Static dashboards include a Security Scan panel, and share bundles include `scan.txt` generated from the redacted trace.

## Use Cases

- Debug tool-using AI agents.
- Trace model calls without binding to one LLM SDK.
- Add AgentLens around existing provider SDK calls with a copyable cookbook.
- Generate a clean quickstart artifact pack with `agentlens quickstart` before wiring your own traces.
- Install the JavaScript CLI/API as `agentlens-devtools` while keeping `agentlens` as the command name.
- Generate a PR-ready before/after review pack with `agentlens review`.
- Write AgentLens-compatible sync/async traces from Python agent, RAG, and notebook code.
- Import `agentlens_trace` from the zero-dependency Python package skeleton.
- Import `AgentLensLangChainBridge`, `AgentLensLlamaIndexBridge`, and `AgentLensCrewAIBridge` from `agentlens_trace.adapters`.
- Verify the installed Python package path locally with `npm run python:publish:check`.
- Verify the packed npm tarball installs and runs from a clean temporary project with `npm run pack:smoke`.
- Verify npm package metadata and publish dry-run output with `npm run npm:publish:check`.
- Verify the published npm package from a clean temporary project with `npm run npm:postpublish:check`.
- Follow the Python publishing guide before TestPyPI or PyPI uploads.
- Configure `.github/workflows/python-publish.yml` as a Trusted Publisher before uploading `agentlens-trace`.
- Verify LangChain-like object payloads through `examples/python-langchain-fixture-run.py`.
- Bootstrap a Python project with `agentlens init --python`, then run `.agentlens/python/basic_run.py` in CI.
- Add trace boundaries around LangChain-style, LlamaIndex-style, and CrewAI-style Python projects without adding framework dependencies to AgentLens.
- Export local traces as OTLP JSON with OpenTelemetry/OpenInference-style attributes, including batch run-directory manifests.
- Verify batch OTLP manifest generation with `npm run otel:batch`.
- Trace LangGraph-style node functions without adding a framework dependency.
- Trace AutoGen-style and CrewAI-style multi-agent workflows without adding framework dependencies.
- Compare before/after traces when an agent regresses.
- Share before/after trace diff dashboards in issues and PRs.
- Generate PR review artifacts for agent regressions.
- Emit JSON reports for CI bots, scripts, and PR comments.
- Add Markdown summaries to GitHub Actions runs.
- Generate stable PR comment Markdown for trace regression reviews.
- Feed GitHub Action status outputs into comments, notifications, or artifacts.
- Generate run bundle artifacts directly from the GitHub Action.
- Wrap OpenAI-compatible and Anthropic-compatible SDK calls.
- Reproduce flaky agent failures.
- Review RAG evidence and citation behavior.
- Add eval checks to CI.
- Scan traces for secret leaks, prompt injection text, and risky tool calls.
- Upload trace scan findings as SARIF for security dashboards.
- Export combined SARIF from CI scan gates for all traces in a run directory.
- Trace MCP-style tool calls.
- Trace real stdio MCP JSON-RPC tool calls.
- Reuse MCP stdio trace sessions across multiple tool calls.
- Enforce MCP server and permission policies.
- Scan MCP tool schemas for risky capabilities.
- Review explicit exceptions for approved risky MCP tools.
- Require owner and expiry metadata for MCP risk exceptions.
- Stream long-running traces as JSONL.
- Redact secrets before sharing traces.
- Generate a redacted share bundle for support threads.
- Publish JSON Schemas for external tooling.
- Validate trace and eval files before sharing or running CI.
- Browse local runs with a zero-dependency dashboard server.
- Generate static run bundles for CI artifacts and support handoffs.
- Feed run bundle manifests into PR bots, dashboards, and CI artifact indexes.
- Poll local trace files while agents are running.
- Filter long traces by event type, status, text, and MCP risk, then copy a shareable filtered view link.
- Review repeated tool calls by grouped count, risk, latency, server, permission, and one-click timeline filtering.
- Jump directly to the first error, first high-risk call, final response, or last event in long traces.
- Render compact dashboard sections for PR comments, incident notes, and support handoffs.
- Start with editable init scaffolding for evals and CI examples.
- Fail GitHub PRs when recorded agent runs violate eval rules or scan gates.
- Generate launch-ready demo artifacts.
- Check local AgentLens setup with `agentlens doctor`.
- Share compact run reports in GitHub issues.
- Build policy packs for MCP servers and internal tools.

## Roadmap

See [ROADMAP.md](docs/ROADMAP.md) for release status, integration milestones, good first issues, and non-goals.

- Unit tests, CI batch eval, failure-case demo, MCP adapter MVP, and MCP policy rules.
- Public JavaScript API and package exports.
- Trace redaction CLI and API.
- Local security scan CLI and API.
- Trace/Eval JSON Schemas.
- Trace diff CLI and API.
- Static trace diff dashboards.
- Static run bundle indexes.
- Runnable agent regression PR artifact generator.
- JSON report output for automation.
- GitHub Actions Markdown summaries.
- GitHub PR comment Markdown renderer.
- Init scaffolding for starter evals and GitHub Action examples.
- Quickstart artifact pack via `agentlens quickstart`.
- Publishable npm package identity as `agentlens-devtools` with `agentlens` CLI command.
- Agent review artifact pack via `agentlens review`.
- Python init scaffolding via `agentlens init --python`.
- Generic LLM call adapter.
- Minimal sync/async Python trace writer example.
- PyPI-ready `agentlens-trace` package skeleton.
- Zero-dependency Python framework bridge helpers under `agentlens_trace.adapters`.
- Installed-package Python smoke check for release confidence.
- Python publishing guide for TestPyPI and trusted publishing.
- Trusted Publishing workflow for TestPyPI and PyPI.
- Packed npm tarball install smoke check for clean-project first-run confidence.
- npm publish dry-run check for package metadata and packed files.
- Post-publish npm registry smoke check for the one-command quickstart path.
- LangChain-like Python fixture for adapter payload confidence.
- Python framework cookbook for LangChain-style, LlamaIndex-style, and CrewAI-style projects.
- OpenTelemetry/OpenInference-style OTLP JSON export with batch manifests.
- LangGraph-style node adapter.
- Multi-agent adapter helpers and AutoGen-style/CrewAI-style examples.
- Local dashboard server.
- GitHub Action for agent regression tests.
- MCP tool inventory and risk scanner.
- MCP stdio trace sessions.
- Live local dashboard refresh.
- Dashboard timeline filters.
- Dashboard shareable filter links.
- Dashboard timeline jumps.
- Dashboard tool call groups.
- Configurable dashboard sections.
- Reviewed MCP risk exceptions.
- Owner and expiry checks for MCP risk exceptions.
- Launch demo artifact generator.
- JavaScript SDK wrapper for common LLM calls.
- Deeper AutoGen and CrewAI integration notes.
- Richer dashboards for MCP exception review history.
- VS Code extension.
- JSONL streaming trace reader and writer.

## Project Philosophy

AgentLens is not another agent framework.

It is the missing engineering layer around agent frameworks: trace, replay, eval, and governance.

## Status

Early MVP. The current version is useful for local traces, quickstart artifact packs, review packs, deterministic replay, JSON evals, security scans, share bundles, CI checks, static dashboard reports, zero-dependency multi-agent examples, and a minimal sync/async Python trace writer with a PyPI-ready package skeleton and importable Python framework bridge helpers. The next milestone is publishing the Python package, hardening adapters against real framework payloads, and richer governance reports.
