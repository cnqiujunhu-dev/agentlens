import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const requiredFiles = [
  "README.md",
  "README.zh-CN.md",
  "CHANGELOG.md",
  "LICENSE",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "SUPPORT.md",
  "action.yml",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/workflows/ci.yml",
  "docs/API.md",
  "docs/AGENT_REGRESSION_PR.md",
  "docs/AGENT_REVIEW.md",
  "docs/DASHBOARD_REVIEW.md",
  "docs/GITHUB_ACTION.md",
  "docs/QUICKSTART_ARTIFACTS.md",
  "docs/LANGGRAPH_ADAPTER.md",
  "docs/LLM_SDK_COOKBOOK.md",
  "docs/PYTHON_TRACE_WRITER.md",
  "docs/PYTHON_PUBLISHING.md",
  "docs/PYTHON_FRAMEWORK_COOKBOOK.md",
  "docs/OTEL_EXPORT.md",
  "docs/MULTI_AGENT_ADAPTERS.md",
  "docs/LAUNCH_COPY.md",
  "docs/LAUNCH_PLAN.md",
  "docs/ROADMAP.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/DEMO_RECORDING.md",
  "docs/LAUNCH_POST.md",
  "docs/MCP_ADAPTER.md",
  "docs/MCP_RISK_EXCEPTIONS.md",
  "docs/MARKET_ANALYSIS.md",
  "docs/JSONL_TRACES.md",
  "docs/REDACTION.md",
  "docs/RUN_BUNDLES.md",
  "docs/SECURITY_SCAN.md",
  "docs/SCHEMAS.md",
  "docs/assets/agentlens-demo.gif",
  "docs/assets/dashboard-screenshot.png",
  "docs/assets/regression-pr-diff.png",
  "examples/python-basic-run.py",
  "examples/python-async-run.py",
  "examples/python-framework-cookbook-run.py",
  "examples/python-langchain-fixture-run.py",
  "examples/python_trace_writer/__init__.py",
  "examples/python_trace_writer/agentlens_trace.py",
  "python/agentlens-trace/pyproject.toml",
  "python/agentlens-trace/README.md",
  "python/agentlens-trace/src/agentlens_trace/__init__.py",
  "python/agentlens-trace/src/agentlens_trace/__main__.py",
  "python/agentlens-trace/src/agentlens_trace/adapters/__init__.py",
  "python/agentlens-trace/src/agentlens_trace/adapters/__main__.py",
  "scripts/check-python-package.mjs",
  "scripts/check-python-publish.mjs",
  "scripts/run-python-framework-demo.mjs",
  "scripts/run-python-demo.mjs",
  "scripts/generate-regression-screenshot.mjs",
  "scripts/release-preflight.mjs",
  "schemas/agentlens.trace.v1.schema.json",
  "schemas/agentlens.eval.v1.schema.json"
];

