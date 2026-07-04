import { addEvent, createRun, finishRun } from "../trace.js";

const EMPTY_RISK_COUNTS = {
  low: 0,
  medium: 0,
  high: 0,
  critical: 0
};

const HIGH_RISK_INPUT_KEYS = new Set([
  "command",
  "cmd",
  "script",
  "sql",
  "query",
  "path",
  "file",
  "filepath",
  "url",
  "endpoint"
]);

function now() {
  return new Date().toISOString();
}

function durationSince(startedAtMs) {
  return Math.max(0, Date.now() - startedAtMs);
}

function normalizeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack
  };
}

function lower(value) {
  return String(value ?? "").toLowerCase();
}

function normalizeTool(tool) {
  return {
    name: tool?.name ?? tool?.tool ?? "unknown",
    description: tool?.description ?? "",
    permission: tool?.permission ?? tool?.metadata?.permission,
    permissions: tool?.permissions ?? tool?.metadata?.permissions ?? [],
    annotations: tool?.annotations ?? {},
    inputSchema: tool?.inputSchema ?? tool?.schema ?? tool?.parameters
  };
}

function schemaKeys(schema) {
  if (!schema || typeof schema !== "object") return [];
  return schema.properties && typeof schema.properties === "object" ? Object.keys(schema.properties) : [];
}

function inferMcpToolRisk(tool) {
  const normalized = normalizeTool(tool);
  const reasons = [];
  const permissions = [normalized.permission, ...normalized.permissions].filter(Boolean).map(lower);
  const text = lower(`${normalized.name} ${normalized.description}`);
  const riskyKeys = schemaKeys(normalized.inputSchema).map(lower).filter((key) => HIGH_RISK_INPUT_KEYS.has(key));
  let permission = "unknown";
  let risk = "medium";

  if (normalized.annotations?.readOnlyHint === true || permissions.some((item) => item.includes("read"))) {
    permission = "read-only";
    risk = "low";
    reasons.push("marked read-only");
  }

  if (normalized.annotations?.readOnlyHint === false || permissions.some((item) => item.includes("write"))) {
    permission = "write";
    risk = "high";
    reasons.push("marked write-capable");
  }

  if (
    normalized.annotations?.destructiveHint === true ||
    permissions.some((item) => item.includes("admin") || item.includes("destructive")) ||
    /\b(delete|remove|drop|destroy|truncate|reset|wipe|purge|kill|terminate)\b/.test(text)
  ) {
    permission = "destructive";
    risk = "critical";
    reasons.push("destructive capability signal");
  } else if (/\b(create|update|insert|patch|post|put|send|email|publish|deploy|execute|run|write)\b/.test(text)) {
    if (risk !== "critical") {
      permission = permission === "unknown" ? "write" : permission;
      risk = risk === "low" ? "medium" : "high";
    }
    reasons.push("write or execution verb");
  } else if (permission === "unknown" && /\b(read|get|list|search|fetch|query|lookup)\b/.test(text)) {
    permission = "read-only";
    risk = "low";
    reasons.push("read-oriented verb");
  }

  if (riskyKeys.length > 0 && risk !== "critical") {
    risk = risk === "low" ? "medium" : risk;
    reasons.push(`sensitive input keys: ${riskyKeys.join(", ")}`);
  }

  if (reasons.length === 0) reasons.push("no explicit permission signal");

  return {
    name: normalized.name,
    description: normalized.description,
    permission,
    risk,
    reasons,
    inputSchema: normalized.inputSchema,
    annotations: normalized.annotations
  };
}

export function scanMcpTools({ server = "mcp-server", tools = [] } = {}) {
  const scanned = tools.map(inferMcpToolRisk);
  const riskCounts = { ...EMPTY_RISK_COUNTS };
  for (const tool of scanned) {
    riskCounts[tool.risk] = (riskCounts[tool.risk] ?? 0) + 1;
  }

  return {
    server,
    total: scanned.length,
    riskCounts,
    tools: scanned
  };
}

export function addMcpToolManifest(run, { server = "mcp-server", tools = [] } = {}) {
  if (!run) throw new Error("addMcpToolManifest requires a run");
  const manifest = scanMcpTools({ server, tools });
  addEvent(run, {
    ts: now(),
    type: "mcp.tools",
    name: server,
    output: manifest,
    metadata: {
      adapter: "mcp",
      protocol: "mcp",
      server
    }
  });
  return manifest;
}

export function createMcpRun({ app = "mcp-agent", name = "mcp tool run", server, metadata = {} } = {}) {
  return createRun({
    app,
    name,
    metadata: {
      adapter: "mcp",
      server,
      ...metadata
    }
  });
}

export async function traceMcpToolCall(run, call, execute) {
  if (!run) throw new Error("traceMcpToolCall requires a run");
  if (!call?.tool) throw new Error("traceMcpToolCall requires call.tool");
  if (typeof execute !== "function") throw new Error("traceMcpToolCall requires an execute function");

  const startedAtMs = Date.now();
  const toolRisk = inferMcpToolRisk({
    name: call.tool,
    permission: call.permission,
    inputSchema: call.toolSchema ?? call.toolDefinition?.inputSchema,
    description: call.description ?? call.toolDefinition?.description,
    annotations: call.annotations ?? call.toolDefinition?.annotations,
    metadata: call.metadata
  });
  const metadata = {
    adapter: "mcp",
    protocol: "mcp",
    server: call.server,
    permission: call.permission ?? toolRisk.permission ?? "unknown",
    toolRisk: toolRisk.risk,
    toolRiskReasons: toolRisk.reasons,
    toolSchema: call.toolSchema ?? call.toolDefinition?.inputSchema,
    ...(call.metadata ?? {})
  };

  addEvent(run, {
    ts: now(),
    type: "tool.call",
    name: call.tool,
    input: call.input ?? {},
    metadata
  });

  try {
    const output = await execute(call.input ?? {});
    addEvent(run, {
      ts: now(),
      type: "tool.result",
      name: call.tool,
      status: "ok",
      durationMs: durationSince(startedAtMs),
      output,
      metadata
    });
    return output;
  } catch (error) {
    const normalized = normalizeError(error);
    addEvent(run, {
      ts: now(),
      type: "tool.result",
      name: call.tool,
      status: "error",
      durationMs: durationSince(startedAtMs),
      output: normalized,
      metadata
    });
    addEvent(run, {
      ts: now(),
      type: "error",
      name: `mcp.${call.tool}`,
      status: "error",
      output: normalized,
      metadata
    });
    throw error;
  }
}

export function finishMcpRun(run, status = "passed") {
  return finishRun(run, status);
}
