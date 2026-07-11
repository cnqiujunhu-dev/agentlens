import { summarizeTrace } from "./inspect.js";
import { scanTrace } from "./scan.js";

export const DEFAULT_DASHBOARD_SECTIONS = ["summary", "event-types", "scan", "tool-calls", "workflow", "filters", "timeline"];

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

function uniqueList(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))].sort((a, b) => a.localeCompare(b));
}

function formatList(values) {
  return values.length > 0 ? values.join(", ") : "none";
}

function formatMs(value) {
  return Number.isFinite(value) ? `${Math.round(value)}ms` : "n/a";
}

function topRisk(risks) {
  const rank = { critical: 4, high: 3, medium: 2, low: 1 };
  return risks.sort((a, b) => (rank[b] ?? 0) - (rank[a] ?? 0))[0] ?? "none";
}

function summarizeToolCallGroups(trace) {
  const groups = new Map();
  trace.events.forEach((event, index) => {
    if (event.type !== "tool.call") return;
    const tool = event.name || "(unnamed tool)";
    if (!groups.has(tool)) {
      groups.set(tool, {
        tool,
        count: 0,
        errors: 0,
        highRisk: 0,
        durations: [],
        servers: [],
        permissions: [],
        risks: [],
        firstIndex: index,
        lastIndex: index
      });
    }

    const group = groups.get(tool);
    const risk = String(event.metadata?.toolRisk ?? "").toLowerCase();
    group.count += 1;
    group.errors += event.status === "error" ? 1 : 0;
    group.highRisk += risk === "high" || risk === "critical" ? 1 : 0;
    if (typeof event.durationMs === "number") group.durations.push(event.durationMs);
    group.servers.push(event.metadata?.server);
    group.permissions.push(event.metadata?.permission);
    group.risks.push(event.metadata?.toolRisk);
    group.lastIndex = index;
  });

  return [...groups.values()]
    .map((group) => {
      const maxDuration = group.durations.length > 0 ? Math.max(...group.durations) : Number.NaN;
      const avgDuration = group.durations.length > 0 ? group.durations.reduce((sum, value) => sum + value, 0) / group.durations.length : Number.NaN;
      const risks = uniqueList(group.risks);
      return {
        ...group,
        servers: uniqueList(group.servers),
        permissions: uniqueList(group.permissions),
        risks,
        topRisk: topRisk(risks),
        avgDuration,
        maxDuration
      };
    })
    .sort((a, b) => b.highRisk - a.highRisk || b.errors - a.errors || b.count - a.count || a.tool.localeCompare(b.tool));
}

function renderToolCallGroup(group) {
  return `
    <details class="tool-call-group risk-${escapeHtml(group.topRisk)}" open>
      <summary>
        <span class="tool-call-name">${escapeHtml(group.tool)}</span>
        <span class="tool-call-count">${group.count} call${group.count === 1 ? "" : "s"}</span>
      </summary>
      <dl class="tool-call-stats">
        <div><dt>Errors</dt><dd>${group.errors}</dd></div>
        <div><dt>High risk</dt><dd>${group.highRisk}</dd></div>
        <div><dt>Avg duration</dt><dd>${formatMs(group.avgDuration)}</dd></div>
        <div><dt>Max duration</dt><dd>${formatMs(group.maxDuration)}</dd></div>
        <div><dt>Servers</dt><dd>${escapeHtml(formatList(group.servers))}</dd></div>
        <div><dt>Permissions</dt><dd>${escapeHtml(formatList(group.permissions))}</dd></div>
        <div><dt>Risks</dt><dd>${escapeHtml(formatList(group.risks))}</dd></div>
      </dl>
      <div class="tool-call-links">
        <button type="button" class="tool-call-filter" data-tool-filter="${escapeHtml(group.tool)}">Filter timeline</button>
        <a href="#${eventAnchor(group.firstIndex)}">First #${group.firstIndex + 1}</a>
        <a href="#${eventAnchor(group.lastIndex)}">Last #${group.lastIndex + 1}</a>
      </div>
    </details>
  `;
}

function renderToolCallsSection(trace) {
  const groups = summarizeToolCallGroups(trace);
  const calls = groups.reduce((sum, group) => sum + group.count, 0);
  return `
    <section class="section tool-calls-section">
      <div class="section-title">
        <h2>Tool Calls</h2>
        <span class="section-badge">${calls} calls / ${groups.length} tools</span>
      </div>
      <p class="section-note">Grouped by tool name with risk, latency, and first/last timeline links.</p>
      ${
        groups.length > 0
          ? `<div class="tool-call-groups">${groups.map((group) => renderToolCallGroup(group)).join("")}</div>`
          : `<p class="empty-state">No tool calls recorded.</p>`
      }
    </section>
  `;
}