const requiredReadmeSnippets = [
  "Quick Demo",
  "JavaScript API",
  "provider-style SDK adapters",
  "LangGraph-style",
  "AutoGen-style",
  "CrewAI-style",
  "multi-agent",
  "Eval Rules",
  "Use Cases",
  "Roadmap",
  "ROADMAP.md",
  "Languages:",
  "README.zh-CN.md",
  "Market Positioning",
  "MARKET_ANALYSIS.md",
  "agentlens quickstart",
  "QUICKSTART_ARTIFACTS.md",
  ".agentlens/quickstart",
  "agentlens review",
  "AGENT_REVIEW.md",
  "LLM SDK cookbook",
  "LLM_SDK_COOKBOOK.md",
  "Python trace writer",
  "PYTHON_TRACE_WRITER.md",
  "PYTHON_PUBLISHING.md",
  "Python publishing",
  "TestPyPI",
  "Trusted Publishing",
  "agentlens-trace",
  "agentlens_trace",
  "agentlens_trace.adapters",
  "python -m agentlens_trace.adapters",
  "AgentLensLangChainBridge",
  "AgentLensLlamaIndexBridge",
  "AgentLensCrewAIBridge",
  "python:package",
  "python:publish:check",
  "agentlens init --python",
  ".agentlens/python/basic_run.py",
  "python-github-action.yml",
  "Python framework cookbook",
  "PYTHON_FRAMEWORK_COOKBOOK.md",
  "python-basic-run.py",
  "python-async-run.py",
  "python-framework-cookbook-run.py",
  "python-langchain-fixture-run.py",
  "LangChain-like object payload fixture",
  "trace_async_llm_call",
  "demo:python",
  "demo:python:frameworks",
  "LangChain-style",
  "LlamaIndex-style",
  "OpenTelemetry export",
  "OTEL_EXPORT.md",
  "OpenInference",
  "OTLP JSON",
  "agentlens otel",
  "GitHub Actions",
  "MCP tool inventory",
  "MCP stdio trace sessions",
  "Reviewed MCP risk exceptions",
  "MCP risk exceptions",
  "expiry metadata",
  "file-change refresh",
  "Timeline filters",
  "shareable filtered view link",
  "Timeline jumps",
  "Tool call groups",
  "one-click timeline filters",
  "Dashboard review workflow",
  "DASHBOARD_REVIEW.md",
  "manifest.json",
  "run bundle manifests",
  "Security Scan panel",
  "Configurable dashboard sections",
  "--sections",
  "starter files",
  "agentlens diff",
  "diff-dashboard",
  "Agent review packs",
  "demo:regression-pr",
  "agent regression PR",
  "JSON output",
  "Markdown CI summaries",
  "PR comment Markdown",
  "--pr-comment-md",
  "pr-comment",
  "bundle-sections",
  "bundle-manifest",
  "Upsert PR comment",
  "agentlens-ci-comment",
  "GitHub Action outputs",
  "GitHub Action review pack outputs",
  "agentlens doctor",
  "Quickstart artifacts",
  "agentlens share",
  "agentlens bundle",
  "agentlens scan",
  "--scan",
  "scan-fail-on",
  "SARIF",
  "combined SARIF",
  "Security Scan",
  "agentlens validate",
  "share bundle",
  "run bundle",
  "scan.txt",
  "Workspace doctor",
  "Code of Conduct",
  "Support",
  "Release checklist",
  "Demo recording guide",
  "Launch post draft",
  "agentlens serve",
  "agentlens-demo.gif",
  "release:preflight",
  "dashboard-screenshot.png",
  "regression-pr-diff.png"
];

const requiredChineseReadmeSnippets = [
  "语言:",
  "English",
  "简体中文",
  "为什么需要 AgentLens",
  "市场定位",
  "快速演示",
  "GitHub Actions",
  "MARKET_ANALYSIS.md",
  "LLM SDK cookbook",
  "Python trace writer",
  "PYTHON_TRACE_WRITER.md",
  "PYTHON_PUBLISHING.md",
  "Python publishing",
  "agentlens init --python",
  "agentlens-trace",
  "agentlens_trace",
  "agentlens_trace.adapters",
  "python -m agentlens_trace.adapters",
  "AgentLensLangChainBridge",
  "AgentLensLlamaIndexBridge",
  "AgentLensCrewAIBridge",
  "LangChain-like object payload fixture",
  "python:package",
  "python:publish:check",
  "agentlens quickstart",
  "agentlens review",
  "QUICKSTART_ARTIFACTS.md",
  "AGENT_REVIEW.md",
  "Python framework cookbook",
  "PYTHON_FRAMEWORK_COOKBOOK.md",
  "OTEL_EXPORT.md",
  "OpenTelemetry",
  "不是另一个 Agent 框架"
];

const requiredPackageExports = [
  ".",
  "./trace",
  "./diff",
  "./diff-dashboard",
  "./review",
  "./doctor",
  "./eval",
  "./scan",
  "./ci",
  "./jsonl",
  "./otel",
  "./share",
  "./validate",
  "./dashboard",
  "./bundle",
  "./quickstart",
  "./server",
  "./adapters/langgraph",
  "./adapters/llm",
  "./adapters/multi-agent",
  "./adapters/mcp",
  "./adapters/mcp-stdio"
];

