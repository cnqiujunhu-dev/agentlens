import test from "node:test";
import assert from "node:assert/strict";
import { evaluateTrace } from "../src/eval.js";
import { addEvent, createRun, finishRun } from "../src/trace.js";

function baseTrace() {
  const run = createRun({ app: "unit-agent", name: "eval test" });
  addEvent(run, { type: "llm.prompt", name: "answer" });
  addEvent(run, {
    type: "llm.response",
    name: "answer",
    usage: { costUsd: 0.01 },
    output: { content: "Answer with source.", citations: ["doc-1"] }
  });
  return finishRun(run, "passed");
}

test("evaluateTrace passes a healthy trace", () => {
  const report = evaluateTrace(baseTrace(), {
    name: "unit",
    assertions: [
      { id: "has-events", type: "required-event-types", eventTypes: ["llm.prompt", "llm.response"] },
      { id: "citations", type: "required-citations", min: 1 },
      { id: "cost", type: "max-total-cost-usd", max: 0.05 }
    ]
  });

  assert.equal(report.passed, true);
  assert.equal(report.results.length, 3);
});

test("evaluateTrace fails forbidden tool calls", () => {
  const trace = baseTrace();
  addEvent(trace, { type: "tool.call", name: "delete_database", input: { table: "users" } });

  const report = evaluateTrace(trace, {
    name: "unit",
    assertions: [{ id: "no-delete", type: "forbidden-tools", tools: ["delete_database"] }]
  });

  assert.equal(report.passed, false);
  assert.equal(report.results[0].id, "no-delete");
  assert.match(report.results[0].message, /Forbidden tools/);
});

test("evaluateTrace fails missing citations", () => {
  const trace = createRun({ app: "unit-agent", name: "missing citation" });
  addEvent(trace, { type: "llm.response", name: "answer", output: { content: "Uncited answer." } });
  finishRun(trace, "passed");

  const report = evaluateTrace(trace, {
    name: "unit",
    assertions: [{ id: "citation-required", type: "required-citations", min: 1 }]
  });

  assert.equal(report.passed, false);
  assert.match(report.results[0].message, /0 citations/);
});

test("evaluateTrace fails over budget cost", () => {
  const report = evaluateTrace(baseTrace(), {
    name: "unit",
    assertions: [{ id: "cost", type: "max-total-cost-usd", max: 0.001 }]
  });

  assert.equal(report.passed, false);
  assert.match(report.results[0].message, /exceeded/);
});

test("evaluateTrace enforces MCP server allowlists", () => {
  const trace = baseTrace();
  addEvent(trace, {
    type: "tool.call",
    name: "policy.lookup",
    metadata: {
      adapter: "mcp",
      protocol: "mcp",
      server: "unknown-server",
      permission: "read-only"
    }
  });

  const report = evaluateTrace(trace, {
    name: "mcp-policy",
    assertions: [{ id: "allowlist", type: "allowed-mcp-servers", servers: ["local-policy-server"] }]
  });

  assert.equal(report.passed, false);
  assert.match(report.results[0].message, /allowlist/);
});

test("evaluateTrace enforces forbidden tool permissions", () => {
  const trace = baseTrace();
  addEvent(trace, {
    type: "tool.call",
    name: "customer.delete",
    metadata: {
      permission: "write"
    }
  });

  const report = evaluateTrace(trace, {
    name: "permission-policy",
    assertions: [{ id: "no-write", type: "forbidden-tool-permissions", permissions: ["write"] }]
  });

  assert.equal(report.passed, false);
  assert.match(report.results[0].message, /Forbidden tool permissions/);
});

test("evaluateTrace enforces required tool metadata", () => {
  const trace = baseTrace();
  addEvent(trace, {
    type: "tool.call",
    name: "policy.lookup",
    metadata: {
      adapter: "mcp"
    }
  });

  const report = evaluateTrace(trace, {
    name: "metadata-policy",
    assertions: [{ id: "metadata", type: "required-tool-metadata", keys: ["adapter", "server"] }]
  });

  assert.equal(report.passed, false);
  assert.deepEqual(report.results[0].details.violations[0].missing, ["server"]);
});
