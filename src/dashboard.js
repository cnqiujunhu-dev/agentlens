import { summarizeTrace } from "./inspect.js";
import { scanTrace } from "./scan.js";

export const DEFAULT_DASHBOARD_SECTIONS = ["summary", "event-types", "scan", "filters", "timeline"];

export function normalizeDashboardSections(sections = DEFAULT_DASHBOARD_SECTIONS) {
  const values =
    typeof sections === "string"
      ? sections.split(",")
      : Array.isArray(sections)
        ? sections
        : DEFAULT_DASHBOARD_SECTIONS;
  const normalized = [...new Set(values.map((section) => String(section).trim().toLowerCase()).filter(Boolean))];
  const unknown = normalized.filter((section) => !DEFAULT_DASHBOARD_SECTIONS.includes(section));
  if (unknown.length > 0) {
    throw new Error(`Unknown dashboard section(s): ${unknown.join(", ")}`);
  }
  return normalized.length > 0 ? normalized : DEFAULT_DASHBOARD_SECTIONS;
}

function hasSection(sections, section) {
  return sections.includes(section);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function compactJson(value) {
  if (value === undefined) return "";
  return escapeHtml(JSON.stringify(value, null, 2));
}

function eventTitle(event) {
  return [event.type, event.name].filter(Boolean).join(" / ");
}

function eventAnchor(index) {
  return `agentlens-event-${index + 1}`;
}

function eventBody(event) {
  const blocks = [];
  if (event.input !== undefined) blocks.push(["input", event.input]);
  if (event.output !== undefined) blocks.push(["output", event.output]);
  if (event.usage !== undefined) blocks.push(["usage", event.usage]);
  if (event.metadata !== undefined) blocks.push(["metadata", event.metadata]);

  if (blocks.length === 0) return "";

  return blocks
    .map(([label, value]) => `<div class="event-block"><div class="block-label">${label}</div><pre>${compactJson(value)}</pre></div>`)
    .join("");
}

function deltaMs(trace, event) {
  return Math.max(0, new Date(event.ts).getTime() - new Date(trace.startedAt).getTime());
}

function renderCards(summary, scanReport) {
  const cards = [
    ["Status", summary.status],
    ["Events", summary.eventCount],
    ["Wall time", `${summary.wallTimeMs ?? "unknown"} ms`],
    ["Known duration", `${summary.totalKnownDurationMs} ms`],
    ["LLM tokens", summary.totalLlmTokens],
    ["Cost", `$${summary.totalCostUsd.toFixed(4)}`],
    ["Errors", summary.errors],
    ["Tools", summary.tools.length],
    ["Scan", scanReport.summary.findings === 0 ? "PASS" : `${scanReport.summary.findings} findings`]
  ];

  return cards
    .map(([label, value]) => `<div class="card"><div class="card-label">${escapeHtml(label)}</div><div class="card-value">${escapeHtml(value)}</div></div>`)
    .join("");
}

function renderScanFindings(scanReport) {
  if (scanReport.findings.length === 0) {
    return `<p class="empty-state">No scan findings.</p>`;
  }

  return scanReport.findings
    .map((finding) => {
      const event = [finding.eventType, finding.eventName].filter(Boolean).join(" / ");
      return `
        <article class="scan-finding severity-${escapeHtml(finding.severity)}">
          <div class="scan-finding-header">
            <span class="severity-badge">${escapeHtml(finding.severity.toUpperCase())}</span>
            <div>
              <h3>${escapeHtml(finding.ruleId)}</h3>
              <p>${escapeHtml(finding.message)}</p>
            </div>
          </div>
          <dl>
            <div><dt>Category</dt><dd>${escapeHtml(finding.category)}</dd></div>
            <div><dt>Path</dt><dd>${escapeHtml(finding.path)}</dd></div>
            ${event ? `<div><dt>Event</dt><dd>${escapeHtml(event)}</dd></div>` : ""}
            ${finding.sample ? `<div><dt>Sample</dt><dd>${escapeHtml(finding.sample)}</dd></div>` : ""}
          </dl>
        </article>
      `;
    })
    .join("");
}

function renderScanSection(scanReport) {
  const status = scanReport.passed ? "PASS" : "FAIL";
  return `
    <section class="section scan-section">
      <div class="section-title">
        <h2>Security Scan</h2>
        <span class="scan-status scan-status-${status.toLowerCase()}">${status}</span>
      </div>
      <p class="section-note">${scanReport.summary.findings} findings. Fails on ${escapeHtml(scanReport.failOnSeverity)} severity.</p>
      <div class="scan-findings">${renderScanFindings(scanReport)}</div>
    </section>
  `;
}

function renderTypeCounts(summary) {
  return Object.entries(summary.byType)
    .map(([type, count]) => `<span class="pill">${escapeHtml(type)} <strong>${count}</strong></span>`)
    .join("");
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function renderOptions(values, allLabel) {
  return [`<option value="">${escapeHtml(allLabel)}</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)].join("");
}

function findLastIndex(values, predicate) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (predicate(values[index], index)) return index;
  }
  return -1;
}

function renderJumpLink(trace, label, index) {
  if (index < 0) return "";
  const event = trace.events[index];
  return `
    <a class="jump-link" href="#${eventAnchor(index)}">
      <span>${escapeHtml(label)}</span>
      <strong>#${index + 1}</strong>
      <em>${escapeHtml(eventTitle(event) || event.type)}</em>
    </a>
  `;
}

function renderTimelineJumps(trace) {
  const highRisk = new Set(["high", "critical"]);
  const jumps = [
    ["First error", trace.events.findIndex((event) => event.status === "error" || event.type === "error")],
    ["First high risk", trace.events.findIndex((event) => highRisk.has(String(event.metadata?.toolRisk ?? "").toLowerCase()))],
    ["First tool call", trace.events.findIndex((event) => event.type === "tool.call")],
    ["Final response", findLastIndex(trace.events, (event) => event.type === "llm.response")],
    ["Last event", trace.events.length - 1]
  ]
    .map(([label, index]) => renderJumpLink(trace, label, index))
    .filter(Boolean)
    .join("");

  if (!jumps) return "";
  return `
    <nav class="timeline-jumps" aria-label="Timeline jumps">
      ${jumps}
    </nav>
  `;
}

function renderFilters(trace) {
  const types = uniqueValues(trace.events.map((event) => event.type));
  const statuses = uniqueValues(trace.events.map((event) => event.status ?? "ok"));
  const risks = uniqueValues(trace.events.map((event) => event.metadata?.toolRisk));

  return `
    <section class="section filters" data-agentlens-filters>
      <div class="filter-header">
        <h2>Timeline Filters</h2>
        <span id="agentlens-filter-count">${trace.events.length} events</span>
      </div>
      <div class="filter-controls">
        <label>
          <span>Search</span>
          <input id="agentlens-filter-search" type="search" placeholder="tool, prompt, citation, error">
        </label>
        <label>
          <span>Type</span>
          <select id="agentlens-filter-type">${renderOptions(types, "All types")}</select>
        </label>
        <label>
          <span>Status</span>
          <select id="agentlens-filter-status">${renderOptions(statuses, "All statuses")}</select>
        </label>
        <label>
          <span>MCP Risk</span>
          <select id="agentlens-filter-risk">${renderOptions(risks, "All risks")}</select>
        </label>
      </div>
      ${renderTimelineJumps(trace)}
    </section>
  `;
}

function eventSearchText(event) {
  return [
    event.type,
    event.name,
    event.status,
    event.metadata?.server,
    event.metadata?.permission,
    event.metadata?.toolRisk,
    event.input === undefined ? "" : JSON.stringify(event.input),
    event.output === undefined ? "" : JSON.stringify(event.output)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderTimeline(trace) {
  return trace.events
    .map((event, index) => {
      const status = event.status ?? "ok";
      const duration = typeof event.durationMs === "number" ? `${event.durationMs}ms` : "";
      const risk = event.metadata?.toolRisk;
      return `
        <article
          id="${eventAnchor(index)}"
          class="event event-${escapeHtml(event.type.replaceAll(".", "-"))} status-${escapeHtml(status)}${risk ? ` risk-${escapeHtml(risk)}` : ""}"
          data-event-type="${escapeHtml(event.type)}"
          data-event-status="${escapeHtml(status)}"
          data-event-risk="${escapeHtml(risk ?? "")}"
          data-event-search="${escapeHtml(eventSearchText(event))}">
          <div class="event-index">${index + 1}</div>
          <div class="event-main">
            <div class="event-header">
              <div>
                <h3>${escapeHtml(eventTitle(event))}</h3>
                <p>+${deltaMs(trace, event)}ms · ${escapeHtml(event.ts)}</p>
              </div>
              <div class="event-meta">
                <span>${escapeHtml(status)}</span>
                ${duration ? `<span>${escapeHtml(duration)}</span>` : ""}
                ${risk ? `<span class="risk-badge">${escapeHtml(risk)} risk</span>` : ""}
              </div>
            </div>
            ${eventBody(event)}
          </div>
        </article>
      `;
    })
    .join("");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function renderLiveReload(options) {
  if (!options.liveReloadUrl || !options.liveReloadSignature) return "";

  return `<script id="agentlens-live-reload">
    (() => {
      const state = ${safeJson({
        url: options.liveReloadUrl,
        signature: options.liveReloadSignature,
        intervalMs: options.liveReloadIntervalMs ?? 2000
      })};
      async function poll() {
        try {
          const response = await fetch(state.url, { cache: "no-store" });
          if (!response.ok) return;
          const stat = await response.json();
          const signature = [stat.mtimeMs, stat.size].join(":");
          if (signature && signature !== state.signature) window.location.reload();
        } catch {}
      }
      window.setInterval(poll, state.intervalMs);
    })();
  </script>`;
}

function renderFilterScript() {
  return `<script id="agentlens-dashboard-filters">
    (() => {
      const events = Array.from(document.querySelectorAll(".event"));
      const search = document.getElementById("agentlens-filter-search");
      const type = document.getElementById("agentlens-filter-type");
      const status = document.getElementById("agentlens-filter-status");
      const risk = document.getElementById("agentlens-filter-risk");
      const count = document.getElementById("agentlens-filter-count");
      if (!search || !type || !status || !risk || !count) return;

      function applyFilters() {
        const query = search.value.trim().toLowerCase();
        const selectedType = type.value;
        const selectedStatus = status.value;
        const selectedRisk = risk.value;
        let visible = 0;

        for (const event of events) {
          const matches =
            (!query || event.dataset.eventSearch.includes(query)) &&
            (!selectedType || event.dataset.eventType === selectedType) &&
            (!selectedStatus || event.dataset.eventStatus === selectedStatus) &&
            (!selectedRisk || event.dataset.eventRisk === selectedRisk);
          event.hidden = !matches;
          if (matches) visible += 1;
        }

        count.textContent = visible + " of " + events.length + " events";
      }

      for (const control of [search, type, status, risk]) {
        control.addEventListener("input", applyFilters);
        control.addEventListener("change", applyFilters);
      }
      applyFilters();
    })();
  </script>`;
}

export function renderDashboard(trace, options = {}) {
  const summary = summarizeTrace(trace);
  const scanReport = scanTrace(trace);
  const sections = normalizeDashboardSections(options.sections);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentLens Report - ${escapeHtml(trace.runId)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #657184;
      --line: #d9dee8;
      --accent: #0f766e;
      --accent-soft: #dff7f3;
      --danger: #b42318;
      --danger-soft: #fee4e2;
      --code: #111827;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    header {
      background: #101828;
      color: white;
      padding: 32px 40px;
    }
    header h1 {
      margin: 0 0 8px;
      font-size: 28px;
      letter-spacing: 0;
    }
    header p {
      margin: 0;
      color: #cbd5e1;
      max-width: 960px;
    }
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 24px auto 48px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 18px;
    }
    .card, .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    }
    .card {
      padding: 14px 16px;
      min-height: 86px;
    }
    .card-label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 8px;
    }
    .card-value {
      font-size: 22px;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .section {
      padding: 18px;
      margin-top: 16px;
    }
    .section h2 {
      margin: 0 0 14px;
      font-size: 18px;
    }
    .section-title {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin-bottom: 10px;
    }
    .section-title h2 {
      margin: 0;
    }
    .section-note {
      color: var(--muted);
      margin: 0 0 14px;
      font-size: 13px;
    }
    .empty-state {
      color: var(--muted);
      margin: 0;
    }
    .scan-status, .severity-badge {
      border-radius: 999px;
      border: 1px solid var(--line);
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .scan-status-pass {
      background: #ecfdf3;
      border-color: #abefc6;
      color: #067647;
    }
    .scan-status-fail, .severity-high .severity-badge, .severity-critical .severity-badge {
      background: var(--danger-soft);
      border-color: #fecaca;
      color: var(--danger);
    }
    .severity-medium .severity-badge {
      background: #fff7ed;
      border-color: #fed7aa;
      color: #9a3412;
    }
    .severity-low .severity-badge {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1d4ed8;
    }
    .scan-findings {
      display: grid;
      gap: 10px;
    }
    .scan-finding {
      border-top: 1px solid var(--line);
      padding-top: 12px;
    }
    .scan-finding:first-child {
      border-top: 0;
      padding-top: 0;
    }
    .scan-finding-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }
    .scan-finding h3 {
      margin: 0;
      font-size: 14px;
    }
    .scan-finding p {
      margin: 2px 0 0;
      color: var(--muted);
      font-size: 13px;
    }
    .scan-finding dl {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 12px;
      margin: 10px 0 0;
    }
    .scan-finding dl div {
      min-width: 0;
    }
    .scan-finding dt {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .scan-finding dd {
      margin: 2px 0 0;
      overflow-wrap: anywhere;
      font-size: 13px;
    }
    .pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .pill {
      background: var(--accent-soft);
      color: #115e59;
      border: 1px solid #99f6e4;
      border-radius: 999px;
      padding: 5px 10px;
      font-size: 13px;
    }
    .event {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 12px;
      padding: 14px 0;
      border-top: 1px solid var(--line);
    }
    .event:first-child { border-top: 0; }
    .event-index {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #e5e7eb;
      color: #374151;
      font-weight: 700;
      font-size: 13px;
    }
    .status-error .event-index {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .risk-high .event-index, .risk-critical .event-index {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .risk-medium .event-index {
      background: #fff7ed;
      color: #9a3412;
    }
    .event-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .event h3 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0;
    }
    .event p {
      margin: 3px 0 0;
      color: var(--muted);
      font-size: 12px;
    }
    .event-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .event-meta span {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .event-meta .risk-badge {
      color: #7a271a;
      border-color: #fecaca;
      background: #fff1f2;
    }
    .filters {
      padding: 16px 18px;
    }
    .filter-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .filter-header h2 {
      margin: 0;
    }
    #agentlens-filter-count {
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }
    .filter-controls {
      display: grid;
      grid-template-columns: minmax(220px, 1.5fr) repeat(3, minmax(140px, 1fr));
      gap: 10px;
    }
    .filter-controls label {
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
    }
    .filter-controls input, .filter-controls select {
      width: 100%;
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 7px 9px;
      color: var(--text);
      background: #fff;
      font: inherit;
      font-size: 13px;
    }
    .timeline-jumps {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 10px;
      margin-top: 12px;
    }
    .jump-link {
      display: grid;
      gap: 2px;
      min-height: 70px;
      padding: 10px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #f9fafb;
      color: var(--text);
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .jump-link:hover {
      border-color: #5eead4;
      background: #f0fdfa;
    }
    .jump-link span {
      color: var(--muted);
      font-size: 12px;
    }
    .jump-link strong {
      color: var(--accent);
      font-size: 13px;
    }
    .jump-link em {
      font-style: normal;
      font-size: 13px;
    }
    .event[hidden] {
      display: none;
    }
    .event-block {
      margin-top: 10px;
    }
    .block-label {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
    }
    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      border-radius: 6px;
      background: var(--code);
      color: #e5e7eb;
      font-size: 12px;
      line-height: 1.45;
    }
    footer {
      color: var(--muted);
      font-size: 12px;
      padding: 24px 0;
      text-align: center;
    }
    @media (max-width: 800px) {
      header { padding: 24px 18px; }
      main { width: min(100% - 20px, 1180px); }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .filter-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .timeline-jumps { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .event-header { flex-direction: column; }
      .event-meta { justify-content: flex-start; }
      .scan-finding dl { grid-template-columns: 1fr; }
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
      .filter-controls { grid-template-columns: 1fr; }
      .timeline-jumps { grid-template-columns: 1fr; }
      .event { grid-template-columns: 32px minmax(0, 1fr); }
    }
  </style>
</head>
<body>
  <header>
    <h1>AgentLens Report</h1>
    <p>${escapeHtml(trace.app)} / ${escapeHtml(trace.name)} / ${escapeHtml(trace.runId)}</p>
  </header>
  <main>
    ${
      hasSection(sections, "summary")
        ? `<section class="grid">
      ${renderCards(summary, scanReport)}
    </section>`
        : ""
    }
    ${
      hasSection(sections, "event-types")
        ? `<section class="section">
      <h2>Event Types</h2>
      <div class="pills">${renderTypeCounts(summary)}</div>
    </section>`
        : ""
    }
    ${hasSection(sections, "scan") ? renderScanSection(scanReport) : ""}
    ${hasSection(sections, "filters") ? renderFilters(trace) : ""}
    ${
      hasSection(sections, "timeline")
        ? `<section class="section">
      <h2>Timeline</h2>
      ${renderTimeline(trace)}
    </section>`
        : ""
    }
    <footer>Generated by AgentLens. Static report, no external assets.</footer>
  </main>
  ${hasSection(sections, "filters") && hasSection(sections, "timeline") ? renderFilterScript() : ""}
  ${renderLiveReload(options)}
</body>
</html>`;
}
