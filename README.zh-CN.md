# AgentLens

在 AI Agent 上线前，把每一次模型调用、工具调用、检索结果和失败原因都变成可复盘、可评审、可进入 CI 的本地证据。

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](package.json)
[![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

语言: [English](README.md) | [简体中文](README.zh-CN.md)

AgentLens 是面向 AI Agent 的 local-first DevTools。它把一次 recorded run 变成可评审证据：可读 trace、deterministic replay、JSON eval、security scan、静态 dashboard、PR comment、SARIF 和 CI artifact bundle。

```text
agent run -> trace -> replay -> eval -> dashboard -> PR artifact
```

![AgentLens demo](docs/assets/agentlens-demo.gif)

静态截图: [dashboard-screenshot.png](docs/assets/dashboard-screenshot.png)

## 一次 Run 会产出什么

| Artifact | 它回答什么问题 |
| --- | --- |
| Trace JSON | 模型看到了什么、调用了哪些工具、检索返回什么、错误发生在哪里？ |
| Replay transcript | 队友不重新调用模型，也能不能看懂完整时间线？ |
| Eval 和 scan gate | 是否违反 citation、latency、cost、安全、secret 或 tool-risk 规则？ |
| 静态 dashboard | Reviewer 能否在浏览器里查看 tool group、workflow boundary、security finding 和 timeline filter？ |
| PR review pack | before/after trace 能否生成 CI summary、PR comment、SARIF、diff dashboard 和可下载 run bundle？ |

核心流程不需要托管账号、数据库、collector 或长期运行的 dashboard 服务。

## 30 秒快速开始

npm package 正式发布前，先使用 clone 本地路径：

```bash
git clone https://github.com/cnqiujunhu-dev/agentlens.git
cd agentlens
npm install
node ./bin/agentlens.js quickstart --python
node ./bin/agentlens.js ci --runs .agentlens/quickstart/runs --config .agentlens/evals/default.json --scan
```

打开 `.agentlens/quickstart/reports/dashboard.html` 可以查看 trace dashboard；也可以把 `.agentlens/quickstart/reports/bundle/index.html` 作为静态 CI artifact 发给 reviewer。

Quickstart 会把完整 artifact pack 写到 `.agentlens/quickstart/`，你不需要先接入自己的 Agent，就能先评估产品体验。

## 为什么需要 AgentLens

AI Agent 很容易做出演示，但很难稳定上线。一次失败通常会带来这些问题：

- 模型到底看到了什么上下文？
- 它调用了哪个工具？参数是什么？
- 检索返回了哪些证据？
- 为什么最终回答变了？
- 是否违反了 cost、latency、citation、tool policy 或安全规则？
- 能不能在 CI 里复现并阻止回归？

AgentLens 的目标不是再造一个 Agent 框架，而是提供 Agent 框架外面的工程层：trace、replay、eval、scan、diff、redact、dashboard 和 GitHub PR review artifact。

最适合先用在这些场景：复盘一次失败的 Agent run、评审一次高风险工具调用、证明 RAG 回答引用了正确来源，或者在 PR 合并前阻止 agent regression。

## 市场定位

Langfuse、LangSmith、Phoenix、Helicone、OpenLIT、OpenLLMetry、Braintrust 都是很强的 AI observability / evaluation / prompt workflow 项目。AgentLens 不应该正面复制它们的完整平台形态。

AgentLens 的差异化是：

- **本地优先**：核心工作流只依赖本地 JSON trace，不需要账号或云服务。
- **CI 优先**：可以在 GitHub Actions 中 fail PR，并生成 Markdown summary、PR comment、SARIF、run bundle 和 `manifest.json`。
- **评审优先**：静态 HTML dashboard 可以直接作为 issue、PR、incident note、support handoff 的证据。
- **Agent 优先**：内置工具调用分组、timeline filter、trace diff、MCP risk、MCP policy、reviewed exception、owner/expiry check。
- **低运维成本**：MVP 零运行时依赖，不需要 Postgres、ClickHouse、Redis、对象存储或长期运行的 dashboard 服务。

核心切入点不是追踪所有生产请求，而是把一次失败或变化的 Agent run 变成 PR、issue、support thread、incident note 都能查看的静态证据。

详细竞品分析见 [MARKET_ANALYSIS.md](docs/MARKET_ANALYSIS.md)。

## 你能得到什么

- 统一 trace schema，记录 prompt、response、tool call、retrieval、error、usage 和 metadata。
- `agentlens quickstart` 一条命令生成本地 artifact pack：trace、eval、scan、dashboard、PR comment、OTLP、run bundle 和 share bundle。
- 可发布的 npm package 名称为 `agentlens-devtools`，CLI 命令仍然是 `agentlens`。
- 通用 LLM wrapper，可包住任意 SDK 调用。
- OpenAI-compatible 和 Anthropic-compatible provider adapter。
- LLM SDK cookbook，帮助把现有 provider client 接入本地 trace、CI 和 redaction workflow。
- 零依赖 sync/async Python trace writer 示例，方便 Python Agent、RAG 和 notebook 项目写出 AgentLens trace。
- PyPI-ready `agentlens-trace` package skeleton，import 名称为 `agentlens_trace`。
- `agentlens_trace.adapters` 零依赖 Python adapter helpers。
- `npm run python:publish:check`，用临时安装目录验证 Python package 发布前可用性。
- Python publishing guide，覆盖 TestPyPI、PyPI Trusted Publishing、版本和回滚。
- `.github/workflows/python-publish.yml` Trusted Publishing workflow，用于 TestPyPI / PyPI 发布交接。
- `npm run pack:smoke`，在临时干净项目中验证 npm tarball 安装后的 CLI 和 API 可用性。
- `npm run npm:publish:check`，验证 npm package metadata、打包文件和 publish dry-run 输出。
- `npm run npm:postpublish:check`，发布后从干净临时项目验证 registry 安装和一条命令 quickstart。
- `agentlens init --python`，为 Python 项目生成 starter trace writer、示例 run 和 GitHub Action 模板。
- Python framework cookbook，覆盖 `AgentLensLangChainBridge`、`AgentLensLlamaIndexBridge` 和 `AgentLensCrewAIBridge` trace 边界。
- LangChain-like object payload fixture，用于验证 Python adapter 对真实回调载荷形态的兼容性。
- OpenTelemetry/OpenInference-style OTLP JSON 单 trace 和批量 runs 目录导出，`agentlens otel-batch` 可生成批量 manifest，便于接入已有 observability stack。
- LangGraph-style node adapter。
- AutoGen-style 和 CrewAI-style 多 Agent 示例。
- Deterministic replay，不重新调用模型也能复盘时间线。
- before/after trace diff 和静态 diff dashboard。
- `agentlens review`，把 baseline/candidate trace 生成 PR-ready review pack。
- JSON eval rules，用于 required events、forbidden tools、cost、latency、citation、MCP policy。
- 本地 security scan，检查 secret-shaped value、prompt injection phrase、高风险工具调用。
- SARIF 输出，可接入 GitHub code scanning。
- 静态 dashboard，支持 timeline filter、timeline jump、tool call group、workflow review、security scan panel。
- 静态 run bundle，包含 `index.html`、每条 trace 的 dashboard 和 `manifest.json`。
- GitHub Action，可输出 status、count、PR comment、run bundle、bundle manifest。
- GitHub Action 可为 baseline/candidate trace 输出 review pack。
- Redacted share bundle，便于公开 issue、PR 或支持线程。
- MCP stdio JSON-RPC demo、MCP tool inventory、MCP risk scanner 和 policy exception workflow。

## 安装

npm package 发布后，安装包名使用 `agentlens-devtools`，CLI 命令使用 `agentlens`：

```bash
npm exec --package agentlens-devtools -- agentlens quickstart --python
npm install -D agentlens-devtools
npx agentlens doctor
```

不要使用 `npm install agentlens`：这个 npm 名称已经被无关 package 占用。npm package 正式发布前，请使用下面的 clone 本地演示路径。

## 快速演示

```bash
npm install
node ./bin/agentlens.js quickstart --python
node ./bin/agentlens.js init --python
npm run demo
node ./bin/agentlens.js inspect .agentlens/runs/demo.json
node ./bin/agentlens.js replay .agentlens/runs/demo.json
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
node ./bin/agentlens.js eval .agentlens/runs/demo.json --config evals/default.json
node ./bin/agentlens.js scan .agentlens/runs/demo.json
node ./bin/agentlens.js dashboard .agentlens/runs/demo.json --out .agentlens/reports/demo.html
node ./bin/agentlens.js bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,scan,tool-calls,workflow,filters,timeline
```

`agentlens quickstart` 会把完整演示输出到 `.agentlens/quickstart/`，不会混入你自己的 `.agentlens/runs`。详见 [QUICKSTART_ARTIFACTS.md](docs/QUICKSTART_ARTIFACTS.md)。

想完整验证仓库当前能力：

```bash
npm run verify
```

想看 PR 回归评审 artifact：

```bash
npm run demo:regression-pr
npm run demo
npm run diff:demo
node ./bin/agentlens.js review .agentlens/runs/demo.json .agentlens/runs/failing-demo.json --config evals/default.json --out .agentlens/review
```

`agentlens review` 会生成真实 PR 可用的 review pack，包括 CI summary、PR comment、SARIF、diff dashboard 和 run bundle。详见 [AGENT_REVIEW.md](docs/AGENT_REVIEW.md)。

输出位置：

```text
.agentlens/regression-pr/reports/ci-summary.md
.agentlens/regression-pr/reports/agentlens-ci.sarif
.agentlens/regression-pr/reports/diff.html
.agentlens/regression-pr/reports/bundle/index.html
```

## GitHub Actions

```yaml
- name: Run AgentLens evals
  uses: cnqiujunhu-dev/agentlens@v0.3.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    scan-fail-on: high
    pr-comment: .agentlens/reports/agentlens-pr-comment.md
    bundle: .agentlens/reports/bundle
    bundle-sections: summary,scan,tool-calls,workflow,filters,timeline
```

这一步可以：

- 在 eval 或 scan gate 失败时让 PR 失败。
- 写入 GitHub step summary。
- 生成可 upsert 的 PR comment Markdown。
- 生成静态 run bundle，供 reviewer 下载后打开 `index.html`。
- 输出 `bundle-manifest`，给后续 workflow step 或 bot 使用。

## 适合谁

- 正在做 tool-using agents、RAG workflows、MCP servers 的开发者。
- 想把 agent regression 放进 GitHub CI 的团队。
- 需要在 issue/PR/support thread 里共享失败 trace，但不想上传原始敏感数据的团队。
- 想先用轻量本地 artifact，再决定是否接入 Langfuse、Phoenix、OpenLIT 或其他 observability 平台的团队。

## 不适合什么

AgentLens 当前不是：

- 托管生产观测平台。
- Prompt registry 或 prompt playground。
- 大规模 metrics / alerting / retention 系统。
- Agent 编排框架。
- Langfuse、LangSmith、Phoenix、Helicone、OpenLIT、OpenLLMetry 或 Braintrust 的替代品。

更准确地说，它是这些平台之前或旁边的一层：本地 trace、CI gate、静态证据包和 agent 工程治理。

## 常用命令

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
agentlens redact <trace-file> [--out path] [--keys key1,key2]
agentlens share <trace-file> [--config path] [--out dir] [--keys key1,key2] [--sections summary,event-types,scan,tool-calls,workflow,filters,timeline]
agentlens dashboard <trace-file> [--out path] [--sections summary,event-types,scan,tool-calls,workflow,filters,timeline]
agentlens bundle [runs-dir] [--out dir] [--sections summary,event-types,scan,tool-calls,workflow,filters,timeline]
agentlens serve [trace-file|runs-dir] [--host host] [--port port]
```

## 文档

- [API](docs/API.md)
- [市场分析](docs/MARKET_ANALYSIS.md)
- [Quickstart artifacts](docs/QUICKSTART_ARTIFACTS.md)
- [Agent review packs](docs/AGENT_REVIEW.md)
- [LLM SDK cookbook](docs/LLM_SDK_COOKBOOK.md)
- [Python trace writer](docs/PYTHON_TRACE_WRITER.md)
- [Python publishing](docs/PYTHON_PUBLISHING.md)
- [npm publishing](docs/NPM_PUBLISHING.md)
- [Python framework cookbook](docs/PYTHON_FRAMEWORK_COOKBOOK.md)
- [OpenTelemetry export](docs/OTEL_EXPORT.md)
- [路线图](docs/ROADMAP.md)
- [GitHub Action](docs/GITHUB_ACTION.md)
- [Dashboard review workflow](docs/DASHBOARD_REVIEW.md)
- [Run bundles](docs/RUN_BUNDLES.md)
- [Security scan](docs/SECURITY_SCAN.md)
- [MCP risk exceptions](docs/MCP_RISK_EXCEPTIONS.md)
- [LangGraph-style adapter](docs/LANGGRAPH_ADAPTER.md)
- [Multi-agent adapters](docs/MULTI_AGENT_ADAPTERS.md)

## 项目理念

AgentLens 不是另一个 Agent 框架。

它是 Agent 框架周围缺失的工程层：记录、复盘、评测、扫描、治理和评审。

## 当前状态

早期 MVP。当前版本已经适合本地 trace、deterministic replay、JSON eval、security scan、redacted share bundle、CI gate、静态 dashboard、run bundle、MCP policy、多 Agent demo、`agentlens quickstart`、`agentlens review`、sync/async Python trace writer、`agentlens-trace` package skeleton、`agentlens_trace.adapters`、`agentlens init --python` 和 OpenTelemetry/OpenInference-style OTLP JSON 导出。下一阶段重点是更深的框架接入、collector/protobuf 级互通、Python package 发布和更完整的 cookbook。