function workflowKind(event) {
  const type = String(event.type ?? "");
  if (type.startsWith("agent.task.")) return "task";
  if (type.startsWith("chain.")) return "chain";
  if (isWorkflowError(event)) return "error";
  return null;
}

function isWorkflowError(event) {
  const type = String(event.type ?? "");
  return type === "error" || event.status === "error" || type.endsWith(".error");
}

function workflowLabel(item) {
  if (item.kind === "error") return "Error";
  if (item.kind === "task") return "Task";
  if (item.kind === "chain") return "Chain";
  return "Event";
}

function workflowDetail(event) {
  const agent = event.metadata?.agent;
  const framework = event.metadata?.framework;
  const workflow = event.metadata?.workflow;
  const error = event.output?.message ?? event.output?.error ?? event.error ?? event.message;
  return [agent && `agent: ${agent}`, framework && `framework: ${framework}`, workflow && `workflow: ${workflow}`, error && `error: ${error}`]
    .filter(Boolean)
    .join(" / ");
}

function summarizeWorkflowEvents(trace) {
  const items = trace.events
    .map((event, index) => ({ event, index, kind: workflowKind(event) }))
    .filter((item) => item.kind);
  const counts = {
    chains: items.filter((item) => String(item.event.type ?? "").startsWith("chain.")).length,
    tasks: items.filter((item) => String(item.event.type ?? "").startsWith("agent.task.")).length,
    errors: items.filter((item) => isWorkflowError(item.event)).length
  };
  return { items, counts };
}

function renderWorkflowEvent(item) {
  const { event, index, kind } = item;
  const status = event.status ?? "ok";
  const detail = workflowDetail(event);
  return `
    <article class="workflow-event workflow-${escapeHtml(kind)} status-${escapeHtml(status)}">
      <div>
        <span class="workflow-kind">${escapeHtml(workflowLabel(item))}</span>
        <h3>${escapeHtml(eventTitle(event) || event.type)}</h3>
        ${detail ? `<p>${escapeHtml(detail)}</p>` : ""}
      </div>
      <div class="workflow-meta">
        <span>${escapeHtml(status)}</span>
        ${typeof event.durationMs === "number" ? `<span>${escapeHtml(formatMs(event.durationMs))}</span>` : ""}
        <a href="#${eventAnchor(index)}">#${index + 1}</a>
      </div>
    </article>
  `;
}

