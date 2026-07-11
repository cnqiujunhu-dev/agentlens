import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRunBundle, buildRunBundleManifest, renderRunBundleIndex, writeRunBundle } from "../src/bundle.js";
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

function makeWorkflowTrace(name = "workflow trace") {
  const run = createRun({ app: "bundle-agent", name });
  addEvent(run, { type: "chain.start", name: "support-flow" });
  addEvent(run, { type: "agent.task.start", name: "lookup-policy" });
  addEvent(run, { type: "agent.task.end", name: "lookup-policy" });
  addEvent(run, { type: "chain.end", name: "support-flow" });
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
  assert.equal(fs.existsSync(result.manifest), true);
  assert.equal(result.dashboards.length, 1);
  assert.equal(fs.existsSync(result.dashboards[0]), true);

  const index = fs.readFileSync(result.index, "utf8");
  assert.match(index, /AgentLens Run Bundle/);
  assert.match(index, /manifest\.json/);
  assert.match(index, /support/);
  assert.match(index, /invalid/);

  const manifest = JSON.parse(fs.readFileSync(result.manifest, "utf8"));
  assert.equal(manifest.schemaVersion, "agentlens.run-bundle.v1");
  assert.equal(manifest.summary.total, 2);
  assert.equal(manifest.summary.valid, 1);
  assert.equal(manifest.summary.invalid, 1);
  assert.equal(manifest.items.find((item) => item.valid).dashboard.endsWith(".html"), true);
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
  assert.equal(bundle.manifest.summary.scanFindings, 1);
  assert.match(bundle.indexHtml, /1 findings/);
});

test("buildRunBundle includes workflow counts in index and manifest", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-bundle-workflow-"));
  fs.mkdirSync(path.join(dir, "runs"));
  writeTrace(path.join(dir, "runs", "trace.json"), makeWorkflowTrace("workflow"));

  const bundle = buildRunBundle({ runsDir: path.join(dir, "runs"), outDir: path.join(dir, "bundle") });

  assert.deepEqual(bundle.items[0].workflow, { chains: 2, tasks: 2, errors: 0 });
  assert.deepEqual(bundle.manifest.summary.workflow, { chains: 2, tasks: 2, errors: 0 });
  assert.deepEqual(bundle.manifest.items[0].workflow, { chains: 2, tasks: 2, errors: 0 });
  assert.match(bundle.indexHtml, /Workflow/);
  assert.match(bundle.indexHtml, /2 chains \/ 2 tasks \/ 0 errors/);
});

test("buildRunBundleManifest summarizes valid and invalid traces", () => {
  const manifest = buildRunBundleManifest({
    runsDir: "runs",
    generatedAt: "2026-01-01T00:00:00.000Z",
    items: [
      {
        valid: true,
        source: "passed.json",
        dashboard: "001-run.html",
        traceId: "run_1",
        app: "bundle-agent",
        name: "passed",
        status: "passed",
        events: 2,
        errors: 0,
        workflow: { chains: 2, tasks: 2, errors: 0 },
        scanStatus: "PASS",
        scanFindings: 0
      },
      {
        valid: false,
        source: "invalid.json",
        error: "Invalid trace"
      }
    ]
  });

  assert.equal(manifest.schemaVersion, "agentlens.run-bundle.v1");
  assert.equal(manifest.generatedAt, "2026-01-01T00:00:00.000Z");
  assert.deepEqual(manifest.summary, {
    total: 2,
    valid: 1,
    invalid: 1,
    failed: 0,
    scanFindings: 0,
    workflow: { chains: 2, tasks: 2, errors: 0 }
  });
  assert.deepEqual(manifest.items[1], { valid: false, source: "invalid.json", error: "Invalid trace" });
});

test("CLI bundle writes a static run bundle with selected dashboard sections", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-bundle-cli-"));
  const runsDir = path.join(dir, "runs");
  const outDir = path.join(dir, "bundle");
  fs.mkdirSync(runsDir);
  writeTrace(path.join(runsDir, "trace.json"), makeTrace("cli"));

  const result = spawnSync(process.execPath, [binPath, "bundle", runsDir, "--out", outDir, "--sections", "summary,timeline"], {
    cwd: dir,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Wrote run bundle/);
  assert.equal(fs.existsSync(path.join(outDir, "index.html")), true);
  assert.equal(fs.existsSync(path.join(outDir, "manifest.json")), true);
  const dashboardFile = fs.readdirSync(outDir).find((file) => file.endsWith(".html") && file !== "index.html");
  assert.ok(dashboardFile);
  const dashboard = fs.readFileSync(path.join(outDir, dashboardFile), "utf8");
  assert.match(dashboard, /Timeline/);
  assert.doesNotMatch(dashboard, /Security Scan/);
  assert.doesNotMatch(dashboard, /Timeline Filters/);
  assert.doesNotMatch(dashboard, /Event Types/);
});
