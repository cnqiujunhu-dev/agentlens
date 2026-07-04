import test from "node:test";
import assert from "node:assert/strict";
import { renderDashboard } from "../src/dashboard.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

test("renderDashboard escapes user-controlled trace content", () => {
  const trace = createRun({
    app: "<script>alert('app')</script>",
    name: "dashboard escaping"
  });

  addEvent(trace, {
    type: "llm.response",
    name: "<img src=x onerror=alert(1)>",
    output: {
      content: "<script>alert('content')</script>",
      citations: ["doc-1"]
    }
  });
  finishRun(trace, "passed");

  const html = renderDashboard(trace);

  assert.equal(html.includes("<script>alert('app')</script>"), false);
  assert.equal(html.includes("<script>alert('content')</script>"), false);
  assert.equal(html.includes("<img src=x onerror=alert(1)>"), false);
  assert.ok(html.includes("&lt;script&gt;alert(&#39;content&#39;)&lt;/script&gt;"));
});

test("renderDashboard includes timeline filters and MCP risk metadata", () => {
  const trace = createRun({
    app: "dashboard-test",
    name: "filters"
  });

  addEvent(trace, {
    type: "tool.call",
    name: "database.delete",
    status: "ok",
    metadata: {
      server: "database-server",
      permission: "destructive",
      toolRisk: "critical"
    },
    input: {
      table: "customers"
    }
  });
  finishRun(trace, "passed");

  const html = renderDashboard(trace);

  assert.match(html, /agentlens-dashboard-filters/);
  assert.match(html, /agentlens-filter-search/);
  assert.match(html, /data-event-type="tool\.call"/);
  assert.match(html, /data-event-risk="critical"/);
  assert.match(html, /critical risk/);
});