function renderWorkflowSection(trace) {
  const { items, counts } = summarizeWorkflowEvents(trace);
  return `
    <section class="section workflow-section">
      <div class="section-title">
        <h2>Workflow Review</h2>
        <span class="section-badge">${counts.chains} chains / ${counts.tasks} tasks / ${counts.errors} errors</span>
      </div>
      <p class="section-note">Chain, agent task, and error events with direct links back to the timeline.</p>
      ${
        items.length > 0
          ? `<div class="workflow-events">${items.map((item) => renderWorkflowEvent(item)).join("")}</div>`
          : `<p class="empty-state">No chain, task, or error events recorded.</p>`
      }
    </section>
  `;
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
        <div class="filter-actions">
          <span id="agentlens-filter-count">${trace.events.length} events</span>
          <button id="agentlens-copy-filter-link" type="button">Copy view link</button>
        </div>
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
      const copyLink = document.getElementById("agentlens-copy-filter-link");
      const toolFilters = Array.from(document.querySelectorAll("[data-tool-filter]"));
      if (!search || !type || !status || !risk || !count) return;
      const hashPrefix = "#agentlens-filter?";

      function selectValue(control, value) {
        control.value = Array.from(control.options).some((option) => option.value === value) ? value : "";
      }

      function filterState() {
        return {
          q: search.value.trim(),
          type: type.value,
          status: status.value,
          risk: risk.value
        };
      }

      function filterHash() {
        const params = new URLSearchParams();
        const state = filterState();
        if (state.q) params.set("q", state.q);
        if (state.type) params.set("type", state.type);
        if (state.status) params.set("status", state.status);
        if (state.risk) params.set("risk", state.risk);
        const encoded = params.toString();
        return encoded ? hashPrefix + encoded : "";
      }

      function currentViewUrl() {
        const url = new URL(window.location.href);
        const hash = filterHash();
        url.hash = hash ? hash.slice(1) : "";
        return url.toString();
      }

      function syncHash() {
        const nextHash = filterHash();
        if (nextHash) {
          window.history.replaceState(null, "", nextHash);
        } else if (window.location.hash.startsWith(hashPrefix)) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }

      function parseFilterHash() {
        if (!window.location.hash.startsWith(hashPrefix)) return null;
        const params = new URLSearchParams(window.location.hash.slice(hashPrefix.length));
        return {
          q: params.get("q") || "",
          type: params.get("type") || "",
          status: params.get("status") || "",
          risk: params.get("risk") || ""
        };
      }

      function restoreFilterHash() {
        const state = parseFilterHash();
        if (!state) return false;
        search.value = state.q;
        selectValue(type, state.type);
        selectValue(status, state.status);
        selectValue(risk, state.risk);
        return true;
      }

      function applyFilters({ updateHash = true } = {}) {
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
        if (updateHash) syncHash();
      }

      async function copyCurrentViewLink() {
        if (!copyLink) return;
        const url = currentViewUrl();
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(url);
          } else {
            const textarea = document.createElement("textarea");
            textarea.value = url;
            textarea.setAttribute("readonly", "");
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
          }
          copyLink.textContent = "Copied";
        } catch {
          copyLink.textContent = "Copy failed";
        } finally {
          window.setTimeout(() => {
            copyLink.textContent = "Copy view link";
          }, 1600);
        }
      }

      for (const control of [search, type, status, risk]) {
        control.addEventListener("input", applyFilters);
        control.addEventListener("change", applyFilters);
      }
      copyLink?.addEventListener("click", copyCurrentViewLink);
      for (const button of toolFilters) {
        button.addEventListener("click", () => {
          search.value = button.dataset.toolFilter || "";
          type.value = "tool.call";
          status.value = "";
          risk.value = "";
          applyFilters();
          document.querySelector("[data-agentlens-filters]")?.scrollIntoView({ block: "start" });
        });
      }
      window.addEventListener("hashchange", () => {
        if (restoreFilterHash()) applyFilters({ updateHash: false });
      });
      restoreFilterHash();
      applyFilters({ updateHash: false });
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
    .scan-status, .severity-badge, .section-badge {
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
    .filter-actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    #agentlens-copy-filter-link {
      min-height: 30px;
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 4px 10px;
      color: var(--accent);
      background: #fff;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 700;
    }
    #agentlens-copy-filter-link:hover {
      border-color: #5eead4;
      background: #f0fdfa;
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
    .section-badge {
      color: var(--muted);
      background: #f9fafb;
    }
    .tool-call-groups {
      display: grid;
      gap: 10px;
    }
    .tool-call-group {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #f9fafb;
      overflow: hidden;
    }
    .tool-call-group[open] {
      background: #fff;
    }
    .tool-call-group summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      cursor: pointer;
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .tool-call-name {
      min-width: 0;
    }
    .tool-call-count {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }
    .tool-call-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px 12px;
      margin: 0;
      padding: 0 14px 12px;
    }
    .tool-call-stats div {
      min-width: 0;
    }
    .tool-call-stats dt {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .tool-call-stats dd {
      margin: 2px 0 0;
      font-size: 13px;
      overflow-wrap: anywhere;
    }
    .tool-call-links {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      padding: 0 14px 14px;
    }
    .tool-call-links a, .tool-call-filter {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 3px 9px;
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      text-decoration: none;
    }
    .tool-call-filter {
      background: #fff;
      cursor: pointer;
      font: inherit;
    }
    .tool-call-links a:hover, .tool-call-filter:hover {
      border-color: #5eead4;
      background: #f0fdfa;
    }
    .tool-call-group.risk-high, .tool-call-group.risk-critical {
      border-color: #fecaca;
    }
    .workflow-events {
      display: grid;
      gap: 10px;
    }
    .workflow-event {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px 14px;
      background: #f9fafb;
    }
    .workflow-event.status-error {
      border-color: #fecaca;
      background: #fff7f7;
    }
    .workflow-event h3 {
      margin: 4px 0 0;
      font-size: 14px;
      overflow-wrap: anywhere;
    }
    .workflow-event p {
      margin: 4px 0 0;
      color: var(--muted);
      font-size: 12px;
      overflow-wrap: anywhere;
    }
    .workflow-kind {
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .workflow-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .workflow-meta span, .workflow-meta a {
      border: 1px solid var(--line);
      border-radius: 999px;
      padding: 2px 8px;
      color: var(--muted);
      background: #fff;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
      text-decoration: none;
    }
    .workflow-meta a {
      color: var(--accent);
    }
    .workflow-meta a:hover {
      border-color: #5eead4;
      background: #f0fdfa;
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
      .tool-call-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .workflow-event { grid-template-columns: 1fr; }
      .workflow-meta { justify-content: flex-start; }
      .event-header { flex-direction: column; }
      .event-meta { justify-content: flex-start; }
      .scan-finding dl { grid-template-columns: 1fr; }
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
      .filter-controls { grid-template-columns: 1fr; }
      .timeline-jumps { grid-template-columns: 1fr; }
      .tool-call-stats { grid-template-columns: 1fr; }
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
    ${hasSection(sections, "tool-calls") ? renderToolCallsSection(trace) : ""}
    ${hasSection(sections, "workflow") ? renderWorkflowSection(trace) : ""}
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
