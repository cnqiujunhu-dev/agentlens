import fs from "node:fs";
import { readJson } from "./store.js";

export const DEFAULT_EVAL_CONFIG = {
  version: "agentlens.eval.v1",
  name: "default",
  assertions: [
    { id: "has-core-events", type: "required-event-types", eventTypes: ["llm.prompt", "llm.response"] },
    { id: "no-errors", type: "max-errors", max: 0 }
  ]
};

export function loadEvalConfig(configPath) {
  if (!configPath || !fs.existsSync(configPath)) return DEFAULT_EVAL_CONFIG;
  return readJson(configPath);
}

function eventCountByType(trace) {
  const counts = new Map();
  for (const event of trace.events) {
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  }
  return counts;
}

function countErrors(trace) {
  return trace.events.filter((event) => event.type === "error" || event.status === "error").length;
}

function totalCostUsd(trace) {
  return trace.events.reduce((sum, event) => sum + (event.usage?.costUsd ?? event.costUsd ?? 0), 0);
}

function finalResponse(trace) {
  return [...trace.events].reverse().find((event) => event.type === "llm.response" && event.output?.content);
}

function pass(assertion, message, details = {}) {
  return { id: assertion.id ?? assertion.type, type: assertion.type, passed: true, message, details };
}

function fail(assertion, message, details = {}) {
  return { id: assertion.id ?? assertion.type, type: assertion.type, passed: false, message, details };
}

