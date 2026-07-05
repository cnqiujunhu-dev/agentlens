import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildOtelTrace, writeOtelTrace } from "../src/otel.js";
import { writeTrace } from "../src/store.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function attrValue(span, key) {
  const value = span.attributes.find((item) => item.key === key)?.value;
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("intValue" in value) return Number(value.intValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("boolValue" in value) return value.boolValue;
  return value;
}

function makeTrace() {
  const run = createRun({
    app: "otel-test",
    name: "otel export",
    metadata: { requestId: "req_123" }
  });
  run.runId = "run_otel";
  run.startedAt = "2026-01-01T00:00:00.000Z";

  addEvent(run, {
    id: "evt_prompt",
    ts: "2026-01-01T00:00:00.100Z",
    type: "llm.prompt",
    name: "answer",
    provider: "openai-compatible",
    model: "demo-model",
    input: {
      messages: [{ role: "user", content: "What is AgentLens?" }]
    }
  });
  addEvent(run, {
    id: "evt_response",
    ts: "2026-01-01T00:00:00.900Z",
    type: "llm.response",
    name: "answer",
    provider: "openai-compatible",
    model: "demo-model",
    durationMs: 800,
    usage: { inputTokens: 6, outputTokens: 8, totalTokens: 14, costUsd: 0.0001 },
    output: { content: "AgentLens records local traces.", citations: ["readme"] }
  });
  addEvent(run, {
    id: "evt_tool_call",
    ts: "2026-01-01T00:00:01.000Z",
    type: "tool.call",
    name: "kb.search",
    input: { query: "refund" },
    metadata: { mcpServer: "kb", permission: "read-only", risk: "low" }
  });
  addEvent(run, {
    id: "evt_tool_result",
    ts: "2026-01-01T00:00:01.200Z",
    type: "tool.result",
    name: "kb.search",
    durationMs: 200,
    output: { documents: [{ id: "doc_1" }] }
  });
  addEvent(run, {
    id: "evt_query",
    ts: "2026-01-01T00:00:01.300Z",
    type: "retrieval.query",
    name: "policy-search",
    input: { query: "refund" }
  });
  addEvent(run, {
    id: "evt_result",
    ts: "2026-01-01T00:00:01.450Z",
    type: "retrieval.result",
    name: "policy-search",
    durationMs: 150,
    output: { documents: [{ id: "doc_1", score: 0.99 }] }
  });

  finishRun(run, "passed");
  run.endedAt = "2026-01-01T00:00:02.000Z";
  return run;
}

test("buildOtelTrace exports OTLP JSON with OpenInference attributes", () => {
  const otel = buildOtelTrace(makeTrace());
  const resourceSpan = otel.resourceSpans[0];
  const spans = resourceSpan.scopeSpans[0].spans;

  assert.equal(attrValue(resourceSpan.resource, "service.name"), "otel-test");
  assert.equal(spans.length, 4);
  assert.equal(attrValue(spans[0], "openinference.span.kind"), "AGENT");

  const llm = spans.find((span) => attrValue(span, "openinference.span.kind") === "LLM");
  assert.equal(llm.name, "answer");
  assert.equal(llm.parentSpanId, spans[0].spanId);
  assert.equal(attrValue(llm, "llm.model_name"), "demo-model");
  assert.equal(attrValue(llm, "llm.input_messages.0.message.role"), "user");
  assert.equal(attrValue(llm, "llm.output_messages.0.message.content"), "AgentLens records local traces.");
  assert.equal(attrValue(llm, "gen_ai.usage.input_tokens"), 6);

  const tool = spans.find((span) => attrValue(span, "openinference.span.kind") === "TOOL");
  assert.equal(attrValue(tool, "tool.name"), "kb.search");
  assert.equal(attrValue(tool, "agentlens.mcp.server"), "kb");

  const retriever = spans.find((span) => attrValue(span, "openinference.span.kind") === "RETRIEVER");
  assert.equal(attrValue(retriever, "retrieval.query"), "refund");
});

test("writeOtelTrace writes an OTLP JSON file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-otel-"));
  const traceFile = path.join(dir, "trace.json");
  const out = path.join(dir, "trace.otlp.json");
  writeTrace(traceFile, makeTrace());

  const result = writeOtelTrace({ traceFile, out, serviceName: "custom-service" });

  assert.equal(result.out, out);
  assert.equal(result.spans, 4);
  const otel = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(attrValue(otel.resourceSpans[0].resource, "service.name"), "custom-service");
});

test("CLI otel emits JSON or writes to a file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-otel-cli-"));
  const traceFile = path.join(dir, "trace.json");
  const out = path.join(dir, "trace.otlp.json");
  writeTrace(traceFile, makeTrace());

  const stdoutResult = spawnSync(process.execPath, [binPath, "otel", traceFile], {
    cwd: dir,
    encoding: "utf8"
  });
  assert.equal(stdoutResult.status, 0, stdoutResult.stderr);
  assert.equal(JSON.parse(stdoutResult.stdout).resourceSpans.length, 1);

  const writeResult = spawnSync(process.execPath, [binPath, "otel", traceFile, "--out", out], {
    cwd: dir,
    encoding: "utf8"
  });
  assert.equal(writeResult.status, 0, writeResult.stderr);
  assert.match(writeResult.stdout, /Wrote OTel trace/);
  assert.equal(fs.existsSync(out), true);
});
