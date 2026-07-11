import fs from "node:fs";
import path from "node:path";
import { validateTrace } from "./trace.js";

const DEFAULT_INIT_EVAL = {
  version: "agentlens.eval.v1",
  name: "agentlens-default",
  assertions: [
    { id: "has-core-events", type: "required-event-types", eventTypes: ["llm.prompt", "llm.response"] },
    { id: "no-errors", type: "max-errors", max: 0 },
    { id: "no-workflow-errors", type: "max-workflow-errors", max: 0 },
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
agentlens quickstart --python
agentlens init --python
agentlens inspect .agentlens/runs/demo.json
agentlens replay .agentlens/runs/demo.json
agentlens eval .agentlens/runs/demo.json --config .agentlens/evals/default.json
agentlens ci --runs .agentlens/runs --config .agentlens/evals/default.json
agentlens otel-batch .agentlens/runs --out .agentlens/reports/otel
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
        uses: cnqiujunhu-dev/agentlens@v0.3.0
        with:
          runs: .agentlens/runs
          config: .agentlens/evals/default.json
          bundle: .agentlens/reports/bundle
          bundle-sections: summary,scan,tool-calls,workflow,filters,timeline
`;

const PYTHON_INIT_README = `# AgentLens Python Starter

This folder contains a copyable zero-dependency Python trace writer and a starter run.

Useful commands from the repository root:

\`\`\`bash
python .agentlens/python/basic_run.py --out .agentlens/runs/python-starter.json
agentlens validate trace .agentlens/runs/python-starter.json
agentlens eval .agentlens/runs/python-starter.json --config .agentlens/evals/default.json
agentlens scan .agentlens/runs/python-starter.json
agentlens otel .agentlens/runs/python-starter.json --out .agentlens/reports/python-starter.otlp.json
agentlens dashboard .agentlens/runs/python-starter.json --out .agentlens/reports/python-starter.html
\`\`\`
`;

const PYTHON_STARTER_RUN = `#!/usr/bin/env python3

import argparse

from agentlens_trace import AgentLensRun, init_workspace, trace_llm_call


def answer(_input):
    return {
        "content": "AgentLens can record Python agent runs as local CI artifacts.",
        "citations": ["agentlens-python-starter"],
        "usage": {
            "inputTokens": 8,
            "outputTokens": 10,
            "totalTokens": 18,
            "costUsd": 0.0002,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Write a starter AgentLens trace from Python.")
    parser.add_argument("--out", default=".agentlens/runs/python-starter.json")
    args = parser.parse_args()

    init_workspace()

    run = AgentLensRun(
        app="python-agent",
        name="python starter run",
        metadata={"language": "python", "starter": "agentlens init --python"},
    )

    run.add_event(
        "retrieval.query",
        name="starter-search",
        input={"query": "agentlens python starter"},
    )
    run.add_event(
        "retrieval.result",
        name="starter-search",
        duration_ms=42,
        output={"documents": [{"id": "agentlens-python-starter", "score": 0.99}]},
    )
    run.add_tool_call(
        "kb.search",
        input={"query": "agentlens python starter"},
        metadata={"permission": "read-only", "risk": "low", "adapter": "python"},
    )
    run.add_tool_result(
        "kb.search",
        duration_ms=57,
        output={"documents": [{"id": "agentlens-python-starter"}]},
    )

    trace_llm_call(
        run,
        "final-answer",
        {"messages": [{"role": "user", "content": "Can AgentLens trace Python agents?"}]},
        answer,
        provider="python-starter",
        model="demo-model",
    )

    run.finish("passed")
    run.write(args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
`;

const PYTHON_GITHUB_ACTION_EXAMPLE = `name: python-agentlens

on:
  pull_request:
  push:

jobs:
  agentlens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-python@v6
        with:
          python-version: "3.12"

      - name: Generate Python traces
        run: python .agentlens/python/basic_run.py --out .agentlens/runs/python-starter.json

      - name: Run AgentLens evals
        uses: cnqiujunhu-dev/agentlens@v0.3.0
        with:
          runs: .agentlens/runs
          config: .agentlens/evals/default.json
          scan: true
          pr-comment: .agentlens/reports/agentlens-pr-comment.md
          bundle: .agentlens/reports/bundle
          bundle-sections: summary,scan,tool-calls,workflow,filters,timeline
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

function readPythonTraceWriterSource() {
  return fs.readFileSync(new URL("../python/agentlens-trace/src/agentlens_trace/__init__.py", import.meta.url), "utf8");
}

export function initWorkspace(root = process.cwd(), { scaffold = false, python = false } = {}) {
  const workspaceRoot = path.join(root, ".agentlens");
  const runsDir = path.join(workspaceRoot, "runs");
  const reportsDir = path.join(workspaceRoot, "reports");
  const evalsDir = path.join(workspaceRoot, "evals");
  const examplesDir = path.join(workspaceRoot, "examples");
  const pythonDir = path.join(workspaceRoot, "python");

  ensureDir(runsDir);
  ensureDir(reportsDir);
  if (scaffold) {
    ensureDir(evalsDir);
    ensureDir(examplesDir);
  }
  if (scaffold && python) {
    ensureDir(pythonDir);
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

  if (scaffold && python) {
    const files = [
      [path.join(pythonDir, "README.md"), PYTHON_INIT_README],
      [path.join(pythonDir, "agentlens_trace.py"), readPythonTraceWriterSource()],
      [path.join(pythonDir, "basic_run.py"), PYTHON_STARTER_RUN],
      [path.join(examplesDir, "python-github-action.yml"), PYTHON_GITHUB_ACTION_EXAMPLE]
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
    pythonDir,
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