function runAssertion(trace, assertion) {
  if (assertion.type === "required-event-types") {
    const counts = eventCountByType(trace);
    const missing = (assertion.eventTypes ?? []).filter((type) => !counts.has(type));
    if (missing.length > 0) {
      return fail(assertion, `Missing event types: ${missing.join(", ")}`, { missing });
    }
    return pass(assertion, "All required event types are present");
  }

  if (assertion.type === "max-errors") {
    const errors = countErrors(trace);
    if (errors > assertion.max) return fail(assertion, `Found ${errors} errors, max is ${assertion.max}`, { errors });
    return pass(assertion, `Found ${errors} errors`);
  }

  if (assertion.type === "forbidden-tools") {
    const forbidden = new Set((assertion.tools ?? []).map((tool) => tool.toLowerCase()));
    const violations = trace.events
      .filter((event) => event.type === "tool.call")
      .filter((event) => forbidden.has(String(event.name ?? "").toLowerCase()))
      .map((event) => event.name);

    if (violations.length > 0) {
      return fail(assertion, `Forbidden tools called: ${violations.join(", ")}`, { violations });
    }
    return pass(assertion, "No forbidden tools were called");
  }

  if (assertion.type === "allowed-mcp-servers") {
    const allowed = new Set((assertion.servers ?? []).map((server) => server.toLowerCase()));
    const violations = trace.events
      .filter((event) => event.type === "tool.call")
      .filter((event) => event.metadata?.adapter === "mcp" || event.metadata?.protocol === "mcp")
      .filter((event) => !allowed.has(String(event.metadata?.server ?? "").toLowerCase()))
      .map((event) => ({ tool: event.name, server: event.metadata?.server ?? null }));

    if (violations.length > 0) {
      return fail(assertion, `MCP server allowlist violations: ${violations.map((item) => item.server ?? "missing").join(", ")}`, { violations });
    }
    return pass(assertion, "All MCP tool calls used allowed servers");
  }

  if (assertion.type === "forbidden-tool-permissions") {
    const forbidden = new Set((assertion.permissions ?? []).map((permission) => permission.toLowerCase()));
    const violations = trace.events
      .filter((event) => event.type === "tool.call")
      .filter((event) => forbidden.has(String(event.metadata?.permission ?? "").toLowerCase()))
      .map((event) => ({ tool: event.name, permission: event.metadata?.permission ?? null }));

    if (violations.length > 0) {
      return fail(assertion, `Forbidden tool permissions used: ${violations.map((item) => `${item.tool}:${item.permission}`).join(", ")}`, { violations });
    }
    return pass(assertion, "No forbidden tool permissions were used");
  }

  if (assertion.type === "forbidden-mcp-tool-risks") {
    const forbidden = new Set((assertion.risks ?? []).map((risk) => risk.toLowerCase()));
    const callViolations = trace.events
      .filter((event) => event.type === "tool.call")
      .filter((event) => forbidden.has(String(event.metadata?.toolRisk ?? "").toLowerCase()))
      .map((event) => ({ tool: event.name, risk: event.metadata?.toolRisk ?? null }));
    const manifestViolations = trace.events
      .filter((event) => event.type === "mcp.tools")
      .flatMap((event) => event.output?.tools ?? [])
      .filter((tool) => forbidden.has(String(tool.risk ?? "").toLowerCase()))
      .map((tool) => ({ tool: tool.name, risk: tool.risk ?? null }));
    const violations = [...callViolations, ...manifestViolations];

    if (violations.length > 0) {
      return fail(assertion, `Forbidden MCP tool risks found: ${violations.map((item) => `${item.tool}:${item.risk}`).join(", ")}`, { violations });
    }
    return pass(assertion, "No forbidden MCP tool risks were found");
  }

  if (assertion.type === "required-tool-metadata") {
    const keys = assertion.keys ?? [];
    const violations = trace.events
      .filter((event) => event.type === "tool.call")
      .filter((event) => keys.some((key) => event.metadata?.[key] === undefined || event.metadata?.[key] === null || event.metadata?.[key] === ""))
      .map((event) => ({
        tool: event.name,
        missing: keys.filter((key) => event.metadata?.[key] === undefined || event.metadata?.[key] === null || event.metadata?.[key] === "")
      }));

    if (violations.length > 0) {
      return fail(assertion, `Tool calls are missing required metadata`, { violations });
    }
    return pass(assertion, "All tool calls include required metadata");
  }

  if (assertion.type === "max-tool-duration-ms") {
    const slow = trace.events
      .filter((event) => event.type === "tool.result" && typeof event.durationMs === "number")
      .filter((event) => event.durationMs > assertion.max)
      .map((event) => ({ name: event.name, durationMs: event.durationMs }));

    if (slow.length > 0) {
      return fail(assertion, `Tool latency exceeded ${assertion.max}ms`, { slow });
    }
    return pass(assertion, `All tool results are within ${assertion.max}ms`);
  }

  if (assertion.type === "max-total-cost-usd") {
    const cost = totalCostUsd(trace);
    if (cost > assertion.max) {
      return fail(assertion, `Cost $${cost.toFixed(4)} exceeded max $${assertion.max}`, { cost });
    }
    return pass(assertion, `Cost $${cost.toFixed(4)} within budget`);
  }

  if (assertion.type === "required-final-response") {
    const response = finalResponse(trace);
    if (!response) return fail(assertion, "No final LLM response with content found");
    return pass(assertion, "Final LLM response is present", { eventId: response.id });
  }

  if (assertion.type === "required-citations") {
    const response = finalResponse(trace);
    const citations = response?.output?.citations ?? [];
    const min = assertion.min ?? 1;
    if (citations.length < min) {
      return fail(assertion, `Final response has ${citations.length} citations, min is ${min}`, { citations });
    }
    return pass(assertion, `Final response has ${citations.length} citations`, { citations });
  }

  return fail(assertion, `Unknown assertion type: ${assertion.type}`);
}

export function evaluateTrace(trace, config = DEFAULT_EVAL_CONFIG) {
  const results = (config.assertions ?? []).map((assertion) => runAssertion(trace, assertion));
  return {
    name: config.name ?? "unnamed-eval",
    traceId: trace.runId,
    passed: results.every((result) => result.passed),
    results
  };
}

export function formatEvalReport(report) {
  const lines = [
    `Eval: ${report.name}`,
    `Trace: ${report.traceId}`,
    `Status: ${report.passed ? "PASS" : "FAIL"}`,
    ""
  ];

  for (const result of report.results) {
    lines.push(`[${result.passed ? "PASS" : "FAIL"}] ${result.id}: ${result.message}`);
  }

  return lines.join("\n");
}