const releaseVersion = "0.2.0";
const publicActionRef = `cnqiujunhu-dev/agentlens@v${releaseVersion}`;
const placeholderActionRef = "your-org/agentlens@v0";

function fail(message) {
  throw new Error(message);
}

function assertFile(file) {
  if (!fs.existsSync(file)) fail(`Missing required file: ${file}`);
}

function assertReadme() {
  const readme = fs.readFileSync("README.md", "utf8");
  for (const snippet of requiredReadmeSnippets) {
    if (!readme.includes(snippet)) fail(`README missing required snippet: ${snippet}`);
  }
}

function assertChineseReadme() {
  const readme = fs.readFileSync("README.zh-CN.md", "utf8");
  for (const snippet of requiredChineseReadmeSnippets) {
    if (!readme.includes(snippet)) fail(`README.zh-CN.md missing required snippet: ${snippet}`);
  }
}

function assertPackage() {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (packageJson.version !== releaseVersion) fail(`package.json version must be ${releaseVersion}`);
  if (packageJson.license !== "Apache-2.0") fail("package.json license must be Apache-2.0");
  if (!packageJson.bin?.agentlens) fail("package.json must expose agentlens bin");
  if (!packageJson.files?.includes("python")) fail("package.json files must include python package sources");
  if (!packageJson.scripts?.["python:package"]) fail("package.json must expose python:package");
  if (!packageJson.scripts?.["python:publish:check"]) fail("package.json must expose python:publish:check");
  for (const key of requiredPackageExports) {
    if (!packageJson.exports?.[key]) fail(`package.json missing export: ${key}`);
  }
}

function assertVersionDocs() {
  const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
  if (!changelog.includes(`## ${releaseVersion}`)) fail(`CHANGELOG.md missing ${releaseVersion}`);
  if (!changelog.includes(publicActionRef)) fail(`CHANGELOG.md missing ${publicActionRef}`);
}

function assertPublicActionReferences() {
  for (const file of ["README.md", "docs/GITHUB_ACTION.md", "docs/AGENT_REGRESSION_PR.md", "src/store.js"]) {
    const text = fs.readFileSync(file, "utf8");
    if (text.includes(placeholderActionRef)) fail(`${file} must not include placeholder action ref ${placeholderActionRef}`);
    if (!text.includes(publicActionRef)) fail(`${file} must include public action ref ${publicActionRef}`);
  }
}

