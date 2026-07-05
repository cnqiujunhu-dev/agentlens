import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const requiredFiles = [
  "README.md",
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
  "docs/GITHUB_ACTION.md",
  "docs/LANGGRAPH_ADAPTER.md",
  "docs/MULTI_AGENT_ADAPTERS.md",
  "docs/LAUNCH_COPY.md",
  "docs/LAUNCH_PLAN.md",
  "docs/ROADMAP.md",
  "docs/RELEASE_CHECKLIST.md",
  "docs/DEMO_RECORDING.md",
  "docs/LAUNCH_POST.md",
  "docs/MCP_ADAPTER.md",
  "docs/MCP_RISK_EXCEPTIONS.md",
  "docs/JSONL_TRACES.md",
  "docs/REDACTION.md",
  "docs/RUN_BUNDLES.md",
  "docs/SECURITY_SCAN.md",
  "docs/SCHEMAS.md",
  "docs/assets/agentlens-demo.gif",
  "docs/assets/dashboard-screenshot.png",
  "docs/assets/regression-pr-diff.png",
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
  "GitHub Actions",
  "MCP tool inventory",
  "MCP stdio trace sessions",
  "Reviewed MCP risk exceptions",
  "MCP risk exceptions",
  "expiry metadata",
  "file-change refresh",
  "Timeline filters",
  "Security Scan panel",
  "Configurable dashboard sections",
  "--sections",
  "starter files",
  "agentlens diff",
  "diff-dashboard",
  "demo:regression-pr",
  "agent regression PR",
  "JSON output",
  "Markdown CI summaries",
  "PR comment Markdown",
  "--pr-comment-md",
  "pr-comment",
  "Upsert PR comment",
  "agentlens-ci-comment",
  "GitHub Action outputs",
  "agentlens doctor",
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

const requiredPackageExports = [
  ".",
  "./trace",
  "./diff",
  "./diff-dashboard",
  "./doctor",
  "./eval",
  "./scan",
  "./ci",
  "./jsonl",
  "./share",
  "./validate",
  "./dashboard",
  "./bundle",
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

function assertPackage() {
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  if (packageJson.version !== releaseVersion) fail(`package.json version must be ${releaseVersion}`);
  if (packageJson.license !== "Apache-2.0") fail("package.json license must be Apache-2.0");
  if (!packageJson.bin?.agentlens) fail("package.json must expose agentlens bin");
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
    "LICENSE",
    "CODE_OF_CONDUCT.md",
    "SUPPORT.md",
    "bin/agentlens.js",
    "src/index.js",
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

for (const file of requiredFiles) assertFile(file);
assertReadme();
assertPackage();
assertVersionDocs();
assertPublicActionReferences();
assertDemoGif();
assertScreenshotAssets();
assertActionVersions();
assertPackDryRun();

console.log("AgentLens release audit passed");
