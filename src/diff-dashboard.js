function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDelta(value, suffix = "") {
  if (value === null) return "unknown";
  if (value === 0) return "0";
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function formatUsdDelta(value) {
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "-"}$${Math.abs(value).toFixed(4)}`;
}

function deltaClass(value) {
  if (value === null || value === 0) return "delta neutral";
  return value > 0 ? "delta up" : "delta down";
}

function renderMetric(label, baseline, candidate, delta, formatter = String) {
  return `<div class="metric">
    <div class="metric-label">${escapeHtml(label)}</div>
    <div class="metric-values"><span>${escapeHtml(formatter(baseline))}</span><span>${escapeHtml(formatter(candidate))}</span></div>
    <div class="${deltaClass(delta)}">${escapeHtml(typeof formatter.delta === "function" ? formatter.delta(delta) : formatDelta(delta))}</div>
  </div>`;
}

function renderRows(rows) {
  if (rows.length === 0) return `<tr><td colspan="4">none</td></tr>`;
  return rows
    .map(
      (row) => `<tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.baseline)}</td>
        <td>${escapeHtml(row.candidate)}</td>
        <td><span class="${deltaClass(row.delta)}">${escapeHtml(formatDelta(row.delta))}</span></td>
      </tr>`
    )
    .join("");
}

function renderRegressions(regressions) {
  if (regressions.length === 0) return `<div class="empty">No regressions detected.</div>`;
  return `<ul>${regressions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

export function renderDiffDashboard(diff) {
  const number = (value) => value;
  const usd = (value) => `$${value.toFixed(4)}`;
  usd.delta = formatUsdDelta;
  const ms = (value) => (value === null ? "unknown" : `${value}ms`);
  ms.delta = (value) => formatDelta(value, "ms");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentLens Trace Diff - ${escapeHtml(diff.baseline.runId)} vs ${escapeHtml(diff.candidate.runId)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #657184;
      --line: #d9dee8;
      --accent: #0f766e;
      --danger: #b42318;
      --danger-soft: #fee4e2;
      --ok: #027a48;
      --ok-soft: #dcfae6;
      --warn: #b54708;
      --warn-soft: #fff7ed;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
    header { background: #101828; color: #fff; padding: 32px 40px; }
    header h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    header p { margin: 0; color: #cbd5e1; overflow-wrap: anywhere; }
    main { width: min(1180px, calc(100% - 32px)); margin: 24px auto 48px; }
    .panel, .metric { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04); }
    .run-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
    .run { padding: 16px; }
    .run h2 { margin: 0 0 6px; font-size: 16px; }
    .run p { margin: 0; color: var(--muted); overflow-wrap: anywhere; }
    .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
    .metric { padding: 14px 16px; min-height: 104px; }
    .metric-label { color: var(--muted); font-size: 13px; margin-bottom: 8px; }
    .metric-values { display: flex; justify-content: space-between; gap: 10px; font-weight: 700; margin-bottom: 6px; }
    .metric-values span { overflow-wrap: anywhere; }
    .delta { display: inline-flex; align-items: center; border-radius: 999px; padding: 2px 8px; font-size: 12px; border: 1px solid var(--line); color: var(--muted); }
    .delta.up { color: var(--danger); background: var(--danger-soft); border-color: #fda29b; }
    .delta.down { color: var(--ok); background: var(--ok-soft); border-color: #75e0a7; }
    .section { padding: 18px; margin-top: 16px; }
    .section h2 { margin: 0 0 14px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border-top: 1px solid var(--line); padding: 9px 8px; text-align: left; vertical-align: top; }
    th { color: var(--muted); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .regressions ul { margin: 0; padding-left: 20px; }
    .regressions li { margin: 6px 0; color: var(--danger); }
    .empty { color: var(--ok); background: var(--ok-soft); border: 1px solid #75e0a7; border-radius: 8px; padding: 12px; }
    footer { color: var(--muted); font-size: 12px; padding: 24px 0; text-align: center; }
    @media (max-width: 900px) { .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 640px) { header { padding: 24px 18px; } main { width: min(100% - 20px, 1180px); } .run-grid, .metrics { grid-template-columns: 1fr; } table { font-size: 13px; } }
  </style>
</head>
<body>
  <header>
    <h1>AgentLens Trace Diff</h1>
    <p>${escapeHtml(diff.baseline.name)} -> ${escapeHtml(diff.candidate.name)}</p>
  </header>
  <main>
    <section class="run-grid">
      <div class="panel run">
        <h2>Baseline</h2>
        <p>${escapeHtml(diff.baseline.app)} / ${escapeHtml(diff.baseline.runId)}</p>
      </div>
      <div class="panel run">
        <h2>Candidate</h2>
        <p>${escapeHtml(diff.candidate.app)} / ${escapeHtml(diff.candidate.runId)}</p>
      </div>
    </section>
    <section class="metrics">
      ${renderMetric("Events", diff.baseline.eventCount, diff.candidate.eventCount, diff.deltas.eventCount, number)}
      ${renderMetric("Errors", diff.baseline.errors, diff.candidate.errors, diff.deltas.errors, number)}
      ${renderMetric("LLM tokens", diff.baseline.totalLlmTokens, diff.candidate.totalLlmTokens, diff.deltas.totalLlmTokens, number)}
      ${renderMetric("Cost", diff.baseline.totalCostUsd, diff.candidate.totalCostUsd, diff.deltas.totalCostUsd, usd)}
      ${renderMetric("Known duration", diff.baseline.totalKnownDurationMs, diff.candidate.totalKnownDurationMs, diff.deltas.totalKnownDurationMs, ms)}
      ${renderMetric("Wall time", diff.baseline.wallTimeMs, diff.candidate.wallTimeMs, diff.deltas.wallTimeMs, ms)}
    </section>
    <section class="panel section regressions">
      <h2>Regressions</h2>
      ${renderRegressions(diff.regressions)}
    </section>
    <section class="panel section">
      <h2>Event Types</h2>
      <table>
        <thead><tr><th>Type</th><th>Baseline</th><th>Candidate</th><th>Delta</th></tr></thead>
        <tbody>${renderRows(diff.eventTypes)}</tbody>
      </table>
    </section>
    <section class="panel section">
      <h2>Tools</h2>
      <table>
        <thead><tr><th>Tool</th><th>Baseline</th><th>Candidate</th><th>Delta</th></tr></thead>
        <tbody>${renderRows(diff.tools)}</tbody>
      </table>
    </section>
    <footer>Generated by AgentLens. Static diff report, no external assets.</footer>
  </main>
</body>
</html>`;
}
