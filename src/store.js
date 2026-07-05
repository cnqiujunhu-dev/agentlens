import fs from "node:fs";
import path from "node:path";
import { validateTrace } from "./trace.js";

const DEFAULT_INIT_EVAL = {
  version: "agentlens.eval.v1",
  name: "agentlens-default",
  assertions: [
    { id: "has-core-events", type: "required-event-types", eventTypes: ["llm.prompt", "llm.response"] },
    { id: "no-errors", type: "max-errors", max: 0 },
    { id: "no-dangerous-tools", type: "forbidden-tools", tools: ["rm", "delete_database", "git.reset.hard"] },
    { id: "tool-latency-budget", type: "max-tool-duration-ms", max: 3000 },
    { id: "has-final-answer", type: "required-final-response" }
  ]
};

const INIT_README = `# AgentLens Workspace

This directory stores local AgentLens traces, reports, and starter eval config.

Useful commands:

\`\`\`bash
agentlens demo --out .agentlens/runs/demo.json
agentlens inspect .agentlens/runs/demo.json
agentlens replay .agentlens/runs/demo.json
agentlens eval .agentlens/runs/demo.json --config .agentlens/evals/default.json
agentlens ci --runs .agentlens/runs --config .agentlens/evals/default.json
agentlens serve .agentlens/runs
\`\`\`
`;

const GITHUB_ACTION_EXAMPLE = `name: agentlens

on:
  pull_request:
  push:

jobs:
  agentlens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Generate traces
        run: npm test

      - name: Run AgentLens evals
        uses: cnqiujunhu-dev/agentlens@v0.2.0
        with:
          runs: .agentlens/runs
          config: .agentlens/evals/default.json
          bundle: .agentlens/reports/bundle
          bundle-sections: summary,scan,tool-calls,filters,timeline
`;

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureParent(filePath) {
  ensureDir(path.dirname(filePath));
}

function writeIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  ensureParent(filePath);
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

export function initWorkspace(root = process.cwd(), { scaffold = false } = {}) {
  const workspaceRoot = path.join(root, ".agentlens");
  const runsDir = path.join(workspaceRoot, "runs");
  const reportsDir = path.join(workspaceRoot, "reports");
  const evalsDir = path.join(workspaceRoot, "evals");
  const examplesDir = path.join(workspaceRoot, "examples");

  ensureDir(runsDir);
  ensureDir(reportsDir);
  if (scaffold) {
    ensureDir(evalsDir);
    ensureDir(examplesDir);
  }

  const createdFiles = [];

  if (scaffold) {
    const files = [
      [path.join(workspaceRoot, "README.md"), INIT_README],
      [path.join(evalsDir, "default.json"), `${JSON.stringify(DEFAULT_INIT_EVAL, null, 2)}\n`],
      [path.join(examplesDir, "github-action.yml"), GITHUB_ACTION_EXAMPLE]
    ];
    for (const [filePath, content] of files) {
      if (writeIfMissing(filePath, content)) createdFiles.push(filePath);
    }
  }

  return {
    root: workspaceRoot,
    runsDir,
    reportsDir,
    evalsDir,
    examplesDir,
    createdFiles
  };
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, value, "utf8");
}

export function appendText(filePath, value) {
  ensureParent(filePath);
  fs.appendFileSync(filePath, value, "utf8");
}

export function readTrace(filePath) {
  const trace = readJson(filePath);
  const result = validateTrace(trace);
  if (!result.valid) {
    throw new Error(`Invalid trace file ${filePath}: ${result.errors.join("; ")}`);
  }
  return trace;
}

export function writeTrace(filePath, trace) {
  const result = validateTrace(trace);
  if (!result.valid) {
    throw new Error(`Refusing to write invalid trace: ${result.errors.join("; ")}`);
  }
  writeJson(filePath, trace);
}
