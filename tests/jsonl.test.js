import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonlTraceWriter, readJsonlTrace } from "../src/jsonl.js";

test("JsonlTraceWriter writes an append-friendly trace that can be materialized", () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-jsonl-")), "trace.jsonl");
  const writer = new JsonlTraceWriter(filePath, { app: "jsonl-agent", name: "jsonl test" });

  writer.addEvent({ type: "llm.prompt", name: "planner" });
  writer.addEvent({ type: "llm.response", name: "answer", output: { content: "ok", citations: ["doc"] } });
  writer.finish("passed");

  const trace = readJsonlTrace(filePath);
  const rawLines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);

  assert.equal(rawLines.length, 4);
  assert.equal(trace.app, "jsonl-agent");
  assert.equal(trace.status, "passed");
  assert.equal(trace.events.length, 2);
  assert.equal(trace.events[1].type, "llm.response");
});

test("readJsonlTrace rejects event records before run.started", () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-jsonl-")), "bad.jsonl");
  fs.writeFileSync(filePath, `${JSON.stringify({ kind: "event", event: { type: "note" } })}\n`, "utf8");

  assert.throws(() => readJsonlTrace(filePath), /before run.started/);
});