function assertPackDryRun() {
  const npmExecPath = process.env.npm_execpath;
  const command = npmExecPath ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const args = npmExecPath ? [npmExecPath, "pack", "--dry-run"] : ["pack", "--dry-run"];

  const result = spawnSync(command, args, {
    encoding: "utf8",
    env: {
      ...process.env,
      npm_config_audit: "false",
      npm_config_cache: path.resolve(".agentlens/npm-cache"),
      npm_config_fund: "false",
      npm_config_update_notifier: "false"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (result.status !== 0) fail(`npm pack --dry-run failed:\n${output}`);

  for (const file of [
    "README.md",
    "README.zh-CN.md",
    "LICENSE",
    "CODE_OF_CONDUCT.md",
    "SUPPORT.md",
    "bin/agentlens.js",
    "src/index.js",
    "src/review.js",
    "docs/AGENT_REVIEW.md",
    "src/quickstart.js",
    "docs/QUICKSTART_ARTIFACTS.md",
    "docs/PYTHON_TRACE_WRITER.md",
    "docs/PYTHON_PUBLISHING.md",
    "docs/PYTHON_FRAMEWORK_COOKBOOK.md",
    "examples/python-basic-run.py",
    "examples/python-async-run.py",
    "examples/python-framework-cookbook-run.py",
    "examples/python-langchain-fixture-run.py",
    "examples/python_trace_writer/__init__.py",
    "examples/python_trace_writer/agentlens_trace.py",
    "python/agentlens-trace/pyproject.toml",
    "python/agentlens-trace/README.md",
    "python/agentlens-trace/src/agentlens_trace/__init__.py",
    "python/agentlens-trace/src/agentlens_trace/__main__.py",
    "python/agentlens-trace/src/agentlens_trace/adapters/__init__.py",
    "python/agentlens-trace/src/agentlens_trace/adapters/__main__.py",
    "scripts/check-python-package.mjs",
    "scripts/check-python-publish.mjs",
    "scripts/run-python-framework-demo.mjs",
    "scripts/run-python-demo.mjs",
    "docs/assets/agentlens-demo.gif",
    "docs/assets/dashboard-screenshot.png",
    "docs/assets/regression-pr-diff.png"
  ]) {
    if (!output.includes(file)) fail(`npm pack dry-run missing ${file}`);
  }
}

function assertDemoGif() {
  const stats = fs.statSync("docs/assets/agentlens-demo.gif");
  const maxBytes = 10 * 1024 * 1024;
  if (stats.size > maxBytes) fail("docs/assets/agentlens-demo.gif must stay under 10 MB");
}

function assertScreenshotAssets() {
  const stats = fs.statSync("docs/assets/regression-pr-diff.png");
  const maxBytes = 1024 * 1024;
  if (stats.size > maxBytes) fail("docs/assets/regression-pr-diff.png must stay under 1 MB");
}

function assertActionVersions() {
  const deprecatedCheckoutAction = ["actions/checkout", "v4"].join("@");
  const deprecatedSetupNodeAction = ["actions/setup-node", "v4"].join("@");
  const checkoutAction = ["actions/checkout", "v7"].join("@");
  const setupNodeAction = ["actions/setup-node", "v6"].join("@");
  const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
  const action = fs.readFileSync("action.yml", "utf8");
  const store = fs.readFileSync("src/store.js", "utf8");
  const docs = fs.readFileSync("docs/GITHUB_ACTION.md", "utf8");
  for (const [name, text] of [
    [".github/workflows/ci.yml", workflow],
    ["action.yml", action],
    ["src/store.js", store],
    ["docs/GITHUB_ACTION.md", docs]
  ]) {
    if (text.includes(deprecatedCheckoutAction)) fail(`${name} must not reference ${deprecatedCheckoutAction}`);
    if (text.includes(deprecatedSetupNodeAction)) fail(`${name} must not reference ${deprecatedSetupNodeAction}`);
  }
  if (!workflow.includes(checkoutAction)) fail(`.github/workflows/ci.yml must use ${checkoutAction}`);
  if (!docs.includes(checkoutAction)) fail(`docs/GITHUB_ACTION.md must document ${checkoutAction}`);
  if (!store.includes(checkoutAction)) fail(`src/store.js init example must use ${checkoutAction}`);
  if (!workflow.includes(setupNodeAction)) fail(`.github/workflows/ci.yml must use ${setupNodeAction}`);
  if (!action.includes(setupNodeAction)) fail(`action.yml must use ${setupNodeAction}`);
}

function assertActionReviewPackSupport() {
  const action = fs.readFileSync("action.yml", "utf8");
  const docs = fs.readFileSync("docs/GITHUB_ACTION.md", "utf8");
  const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
  for (const snippet of [
    "review-baseline",
    "review-candidate",
    "review-fail-on-failure",
    "review-pr-comment",
    "review-bundle-manifest"
  ]) {
    if (!action.includes(snippet)) fail(`action.yml missing review pack snippet: ${snippet}`);
    if (!docs.includes(snippet)) fail(`docs/GITHUB_ACTION.md missing review pack snippet: ${snippet}`);
  }
  for (const snippet of ["action-review", "review-baseline", "review-candidate", "review-pr-comment"]) {
    if (!workflow.includes(snippet)) fail(`.github/workflows/ci.yml missing review pack snippet: ${snippet}`);
  }
}

for (const file of requiredFiles) assertFile(file);
assertReadme();
assertChineseReadme();
assertPackage();
assertVersionDocs();
assertPublicActionReferences();
assertDemoGif();
assertScreenshotAssets();
assertActionVersions();
assertActionReviewPackSupport();
assertPackDryRun();

console.log("AgentLens release audit passed");
