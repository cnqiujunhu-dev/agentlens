import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { renderDashboard } from "./dashboard.js";
import { readTrace } from "./store.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function send(res, status, body, contentType = "text/html; charset=utf-8") {
  res.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store"
  });
  res.end(body);
}

function listTraceFiles(root) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTraceFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }
  return files.sort((a, b) => a.localeCompare(b));
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function relativeUrlPath(root, file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function fileStat(file) {
  const stat = fs.statSync(file);
  return {
    mtimeMs: stat.mtimeMs,
    size: stat.size
  };
}

function statSignature(file) {
  const stat = fileStat(file);
  return `${stat.mtimeMs}:${stat.size}`;
}

function traceInfo(root, file) {
  const relative = relativeUrlPath(root, file);
  const stat = fileStat(file);
  const info = {
    path: relative,
    href: `/trace/${encodeURIComponent(relative)}`,
    apiHref: `/api/trace/${encodeURIComponent(relative)}`,
    statHref: `/api/stat/${encodeURIComponent(relative)}`,
    updatedAtMs: stat.mtimeMs,
    size: stat.size,
    valid: true
  };

  try {
    const trace = readTrace(file);
    return {
      ...info,
      runId: trace.runId,
      app: trace.app,
      name: trace.name,
      status: trace.status,
      events: trace.events?.length ?? 0
    };
  } catch (error) {
    return {
      ...info,
      valid: false,
      status: "invalid",
      error: error.message
    };
  }
}

function listTraceInfos(root) {
  return listTraceFiles(root).map((file) => traceInfo(root, file));
}

function runsSignature(files) {
  return files.map((file) => `${file.path}:${file.updatedAtMs}:${file.size}:${file.valid}`).join("|");
}

function renderIndexLiveReload(signature) {
  return `<script id="agentlens-index-live-reload">
    (() => {
      let signature = ${safeJson(signature)};
      function nextSignature(files) {
        return files.map((file) => [file.path, file.updatedAtMs, file.size, file.valid].join(":")).join("|");
      }
      async function poll() {
        try {
          const response = await fetch("/api/runs", { cache: "no-store" });
          if (!response.ok) return;
          const data = await response.json();
          const next = nextSignature(data.files || []);
          if (next !== signature) window.location.reload();
        } catch {}
      }
      window.setInterval(poll, 2000);
    })();
  </script>`;
}

function renderIndex({ root, files }) {
  const infos = files.map((file) => traceInfo(root, file));
  const items = infos
    .map((info) => {
      const label = info.valid ? `${info.name} (${info.app})` : info.path;
      return `<li><a href="${info.href}">${escapeHtml(label)}</a><span>${escapeHtml(info.status)}</span><code>${escapeHtml(info.path)}</code></li>`;
    })
    .join("");
  const signature = runsSignature(infos);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentLens Runs</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #17202a; }
    header { background: #101828; color: #fff; padding: 28px 36px; }
    main { width: min(980px, calc(100% - 32px)); margin: 24px auto; }
    h1 { margin: 0 0 6px; font-size: 28px; }
    p { margin: 0; color: #cbd5e1; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
    li { background: #fff; border: 1px solid #d9dee8; border-radius: 8px; padding: 14px 16px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px 16px; align-items: center; }
    a { color: #0f766e; font-weight: 700; text-decoration: none; overflow-wrap: anywhere; }
    span { color: #657184; font-size: 13px; }
    code { grid-column: 1 / -1; color: #657184; font-size: 12px; overflow-wrap: anywhere; }
    .empty { background: #fff; border: 1px solid #d9dee8; border-radius: 8px; padding: 18px; }
  </style>
</head>
<body>
  <header>
    <h1>AgentLens Runs</h1>
    <p>${escapeHtml(root)} · ${infos.length} trace file${infos.length === 1 ? "" : "s"}</p>
  </header>
  <main>
    ${infos.length > 0 ? `<ul>${items}</ul>` : `<div class="empty">No trace JSON files found.</div>`}
  </main>
  ${renderIndexLiveReload(signature)}
</body>
</html>`;
}

function resolveTracePath(root, encodedRelative) {
  const relative = decodeURIComponent(encodedRelative).replaceAll("/", path.sep);
  const resolved = path.resolve(root, relative);
  const resolvedRoot = path.resolve(root);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Trace path escapes served directory");
  }
  return resolved;
}

export function createDashboardServer(target = ".agentlens/runs") {
  const resolvedTarget = path.resolve(target);
  const isFile = fs.existsSync(resolvedTarget) && fs.statSync(resolvedTarget).isFile();
  const root = isFile ? path.dirname(resolvedTarget) : resolvedTarget;

  return http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");

    try {
      if (url.pathname === "/healthz") {
        send(res, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
        return;
      }

      if (isFile && url.pathname === "/api/trace") {
        send(res, 200, JSON.stringify(readTrace(resolvedTarget)), "application/json; charset=utf-8");
        return;
      }

      if (isFile && url.pathname === "/api/stat") {
        send(res, 200, JSON.stringify(fileStat(resolvedTarget)), "application/json; charset=utf-8");
        return;
      }

      if (!isFile && url.pathname === "/api/runs") {
        send(res, 200, JSON.stringify({ root, files: listTraceInfos(root) }), "application/json; charset=utf-8");
        return;
      }

      if (!isFile && url.pathname.startsWith("/api/trace/")) {
        const tracePath = resolveTracePath(root, url.pathname.slice("/api/trace/".length));
        send(res, 200, JSON.stringify(readTrace(tracePath)), "application/json; charset=utf-8");
        return;
      }

      if (!isFile && url.pathname.startsWith("/api/stat/")) {
        const tracePath = resolveTracePath(root, url.pathname.slice("/api/stat/".length));
        send(res, 200, JSON.stringify(fileStat(tracePath)), "application/json; charset=utf-8");
        return;
      }

      if (isFile && (url.pathname === "/" || url.pathname === "/trace")) {
        send(
          res,
          200,
          renderDashboard(readTrace(resolvedTarget), {
            liveReloadUrl: "/api/stat",
            liveReloadSignature: statSignature(resolvedTarget)
          })
        );
        return;
      }

      if (!isFile && url.pathname === "/") {
        send(res, 200, renderIndex({ root, files: listTraceFiles(root) }));
        return;
      }

      if (!isFile && url.pathname.startsWith("/trace/")) {
        const tracePath = resolveTracePath(root, url.pathname.slice("/trace/".length));
        const relative = relativeUrlPath(root, tracePath);
        send(
          res,
          200,
          renderDashboard(readTrace(tracePath), {
            liveReloadUrl: `/api/stat/${encodeURIComponent(relative)}`,
            liveReloadSignature: statSignature(tracePath)
          })
        );
        return;
      }

      send(res, 404, "Not found", "text/plain; charset=utf-8");
    } catch (error) {
      send(res, 500, error.message, "text/plain; charset=utf-8");
    }
  });
}

export function listen(server, { host = "127.0.0.1", port = 0 } = {}) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve(server.address());
    });
  });
}

export { listTraceFiles };
