import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDashboardSections, renderDashboard } from "../src/dashboard.js";
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
  assert.match(html, /agentlens-copy-filter-link/);
  assert.match(html, /Copy view link/);
  assert.match(html, /#agentlens-filter\?/);
  assert.match(html, /parseFilterHash/);
  assert.match(html, /currentViewUrl/);
  assert.match(html, /navigator\.clipboard/);
  assert.match(html, /hashchange/);
  assert.match(html, /data-event-type="tool\.call"/);
  assert.match(html, /data-event-risk="critical"/);
  assert.match(html, /critical risk/);
});

test("renderDashboard includes security scan findings", () => {
  const trace = createRun({
    app: "dashboard-test",
    name: "scan panel",
    metadata: {
      apiKey: "plain-secret-value"
    }
  });
  addEvent(trace, { type: "llm.response", name: "final", output: { content: "ok" } });
  finishRun(trace, "passed");

  const html = renderDashboard(trace);

  assert.match(html, /Security Scan/);
  assert.match(html, /sensitive-key/);
  assert.match(html, /metadata\.apiKey/);
  assert.match(html, /\[REDACTED\]/);
  assert.doesNotMatch(html, /plain-secret-value/);
});

test("renderDashboard includes timeline jump anchors", () => {
  const trace = createRun({
    app: "dashboard-test",
    name: "timeline jumps"
  });
  addEvent(trace, { type: "llm.prompt", name: "planner" });
  addEvent(trace, {
    type: "tool.call",
    name: "database.delete",
    metadata: {
      toolRisk: "high"
    }
  });
  addEvent(trace, { type: "llm.response", name: "final", status: "error", output: { content: "failed" } });
  finishRun(trace, "failed");

  const html = renderDashboard(trace);

  assert.match(html, /aria-label="Timeline jumps"/);
  assert.match(html, /First error/);
  assert.match(html, /First high risk/);
  assert.match(html, /First tool call/);
  assert.match(html, /Final response/);
  assert.match(html, /Last event/);
  assert.match(html, /href="#agentlens-event-2"/);
  assert.match(html, /id="agentlens-event-2"/);
  assert.match(html, /href="#agentlens-event-3"/);
  assert.match(html, /id="agentlens-event-3"/);
});

test("renderDashboard groups repeated tool calls", () => {
  const trace = createRun({
    app: "dashboard-test",
    name: "tool groups"
  });
  addEvent(trace, {
    type: "tool.call",
    name: "kb.search",
    durationMs: 12,
    metadata: {
      server: "kb-server",
      permission: "read-only",
      toolRisk: "low"
    }
  });
  addEvent(trace, {
    type: "tool.call",
    name: "database.delete",
    status: "error",
    durationMs: 50,
    metadata: {
      server: "database-server",
      permission: "destructive",
      toolRisk: "critical"
    }
  });
  addEvent(trace, {
    type: "tool.call",
    name: "database.delete",
    durationMs: 150,
    metadata: {
      server: "database-server",
      permission: "destructive",
      toolRisk: "critical"
    }
  });
  finishRun(trace, "failed");

  const html = renderDashboard(trace);

  assert.match(html, /Tool Calls/);
  assert.match(html, /3 calls \/ 2 tools/);
  assert.match(html, /database\.delete/);
  assert.match(html, /data-tool-filter="database\.delete"/);
  assert.match(html, /Filter timeline/);
  assert.match(html, /2 calls/);
  assert.match(html, /critical/);
  assert.match(html, /destructive/);
  assert.match(html, /100ms/);
  assert.match(html, /150ms/);
  assert.match(html, /href="#agentlens-event-2"/);
  assert.match(html, /href="#agentlens-event-3"/);
  assert.match(html, /kb\.search/);
  assert.match(html, /read-only/);
  assert.match(html, /button\.dataset\.toolFilter/);
  assert.match(html, /type\.value = "tool\.call"/);
});

test("renderDashboard includes workflow review for chain, task, and error events", () => {
  const trace = createRun({
    app: "dashboard-test",
    name: "workflow review"
  });
  addEvent(trace, {
    type: "chain.start",
    name: "RunnableSequence",
    input: { question: "Can I refund a damaged item?" },
    metadata: { framework: "langchain" }
  });
  addEvent(trace, {
    type: "chain.end",
    name: "RunnableSequence",
    durationMs: 42,
    output: { answer: "use policy lookup" },
    metadata: { framework: "langchain" }
  });
  addEvent(trace, {
    type: "agent.task.start",
    name: "draft-answer",
    input: { citation: "policy-refund-30d" },
    metadata: { framework: "crewai", agent: "support_writer", workflow: "refund-review" }
  });
  addEvent(trace, {
    type: "agent.task.end",
    name: "draft-answer",
    status: "error",
    durationMs: 21,
    output: { message: "missing required citation", type: "AssertionError" },
    metadata: { framework: "crewai", agent: "support_writer", workflow: "refund-review" }
  });
  addEvent(trace, {
    type: "error",
    name: "crewai.support_writer.draft-answer",
    status: "error",
    output: { message: "missing required citation", type: "AssertionError" },
    metadata: { framework: "crewai", agent: "support_writer" }
  });
  finishRun(trace, "failed");

  const html = renderDashboard(trace);

  assert.match(html, /Workflow Review/);
  assert.match(html, /id="agentlens-workflow-review"/);
  assert.match(html, /2 chains \/ 2 tasks \/ 2 errors/);
  assert.match(html, /RunnableSequence/);
  assert.match(html, /draft-answer/);
  assert.match(html, /agent: support_writer/);
  assert.match(html, /error: missing required citation/);
  assert.match(html, /href="#agentlens-event-4"/);
  assert.match(html, /href="#agentlens-event-5"/);
});

test("renderDashboard can render selected sections only", () => {
  const trace = createRun({
    app: "dashboard-test",
    name: "sections"
  });
  addEvent(trace, { type: "llm.response", name: "final", output: { content: "ok" } });
  finishRun(trace, "passed");

  const html = renderDashboard(trace, { sections: ["summary", "timeline"] });

  assert.match(html, /Timeline/);
  assert.match(html, /Status/);
  assert.doesNotMatch(html, /Security Scan/);
  assert.doesNotMatch(html, /Timeline Filters/);
  assert.doesNotMatch(html, /agentlens-dashboard-filters/);
  assert.doesNotMatch(html, /Event Types/);
  assert.doesNotMatch(html, /Tool Calls/);
  assert.doesNotMatch(html, /Workflow Review/);
});

test("normalizeDashboardSections validates section names", () => {
  assert.deepEqual(normalizeDashboardSections("summary,workflow,scan,timeline"), ["summary", "workflow", "scan", "timeline"]);
  assert.throws(() => normalizeDashboardSections("summary,unknown"), /Unknown dashboard section/);
});
