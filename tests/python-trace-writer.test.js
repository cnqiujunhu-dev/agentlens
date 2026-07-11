import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runnerPath = path.resolve(__dirname, "../scripts/run-python-demo.mjs");
const frameworkRunnerPath = path.resolve(__dirname, "../scripts/run-python-framework-demo.mjs");
const packageCheckPath = path.resolve(__dirname, "../scripts/check-python-package.mjs");

test("Python trace writer demo produces AgentLens-compatible artifacts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-python-demo-"));
  const traceFile = path.join(dir, "python-basic-demo.json");
  const asyncTraceFile = path.join(dir, "python-async-demo.json");
  const otelFile = path.join(dir, "python-basic-demo.otlp.json");
  const asyncOtelFile = path.join(dir, "python-async-demo.otlp.json");

  const result = spawnSync(process.execPath, [
    runnerPath,
    "--out",
    traceFile,
    "--async-out",
    asyncTraceFile,
    "--otel-out",
    otelFile,
    "--async-otel-out",
    asyncOtelFile
  ], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const trace = JSON.parse(fs.readFileSync(traceFile, "utf8"));
  assert.equal(trace.schemaVersion, "agentlens.trace.v1");
  assert.equal(trace.app, "python-support-agent");
  assert.equal(trace.status, "passed");
  assert.equal(trace.events.some((event) => event.type === "tool.call" && event.name === "kb.search"), true);
  assert.equal(trace.events.some((event) => event.type === "llm.response" && event.output?.citations?.includes("python-trace-writer")), true);

  const otel = JSON.parse(fs.readFileSync(otelFile, "utf8"));
  assert.equal(otel.resourceSpans.length, 1);

  const asyncTrace = JSON.parse(fs.readFileSync(asyncTraceFile, "utf8"));
  assert.equal(asyncTrace.schemaVersion, "agentlens.trace.v1");
  assert.equal(asyncTrace.app, "python-async-agent");
  assert.equal(asyncTrace.status, "passed");
  assert.equal(asyncTrace.events.some((event) => event.type === "llm.response" && event.output?.citations?.includes("async-python-trace-writer")), true);

  const asyncOtel = JSON.parse(fs.readFileSync(asyncOtelFile, "utf8"));
  assert.equal(asyncOtel.resourceSpans.length, 1);
});

test("Python framework cookbook demo produces framework-shaped traces", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-python-framework-demo-"));
  const runsDir = path.join(dir, "runs");
  const reportsDir = path.join(dir, "reports");

  const result = spawnSync(process.execPath, [frameworkRunnerPath, "--out-dir", runsDir, "--otel-dir", reportsDir], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

  for (const [file, app, framework] of [
    ["python-langchain-style-demo.json", "python-langchain-style-agent", "langchain"],
    ["python-langchain-fixture-demo.json", "python-langchain-fixture-agent", "langchain"],
    ["python-llamaindex-style-demo.json", "python-llamaindex-style-agent", "llamaindex"],
    ["python-crewai-style-demo.json", "python-crewai-style-agent", "crewai"]
  ]) {
    const trace = JSON.parse(fs.readFileSync(path.join(runsDir, file), "utf8"));
    assert.equal(trace.schemaVersion, "agentlens.trace.v1");
    assert.equal(trace.app, app);
    assert.equal(trace.status, "passed");
    assert.equal(trace.events.some((event) => event.type === "tool.call"), true);
    assert.equal(trace.events.some((event) => event.type === "llm.response" && event.output?.citations?.length > 0), true);
    assert.equal(trace.events.some((event) => event.metadata?.framework === framework), true);
    assert.equal(trace.events.some((event) => event.metadata?.adapter === "agentlens_trace.adapters"), true);

    const otel = JSON.parse(fs.readFileSync(path.join(reportsDir, file.replace(/\.json$/u, ".otlp.json")), "utf8"));
    assert.equal(otel.resourceSpans.length, 1);
  }

  const fixture = JSON.parse(fs.readFileSync(path.join(runsDir, "python-langchain-fixture-demo.json"), "utf8"));
  const fixtureResponse = fixture.events.find((event) => event.type === "llm.response" && event.name === "fixture-final-answer");
  assert.equal(fixtureResponse.output.content, "Yes. The policy supports a 30-day refund.");
  assert.equal(fixtureResponse.output.citations.includes("refund-policy.md"), true);
  assert.equal(fixtureResponse.usage.totalTokens, 30);
  assert.equal(fixtureResponse.metadata.run_id, "lc_fixture_llm");

  const fixtureRetrieval = fixture.events.find((event) => event.type === "retrieval.result");
  assert.equal(fixtureRetrieval.output.documents[0].page_content.includes("Refunds are available"), true);
  assert.equal(fixtureRetrieval.output.documents[0].metadata.doc_id, "lc_refund_policy");
  assert.equal(fixtureRetrieval.metadata.parent_run_id, "lc_fixture_chain");

  const llamaindex = JSON.parse(fs.readFileSync(path.join(runsDir, "python-llamaindex-style-demo.json"), "utf8"));
  const llamaindexQuery = llamaindex.events.find((event) => event.type === "retrieval.query");
  assert.equal(llamaindexQuery.input.query, "return policy evidence");

  const llamaindexRetrieval = llamaindex.events.find((event) => event.type === "retrieval.result");
  assert.equal(llamaindexRetrieval.output.documents[0].id, "li_refund_policy_node");
  assert.equal(llamaindexRetrieval.output.documents[0].text.includes("Refund policy evidence"), true);
  assert.equal(llamaindexRetrieval.output.documents[0].metadata.source, "llamaindex-refund-policy.md");
  assert.equal(llamaindexRetrieval.output.documents[0].score, 0.91);

  const llamaindexResponse = llamaindex.events.find((event) => event.type === "llm.response");
  assert.equal(llamaindexResponse.output.content, "The retrieved policy says refunds are allowed within 30 days.");
  assert.equal(llamaindexResponse.output.citations.includes("llamaindex-refund-policy.md"), true);
  assert.equal(llamaindexResponse.usage.totalTokens, 24);
});

test("Python package smoke check produces an AgentLens-compatible trace", () => {
  const result = spawnSync(process.execPath, [packageCheckPath], {
    cwd: fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-python-package-")),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /Python package smoke trace:/);
  assert.match(result.stdout, /Python adapters smoke trace:/);
});
