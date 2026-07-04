import fs from "node:fs";
import path from "node:path";
import { readJson, readTrace } from "./store.js";

const MIN_NODE_MAJOR = 20;

function addCheck(checks, status, id, message, fix = undefined) {
  checks.push(fix ? { id, status, message, fix } : { id, status, message });
}

function countByStatus(checks, status) {
  return checks.filter((check) => check.status === status).length;
}

function summarizeChecks(checks) {
  const summary = {
    pass: countByStatus(checks, "pass"),
    warn: countByStatus(checks, "warn"),
    fail: countByStatus(checks, "fail")
  };
  return {
    ...summary,
    status: summary.fail > 0 ? "fail" : summary.warn > 0 ? "warn" : "pass"
  };
}

function nodeMajor(version) {
  return Number.parseInt(String(version).split(".")[0] ?? "", 10);
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function hasAgentLensGitignore(root) {
  const gitignorePath = path.join(root, ".gitignore");
  if (!fs.existsSync(gitignorePath)) return false;
  const entries = fs
    .readFileSync(gitignorePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  return entries.some((line) => line === ".agentlens" || line === ".agentlens/" || line === "/.agentlens" || line === "/.agentlens/");
}

function checkEvalConfig(checks, evalConfigPath) {
  if (!fs.existsSync(evalConfigPath)) {
    addCheck(checks, "warn", "eval-config", "Missing .agentlens/evals/default.json.", "Run: agentlens init");
    return;
  }

  try {
    const config = readJson(evalConfigPath);
    if (config.version !== "agentlens.eval.v1") {
      addCheck(checks, "fail", "eval-config", ".agentlens/evals/default.json has an unsupported version.", "Use version: agentlens.eval.v1");
      return;
    }
    if (!Array.isArray(config.assertions)) {
      addCheck(checks, "fail", "eval-config", ".agentlens/evals/default.json must include an assertions array.", "Run: agentlens init or repair the eval config");
      return;
    }
    addCheck(checks, "pass", "eval-config", `.agentlens/evals/default.json has ${config.assertions.length} assertion(s).`);
  } catch (error) {
    addCheck(checks, "fail", "eval-config", `.agentlens/evals/default.json is not valid JSON: ${error.message}`, "Run: agentlens init or repair the eval config");
  }
}

function checkTraceFiles(checks, runsDir, root) {
  if (!fs.existsSync(runsDir)) {
    addCheck(checks, "warn", "trace-files", "Missing .agentlens/runs directory.", "Run: agentlens init");
    return;
  }

  const traceFiles = walkFiles(runsDir).filter((file) => file.endsWith(".json"));
  if (traceFiles.length === 0) {
    addCheck(checks, "warn", "trace-files", "No trace JSON files found in .agentlens/runs.", "Run: agentlens demo --out .agentlens/runs/demo.json");
    return;
  }

  const invalid = [];
  for (const file of traceFiles) {
    try {
      readTrace(file);
    } catch (error) {
      invalid.push(`${path.relative(root, file)}: ${error.message}`);
    }
  }

  if (invalid.length > 0) {
    addCheck(checks, "fail", "trace-files", `${invalid.length} trace file(s) in .agentlens/runs are invalid.`, invalid.slice(0, 3).join("; "));
    return;
  }

  addCheck(checks, "pass", "trace-files", `${traceFiles.length} valid trace file(s) found in .agentlens/runs.`);
}

function checkGithubWorkflow(checks, root) {
  const workflowsDir = path.join(root, ".github", "workflows");
  if (!fs.existsSync(workflowsDir)) {
    addCheck(checks, "warn", "github-workflow", "Missing .github/workflows directory.", "Copy .agentlens/examples/github-action.yml into .github/workflows/agentlens.yml");
    return;
  }

  const workflowFiles = walkFiles(workflowsDir).filter((file) => /\.ya?ml$/i.test(file));
  const agentlensWorkflows = workflowFiles.filter((file) => fs.readFileSync(file, "utf8").toLowerCase().includes("agentlens"));

  if (agentlensWorkflows.length === 0) {
    addCheck(checks, "warn", "github-workflow", "No GitHub workflow appears to run AgentLens.", "Copy .agentlens/examples/github-action.yml into .github/workflows/agentlens.yml");
    return;
  }

  addCheck(checks, "pass", "github-workflow", `${agentlensWorkflows.length} GitHub workflow file(s) mention AgentLens.`);
}

export function doctorWorkspace(root = process.cwd(), { nodeVersion = process.versions.node } = {}) {
  const workspaceRoot = path.join(root, ".agentlens");
  const checks = [];

  const major = nodeMajor(nodeVersion);
  if (Number.isFinite(major) && major >= MIN_NODE_MAJOR) {
    addCheck(checks, "pass", "node-version", `Node ${nodeVersion} satisfies >=${MIN_NODE_MAJOR}.`);
  } else {
    addCheck(checks, "fail", "node-version", `Node ${nodeVersion} does not satisfy >=${MIN_NODE_MAJOR}.`, "Upgrade Node.js to 20 or newer");
  }

  if (!fs.existsSync(workspaceRoot)) {
    addCheck(checks, "warn", "workspace", "Missing .agentlens workspace.", "Run: agentlens init");
  } else {
    addCheck(checks, "pass", "workspace", "Found .agentlens workspace.");

    const reportsDir = path.join(workspaceRoot, "reports");
    addCheck(
      checks,
      fs.existsSync(reportsDir) ? "pass" : "warn",
      "reports-dir",
      fs.existsSync(reportsDir) ? "Found .agentlens/reports." : "Missing .agentlens/reports directory.",
      fs.existsSync(reportsDir) ? undefined : "Run: agentlens init"
    );

    checkEvalConfig(checks, path.join(workspaceRoot, "evals", "default.json"));
    checkTraceFiles(checks, path.join(workspaceRoot, "runs"), root);

    const actionExample = path.join(workspaceRoot, "examples", "github-action.yml");
    addCheck(
      checks,
      fs.existsSync(actionExample) ? "pass" : "warn",
      "action-example",
      fs.existsSync(actionExample) ? "Found .agentlens/examples/github-action.yml." : "Missing .agentlens/examples/github-action.yml.",
      fs.existsSync(actionExample) ? undefined : "Run: agentlens init"
    );
  }

  if (fs.existsSync(path.join(root, ".git"))) {
    const agentLensIgnored = hasAgentLensGitignore(root);
    addCheck(
      checks,
      agentLensIgnored ? "pass" : "warn",
      "gitignore",
      agentLensIgnored ? ".agentlens is ignored by git." : ".agentlens is not ignored by git.",
      agentLensIgnored ? undefined : "Add .agentlens/ to .gitignore"
    );
  }

  checkGithubWorkflow(checks, root);

  const summary = summarizeChecks(checks);
  return {
    root,
    passed: summary.fail === 0,
    summary,
    checks
  };
}

export function formatDoctorReport(report) {
  const lines = [
    "AgentLens Doctor",
    `Root: ${report.root}`,
    `Status: ${report.summary.status.toUpperCase()}`,
    `Summary: ${report.summary.pass} passed, ${report.summary.warn} warnings, ${report.summary.fail} failed`,
    ""
  ];

  for (const check of report.checks) {
    lines.push(`[${check.status.toUpperCase()}] ${check.id}: ${check.message}`);
    if (check.fix) lines.push(`  fix: ${check.fix}`);
  }

  return lines.join("\n");
}
