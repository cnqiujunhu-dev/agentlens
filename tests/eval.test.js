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

test("evaluateTrace enforces workflow counts", () => {
  const trace = baseTrace();
  addEvent(trace, { type: "chain.start", name: "refund-review" });
  addEvent(trace, { type: "chain.end", name: "refund-review" });
  addEvent(trace, { type: "agent.task.start", name: "research", metadata: { agent: "researcher" } });
  addEvent(trace, { type: "agent.task.end", name: "research", metadata: { agent: "researcher" } });

  const report = evaluateTrace(trace, {
    name: "workflow-policy",
    assertions: [
      { id: "has-chain", type: "min-workflow-chains", min: 2 },
      { id: "has-task", type: "min-workflow-tasks", min: 2 },
      { id: "no-workflow-errors", type: "max-workflow-errors", max: 0 }
    ]
  });

  assert.equal(report.passed, true);
  assert.deepEqual(report.results[0].details.workflow, { chains: 2, tasks: 2, errors: 0 });
});

test("evaluateTrace fails workflow count regressions", () => {
  const trace = baseTrace();
  addEvent(trace, { type: "chain.error", name: "refund-review", status: "error" });

  const report = evaluateTrace(trace, {
    name: "workflow-policy",
    assertions: [
      { id: "has-task", type: "min-workflow-tasks", min: 1 },
      { id: "no-workflow-errors", type: "max-workflow-errors", max: 0 }
    ]
  });

  assert.equal(report.passed, false);
  assert.match(report.results[0].message, /0 task events/);
  assert.match(report.results[1].message, /1 workflow errors/);
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

test("evaluateTrace enforces forbidden MCP tool risks", () => {
  const trace = createRun({ app: "eval-test", name: "mcp risk" });
  addEvent(trace, {
    type: "mcp.tools",
    name: "server",
    output: {
      tools: [{ name: "database.delete", risk: "critical" }]
    }
  });

  const report = evaluateTrace(trace, {
    name: "mcp-risk",
    assertions: [{ id: "risk", type: "forbidden-mcp-tool-risks", risks: ["critical"] }]
  });

  assert.equal(report.passed, false);
  assert.match(report.results[0].message, /Forbidden MCP tool risks/);
});

test("evaluateTrace allows reviewed MCP tool risk exceptions", () => {
  const trace = createRun({ app: "eval-test", name: "mcp reviewed risk" });
  addEvent(trace, {
    type: "mcp.tools",
    name: "database-server",
    metadata: { server: "database-server" },
    output: {
      tools: [{ name: "database.delete", risk: "critical" }]
    }
  });

  const report = evaluateTrace(trace, {
    name: "mcp-risk",
    assertions: [
      {
        id: "risk",
        type: "forbidden-mcp-tool-risks",
        risks: ["critical"],
        exceptions: [{ server: "database-server", tool: "database.delete", risk: "critical", reason: "reviewed in change request 42" }]
      }
    ]
  });

  assert.equal(report.passed, true);
  assert.equal(report.results[0].details.exceptions, 1);
});

test("evaluateTrace enforces reviewed MCP exception owners and expiry", () => {
  const trace = createRun({ app: "eval-test", name: "mcp reviewed risk governance" });
  addEvent(trace, {
    type: "mcp.tools",
    name: "database-server",
    metadata: { server: "database-server" },
    output: {
      tools: [{ name: "database.delete", risk: "critical" }]
    }
  });

  const report = evaluateTrace(trace, {
    name: "mcp-risk",
    assertions: [
      {
        id: "risk",
        type: "forbidden-mcp-tool-risks",
        risks: ["critical"],
        requireExceptionOwner: true,
        requireExceptionExpiry: true,
        exceptions: [{ server: "database-server", tool: "database.delete", risk: "critical", expiresAt: "2999-01-01T00:00:00.000Z" }]
      }
    ]
  });

  assert.equal(report.passed, false);
  assert.equal(report.results[0].details.exceptionIssues[0].issue, "missing owner");
});

test("evaluateTrace rejects expired MCP risk exceptions", () => {
  const trace = createRun({ app: "eval-test", name: "mcp expired risk" });
  addEvent(trace, {
    type: "tool.call",
    name: "database.delete",
    metadata: {
      server: "database-server",
      toolRisk: "critical"
    }
  });

  const report = evaluateTrace(trace, {
    name: "mcp-risk",
    assertions: [
      {
        id: "risk",
        type: "forbidden-mcp-tool-risks",
        risks: ["critical"],
        exceptions: [{ server: "database-server", tool: "database.delete", risk: "critical", owner: "platform", expiresAt: "2000-01-01T00:00:00.000Z" }]
      }
    ]
  });

  assert.equal(report.passed, false);
  assert.equal(report.results[0].details.exceptionIssues[0].issue, "expired");
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
