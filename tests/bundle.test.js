import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRunBundle, renderRunBundleIndex, writeRunBundle } from "../src/bundle.js";
import { writeTrace } from "../src/store.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binPath = path.resolve(__dirname, "../bin/agentlens.js");

function makeTrace(name = "bundle trace") {
  const run = createRun({ app: "bundle-agent", name });
  addEvent(run, { type: "llm.prompt", name: "planner" });
  addEvent(run, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  return finishRun(run, "passed");
}

test("renderRunBundleIndex escapes user-controlled values", () => {
  const html = renderRunBundleIndex({
    runsDir: "<script>alert(1)</script>",
    items: [
      {
        valid: true,
        source: "trace.json",
        dashboard: "trace.html",
        traceId: "run_1",
        app: "<img src=x onerror=alert(1)>",
        name: "unsafe <script>",
        status: "passed",
        events: 2,
        scanStatus: "PASS",
        scanFindings: 0
      }
    ]
  });

  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;/);
});

test("writeRunBundle writes an index and dashboards for valid traces", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-bundle-"));
  const runsDir = path.join(dir, "runs");
  const outDir = path.join(dir, "bundle");
  fs.mkdirSync(runsDir);
  writeTrace(path.join(runsDir, "trace.json"), makeTrace("support"));
  fs.writeFileSync(path.join(runsDir, "invalid.json"), JSON.stringify({ not: "a trace" }), "utf8");

  const result = writeRunBundle({ runsDir, outDir });

  assert.equal(result.total, 2);
  assert.equal(result.valid, 1);
  assert.equal(result.invalid, 1);
  assert.equal(fs.existsSync(result.index), true);
  assert.equal(result.dashboards.length, 1);
  assert.equal(fs.existsSync(result.dashboards[0]), true);

  const index = fs.readFileSync(result.index, "utf8");
  assert.match(index, /AgentLens Run Bundle/);
  assert.match(index, /support/);
  assert.match(index, /invalid/);
});

test("buildRunBundle includes scan finding counts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-bundle-scan-"));
  fs.mkdirSync(path.join(dir, "runs"));
  const trace = makeTrace("scan");
  trace.metadata.apiKey = "plain-secret";
  writeTrace(path.join(dir, "runs", "trace.json"), trace);

  const bundle = buildRunBundle({ runsDir: path.join(dir, "runs"), outDir: path.join(dir, "bundle") });

  assert.equal(bundle.items[0].scanStatus, "FAIL");
  assert.equal(bundle.items[0].scanFindings, 1);
  assert.match(bundle.indexHtml, /1 findings/);
});

test("CLI bundle writes a static run bundle", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-bundle-cli-"));
  const runsDir = path.join(dir, "runs");
  const outDir = path.join(dir, "bundle");
  fs.mkdirSync(runsDir);
  writeTrace(path.join(runsDir, "trace.json"), makeTrace("cli"));

  const result = spawnSync(process.execPath, [binPath, "bundle", runsDir, "--out", outDir], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote run bundle/);
  assert.equal(fs.existsSync(path.join(outDir, "index.html")), true);
});
