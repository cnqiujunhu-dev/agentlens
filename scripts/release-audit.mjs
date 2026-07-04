import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const requiredFiles = [
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "action.yml",
  ".github/workflows/ci.yml",
  "docs/API.md",
  "docs/GITHUB_ACTION.md",
  "docs/LAUNCH_COPY.md",
  "docs/LAUNCH_PLAN.md",
  "docs/MCP_ADAPTER.md",
  "docs/JSONL_TRACES.md",
  "docs/REDACTION.md",
  "docs/SCHEMAS.md",
  "docs/assets/dashboard-screenshot.png",
  "schemas/agentlens.trace.v1.schema.json",
  "schemas/agentlens.eval.v1.schema.json"
];

const requiredReadmeSnippets = [
  "Quick Demo",
  "JavaScript API",
  "provider-style SDK adapters",
  "Eval Rules",
  "Use Cases",
  "Roadmap",
  "GitHub Actions",
  "MCP tool inventory",
  "Reviewed MCP risk exceptions",
  "file-change refresh",
  "Timeline filters",
  "starter files",
  "agentlens diff",
  "JSON output",
  "agentlens serve",
  "dashboard-screenshot.png"
];

const requiredPackageExports = [
  ".",
  "./trace",
  "./diff",
  "./eval",
  "./ci",
  "./jsonl",
  "./dashboard",
  "./server",
  "./adapters/llm",
  "./adapters/mcp",
  "./adapters/mcp-stdio"
];

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
  if (packageJson.license !== "Apache-2.0") fail("package.json license must be Apache-2.0");
  if (!packageJson.bin?.agentlens) fail("package.json must expose agentlens bin");
  for (const key of requiredPackageExports) {
    if (!packageJson.exports?.[key]) fail(`package.json missing export: ${key}`);
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

  for (const file of ["README.md", "LICENSE", "bin/agentlens.js", "src/index.js", "docs/assets/dashboard-screenshot.png"]) {
    if (!output.includes(file)) fail(`npm pack dry-run missing ${file}`);
  }
}

for (const file of requiredFiles) assertFile(file);
assertReadme();
assertPackage();
assertPackDryRun();

console.log("AgentLens release audit passed");
