import path from "node:path";
import { discoverTraceFiles } from "./ci.js";
import { renderDashboard } from "./dashboard.js";
import { summarizeTrace } from "./inspect.js";
import { scanTrace } from "./scan.js";
import { ensureDir, readTrace, writeJson, writeText } from "./store.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeName(value) {
  return String(value || "trace")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "trace";
}

function relativePath(root, file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function normalizeWorkflow(workflow = {}) {
  return {
    chains: workflow.chains ?? 0,
    tasks: workflow.tasks ?? 0,
    errors: workflow.errors ?? 0
  };
}

function summarizeBundleItems(items) {
  const valid = items.filter((item) => item.valid).length;
  const failed = items.filter((item) => item.valid && item.status === "failed").length;
  const scanFindings = items.reduce((sum, item) => sum + (item.scanFindings ?? 0), 0);
  const workflow = items.reduce(
    (sum, item) => ({
      chains: sum.chains + (item.workflow?.chains ?? 0),
      tasks: sum.tasks + (item.workflow?.tasks ?? 0),
      errors: sum.errors + (item.workflow?.errors ?? 0)
    }),
    { chains: 0, tasks: 0, errors: 0 }
  );
  return {
    total: items.length,
    valid,
    invalid: items.length - valid,
    failed,
    scanFindings,
    workflow
  };
}

function renderBundleCards(items) {
  const summary = summarizeBundleItems(items);
  const cards = [
    ["Traces", summary.total],
    ["Valid", summary.valid],
    ["Failed", summary.failed],
    ["Scan findings", summary.scanFindings],
    ["Workflow", `${summary.workflow.chains} chains / ${summary.workflow.tasks} tasks`]
  ];

  return cards
    .map(([label, value]) => `<div class="card"><div class="card-label">${escapeHtml(label)}</div><div class="card-value">${escapeHtml(value)}</div></div>`)
    .join("");
}

function renderBundleRows(items) {
  if (items.length === 0) {
    return `<tr><td colspan="7">No trace JSON files found.</td></tr>`;
  }

  return items
    .map((item) => {
      const status = item.valid ? item.status : "invalid";
      const title = item.valid ? `${item.name} (${item.app})` : item.source;
      const link = item.dashboard ? `<a href="${escapeHtml(item.dashboard)}">${escapeHtml(title)}</a>` : escapeHtml(title);
      const scan = item.valid ? `${item.scanStatus} (${item.scanFindings} findings)` : "n/a";
      const workflow = item.valid
        ? `${item.workflow?.chains ?? 0} chains / ${item.workflow?.tasks ?? 0} tasks / ${item.workflow?.errors ?? 0} errors`
        : "n/a";
      const details = item.valid ? escapeHtml(item.traceId) : escapeHtml(item.error);
      return `
        <tr class="status-${escapeHtml(status)}">
          <td>${link}</td>
          <td><span>${escapeHtml(status)}</span></td>
          <td>${escapeHtml(item.events ?? "n/a")}</td>
          <td>${escapeHtml(workflow)}</td>
          <td>${escapeHtml(scan)}</td>
          <td><code>${escapeHtml(item.source)}</code></td>
          <td><code>${details}</code></td>
        </tr>
      `;
    })
    .join("");
}

export function renderRunBundleIndex({ runsDir, generatedAt = new Date().toISOString(), items = [] } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentLens Run Bundle</title>
  <style>
    body { margin: 0; background: #f6f7f9; color: #17202a; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
    header { background: #101828; color: #fff; padding: 30px 38px; }
    header h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: 0; }
    header p { margin: 0; color: #cbd5e1; }
    main { width: min(1180px, calc(100% - 32px)); margin: 24px auto 48px; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
    .card, .table-wrap { background: #fff; border: 1px solid #d9dee8; border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); }
    .card { padding: 14px 16px; min-height: 82px; }
    .card-label { color: #657184; font-size: 13px; margin-bottom: 8px; }
    .card-value { font-size: 22px; font-weight: 700; overflow-wrap: anywhere; }
    .table-wrap { overflow: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 860px; }
    th, td { padding: 12px 14px; border-bottom: 1px solid #d9dee8; text-align: left; vertical-align: top; font-size: 13px; }
    th { color: #657184; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; background: #f9fafb; }
    tr:last-child td { border-bottom: 0; }
    a { color: #0f766e; font-weight: 700; text-decoration: none; overflow-wrap: anywhere; }
    span { border: 1px solid #d9dee8; border-radius: 999px; padding: 2px 8px; color: #657184; white-space: nowrap; }
    .status-failed span, .status-invalid span { background: #fee4e2; border-color: #fecaca; color: #b42318; }
    .status-passed span { background: #ecfdf3; border-color: #abefc6; color: #067647; }
    code { color: #657184; overflow-wrap: anywhere; white-space: normal; }
    footer { color: #657184; font-size: 12px; padding: 24px 0; text-align: center; }
    @media (max-width: 800px) {
      header { padding: 24px 18px; }
      main { width: min(100% - 20px, 1180px); }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <header>
    <h1>AgentLens Run Bundle</h1>
    <p>${escapeHtml(runsDir)} · generated ${escapeHtml(generatedAt)}</p>
  </header>
  <main>
    <section class="grid">${renderBundleCards(items)}</section>
    <section class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Trace</th>
            <th>Status</th>
            <th>Events</th>
            <th>Workflow</th>
            <th>Scan</th>
            <th>Source</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>${renderBundleRows(items)}</tbody>
      </table>
    </section>
    <footer>Generated by AgentLens. Static bundle, no external assets. Machine-readable data: <a href="manifest.json">manifest.json</a>.</footer>
  </main>
</body>
</html>`;
}

export function buildRunBundleManifest({ runsDir = ".agentlens/runs", generatedAt = new Date().toISOString(), items = [] } = {}) {
  return {
    schemaVersion: "agentlens.run-bundle.v1",
    generatedAt,
    runsDir,
    summary: summarizeBundleItems(items),
    items: items.map((item) => {
      if (!item.valid) {
        return {
          valid: false,
          source: item.source,
          error: item.error
        };
      }

      return {
        valid: true,
        source: item.source,
        dashboard: item.dashboard,
        traceId: item.traceId,
        app: item.app,
        name: item.name,
        status: item.status,
        events: item.events,
        errors: item.errors,
        workflow: normalizeWorkflow(item.workflow),
        scanStatus: item.scanStatus,
        scanFindings: item.scanFindings
      };
    })
  };
}

export function buildRunBundle({ runsDir = ".agentlens/runs", outDir = ".agentlens/reports/bundle", sections = undefined } = {}) {
  const files = discoverTraceFiles(runsDir);
  const items = [];
  const dashboards = [];
  const generatedAt = new Date().toISOString();

  for (const [index, file] of files.entries()) {
    const source = relativePath(runsDir, file);
    try {
      const trace = readTrace(file);
      const summary = summarizeTrace(trace);
      const scanReport = scanTrace(trace);
      const dashboard = `${String(index + 1).padStart(3, "0")}-${safeName(trace.runId)}.html`;
      items.push({
        valid: true,
        source,
        dashboard,
        traceId: trace.runId,
        app: trace.app,
        name: trace.name,
        status: trace.status,
        events: summary.eventCount,
        errors: summary.errors,
        workflow: summary.workflow,
        scanStatus: scanReport.passed ? "PASS" : "FAIL",
        scanFindings: scanReport.summary.findings
      });
      dashboards.push({ file: path.join(outDir, dashboard), html: renderDashboard(trace, { sections }) });
    } catch (error) {
      items.push({
        valid: false,
        source,
        error: error.message
      });
    }
  }

  return {
    runsDir,
    outDir,
    generatedAt,
    indexHtml: renderRunBundleIndex({ runsDir, generatedAt, items }),
    manifest: buildRunBundleManifest({ runsDir, generatedAt, items }),
    items,
    dashboards
  };
}

export function writeRunBundle(options = {}) {
  const bundle = buildRunBundle(options);
  ensureDir(bundle.outDir);
  const index = path.join(bundle.outDir, "index.html");
  const manifest = path.join(bundle.outDir, "manifest.json");
  writeText(index, bundle.indexHtml);
  writeJson(manifest, bundle.manifest);
  for (const dashboard of bundle.dashboards) {
    writeText(dashboard.file, dashboard.html);
  }

  return {
    outDir: bundle.outDir,
    index,
    manifest,
    dashboards: bundle.dashboards.map((dashboard) => dashboard.file),
    total: bundle.items.length,
    valid: bundle.items.filter((item) => item.valid).length,
    invalid: bundle.items.filter((item) => !item.valid).length
  };
}
