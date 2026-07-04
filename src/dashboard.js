import { summarizeTrace } from "./inspect.js";

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

function renderCards(summary) {
  const cards = [
    ["Status", summary.status],
    ["Events", summary.eventCount],
    ["Wall time", `${summary.wallTimeMs ?? "unknown"} ms`],
    ["Known duration", `${summary.totalKnownDurationMs} ms`],
    ["LLM tokens", summary.totalLlmTokens],
    ["Cost", `$${summary.totalCostUsd.toFixed(4)}`],
    ["Errors", summary.errors],
    ["Tools", summary.tools.length]
  ];

  return cards
    .map(([label, value]) => `<div class="card"><div class="card-label">${escapeHtml(label)}</div><div class="card-value">${escapeHtml(value)}</div></div>`)
    .join("");
}

function renderTypeCounts(summary) {
  return Object.entries(summary.byType)
    .map(([type, count]) => `<span class="pill">${escapeHtml(type)} <strong>${count}</strong></span>`)
    .join("");
}

function renderTimeline(trace) {
  return trace.events
    .map((event, index) => {
      const status = event.status ?? "ok";
      const duration = typeof event.durationMs === "number" ? `${event.durationMs}ms` : "";
      return `
        <article class="event event-${escapeHtml(event.type.replaceAll(".", "-"))} status-${escapeHtml(status)}">
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

export function renderDashboard(trace, options = {}) {
  const summary = summarizeTrace(trace);

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
      .event-header { flex-direction: column; }
      .event-meta { justify-content: flex-start; }
    }
    @media (max-width: 520px) {
      .grid { grid-template-columns: 1fr; }
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
    <section class="grid">
      ${renderCards(summary)}
    </section>
    <section class="section">
      <h2>Event Types</h2>
      <div class="pills">${renderTypeCounts(summary)}</div>
    </section>
    <section class="section">
      <h2>Timeline</h2>
      ${renderTimeline(trace)}
    </section>
    <footer>Generated by AgentLens. Static report, no external assets.</footer>
  </main>
  ${renderLiveReload(options)}
</body>
</html>`;
}
