import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { formatCiMarkdown, formatCiReport, runCi } from "../src/ci.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";
import { writeTrace } from "../src/store.js";

function makePassingTrace() {
  const run = createRun({ app: "ci-agent", name: "passing" });
  addEvent(run, { type: "llm.prompt", name: "answer" });
  addEvent(run, { type: "llm.response", name: "answer", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, "passed");
}

function makeFailingTrace() {
  const run = createRun({ app: "ci-agent", name: "failing" });
  addEvent(run, { type: "llm.response", name: "answer", output: { content: "uncited" } });
  return finishRun(run, "failed");
}

test("runCi evaluates every trace file in a run directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-ci-"));
  writeTrace(path.join(dir, "pass.json"), makePassingTrace());
  writeTrace(path.join(dir, "fail.json"), makeFailingTrace());

  const summary = runCi({
    runsDir: dir,
    config: {
      name: "ci-test",
      assertions: [{ id: "citations", type: "required-citations", min: 1 }]
    }
  });

  assert.equal(summary.total, 2);
  assert.equal(summary.passed, 1);
  assert.equal(summary.failed, 1);
  assert.match(formatCiReport(summary), /Status: FAIL/);
  assert.match(formatCiMarkdown(summary), /## AgentLens CI/);
  assert.match(formatCiMarkdown(summary), /citations:/);
});
