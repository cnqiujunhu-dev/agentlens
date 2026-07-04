import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createDashboardServer, listen, listTraceFiles } from "../src/server.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";
import { writeTrace } from "../src/store.js";

function makeTrace(name = "server trace") {
  const run = createRun({ app: "server-test", name });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, "passed");
}

async function withServer(target, callback) {
  const server = createDashboardServer(target);
  const address = await listen(server, { port: 0 });
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("dashboard server lists trace files in directory mode", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-serve-"));
  writeTrace(path.join(dir, "demo.json"), makeTrace("directory trace"));

  await withServer(dir, async (baseUrl) => {
    const index = await fetch(baseUrl).then((res) => res.text());
    assert.match(index, /directory trace/);
    assert.match(index, /demo\.json/);

    const trace = await fetch(`${baseUrl}/trace/demo.json`).then((res) => res.text());
    assert.match(trace, /AgentLens Report/);
    assert.match(trace, /directory trace/);
  });
});

test("dashboard server serves a single trace file", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-serve-"));
  const file = path.join(dir, "single.json");
  writeTrace(file, makeTrace("single trace"));

  await withServer(file, async (baseUrl) => {
    const health = await fetch(`${baseUrl}/healthz`).then((res) => res.json());
    assert.deepEqual(health, { ok: true });

    const page = await fetch(baseUrl).then((res) => res.text());
    assert.match(page, /AgentLens Report/);
    assert.match(page, /single trace/);
  });
});

test("listTraceFiles returns nested JSON traces", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-serve-"));
  fs.mkdirSync(path.join(dir, "nested"));
  writeTrace(path.join(dir, "nested", "trace.json"), makeTrace("nested trace"));

  assert.deepEqual(listTraceFiles(dir), [path.join(dir, "nested", "trace.json")]);
});
