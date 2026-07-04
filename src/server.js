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

function renderIndex({ root, files }) {
  const items = files
    .map((file) => {
      const relative = path.relative(root, file);
      const href = `/trace/${encodeURIComponent(relative.replaceAll(path.sep, "/"))}`;
      let label = relative;
      let status = "";
      try {
        const trace = readTrace(file);
        label = `${trace.name} (${trace.app})`;
        status = trace.status;
      } catch {
        status = "invalid";
      }
      return `<li><a href="${href}">${escapeHtml(label)}</a><span>${escapeHtml(status)}</span><code>${escapeHtml(relative)}</code></li>`;
    })
    .join("");

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
    <p>${escapeHtml(root)} · ${files.length} trace file${files.length === 1 ? "" : "s"}</p>
  </header>
  <main>
    ${files.length > 0 ? `<ul>${items}</ul>` : `<div class="empty">No trace JSON files found.</div>`}
  </main>
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

      if (isFile && (url.pathname === "/" || url.pathname === "/trace")) {
        send(res, 200, renderDashboard(readTrace(resolvedTarget)));
        return;
      }

      if (!isFile && url.pathname === "/") {
        send(res, 200, renderIndex({ root, files: listTraceFiles(root) }));
        return;
      }

      if (!isFile && url.pathname.startsWith("/trace/")) {
        const tracePath = resolveTracePath(root, url.pathname.slice("/trace/".length));
        send(res, 200, renderDashboard(readTrace(tracePath)));
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
