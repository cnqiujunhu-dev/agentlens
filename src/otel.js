import crypto from "node:crypto";
import { readTrace, writeJson } from "./store.js";

const SCOPE_NAME = "agentlens";

function hashHex(value, length) {
  const hash = crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
  return /^0+$/.test(hash) ? `1${hash.slice(1)}` : hash;
}

function traceIdFor(trace) {
  return hashHex(`agentlens.trace:${trace.runId}`, 32);
}

function spanIdFor(trace, key) {
  return hashHex(`agentlens.span:${trace.runId}:${key}`, 16);
}

function timeUnixNano(value) {
  const millis = Date.parse(value);
  const safeMillis = Number.isFinite(millis) ? millis : Date.now();
  return BigInt(safeMillis) * 1_000_000n;
}

function durationMsToNano(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0n;
  return BigInt(Math.max(0, Math.round(value))) * 1_000_000n;
}

function endForEvent(event) {
  return timeUnixNano(event.ts);
}

function startForEvent(event) {
  return endForEvent(event) - durationMsToNano(event.durationMs);
}

function jsonString(value) {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function attributeValue(value) {
  if (typeof value === "boolean") return { boolValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
    return { arrayValue: { values: value.map(attributeValue) } };
  }
  return { stringValue: String(value) };
}

function attr(key, value) {
  if (value === undefined || value === null) return [];
  return [{ key, value: attributeValue(value) }];
}

function attrs(entries) {
  return entries.flatMap(([key, value]) => attr(key, value));
}

function statusCode(status) {
  return status === "error" || status === "failed" ? 2 : 1;
}

function eventStatus(...events) {
  return events.some((event) => event?.status === "error" || event?.status === "failed") ? "error" : "ok";
}

function eventKey(event) {
  return event.name ?? event.metadata?.tool ?? event.type;
}

function pushPending(map, event) {
  const key = eventKey(event);
  const pending = map.get(key) ?? [];
  pending.push(event);
  map.set(key, pending);
}

function takePending(map, event) {
  const key = eventKey(event);
  const pending = map.get(key);
  if (!pending || pending.length === 0) return null;
  const item = pending.shift();
  if (pending.length === 0) map.delete(key);
  return item;
}

function flattenMessages(prefix, messages) {
  if (!Array.isArray(messages)) return [];
  const result = [];
  for (const [index, message] of messages.entries()) {
    result.push(...attr(`${prefix}.${index}.message.role`, message.role));
    if (typeof message.content === "string") {
      result.push(...attr(`${prefix}.${index}.message.content`, message.content));
    } else if (message.content !== undefined) {
      result.push(...attr(`${prefix}.${index}.message.content`, jsonString(message.content)));
    }
  }
  return result;
}

function contentFromOutput(output) {
  if (typeof output === "string") return output;
  if (typeof output?.content === "string") return output.content;
  if (typeof output?.message?.content === "string") return output.message.content;
  return undefined;
}

function usageAttributes(usage = {}) {
  return attrs([
    ["llm.token_count.prompt", usage.inputTokens],
    ["llm.token_count.completion", usage.outputTokens],
    ["llm.token_count.total", usage.totalTokens],
    ["gen_ai.usage.input_tokens", usage.inputTokens],
    ["gen_ai.usage.output_tokens", usage.outputTokens],
    ["gen_ai.usage.total_tokens", usage.totalTokens],
    ["agentlens.cost.usd", usage.costUsd]
  ]);
}

function baseEventAttributes(event) {
  return attrs([
    ["agentlens.event.id", event.id],
    ["agentlens.event.type", event.type],
    ["agentlens.event.name", event.name],
    ["agentlens.event.status", event.status],
    ["agentlens.event.duration_ms", event.durationMs],
    ["metadata", event.metadata ? jsonString(event.metadata) : undefined]
  ]);
}

function inputAttributes(input) {
  return [
    ...attrs([
      ["input.mime_type", input === undefined ? undefined : "application/json"],
      ["input.value", jsonString(input)]
    ]),
    ...flattenMessages("llm.input_messages", input?.messages)
  ];
}

function outputAttributes(output) {
  const content = contentFromOutput(output);
  return [
    ...attrs([
      ["output.mime_type", output === undefined ? undefined : "application/json"],
      ["output.value", jsonString(output)],
      ["llm.output_messages.0.message.role", content ? "assistant" : undefined],
      ["llm.output_messages.0.message.content", content]
    ])
  ];
}

function llmAttributes(prompt, response) {
  const provider = response?.provider ?? prompt?.provider;
  const model = response?.model ?? prompt?.model;
  return [
    ...attrs([
      ["openinference.span.kind", "LLM"],
      ["llm.provider", provider],
      ["llm.system", provider],
      ["llm.model_name", model],
      ["gen_ai.provider.name", provider],
      ["gen_ai.request.model", model],
      ["gen_ai.response.model", response?.model],
      ["agentlens.prompt_event.id", prompt?.id],
      ["agentlens.response_event.id", response?.id]
    ]),
    ...baseEventAttributes(response ?? prompt),
    ...inputAttributes(prompt?.input),
    ...outputAttributes(response?.output),
    ...usageAttributes(response?.usage)
  ];
}

function toolAttributes(call, result) {
  const name = result?.name ?? call?.name;
  return [
    ...attrs([
      ["openinference.span.kind", "TOOL"],
      ["tool.name", name],
      ["tool.id", call?.id],
      ["gen_ai.tool.name", name],
      ["gen_ai.tool.call.id", call?.id],
      ["gen_ai.tool.call.arguments", jsonString(call?.input)],
      ["gen_ai.tool.call.result", jsonString(result?.output)],
      ["agentlens.tool.permission", call?.metadata?.permission],
      ["agentlens.tool.risk", call?.metadata?.risk],
      ["agentlens.mcp.server", call?.metadata?.mcpServer]
    ]),
    ...baseEventAttributes(result ?? call),
    ...inputAttributes(call?.input),
    ...outputAttributes(result?.output)
  ];
}

function retrievalAttributes(query, result) {
  return [
    ...attrs([
      ["openinference.span.kind", "RETRIEVER"],
      ["retrieval.query", query?.input?.query ?? query?.input?.text ?? jsonString(query?.input)],
      ["retrieval.documents", jsonString(result?.output?.documents ?? result?.output)]
    ]),
    ...baseEventAttributes(result ?? query),
    ...inputAttributes(query?.input),
    ...outputAttributes(result?.output)
  ];
}

function genericAttributes(event, kind = "CHAIN") {
  return [
    ...attrs([["openinference.span.kind", kind]]),
    ...baseEventAttributes(event),
    ...inputAttributes(event.input),
    ...outputAttributes(event.output)
  ];
}

function spanRecord({ name, kind, startNs, endNs, status, attributes, key }) {
  return {
    name,
    kind,
    startNs,
    endNs: endNs < startNs ? startNs : endNs,
    status,
    attributes,
    key
  };
}

function pairedRecord({ name, kind, startEvent, endEvent, attributes, key }) {
  return spanRecord({
    name,
    kind,
    startNs: startForEvent(startEvent),
    endNs: endForEvent(endEvent),
    status: eventStatus(startEvent, endEvent),
    attributes,
    key
  });
}

function singleRecord(event) {
  const kindByType = {
    "agent.message": "AGENT",
    "agent.task.start": "AGENT",
    "agent.task.end": "AGENT",
    "framework.node.start": "CHAIN",
    "framework.node.end": "CHAIN",
    "retrieval.query": "RETRIEVER",
    "retrieval.result": "RETRIEVER",
    "tool.call": "TOOL",
    "tool.result": "TOOL",
    "llm.prompt": "LLM",
    "llm.response": "LLM",
    error: "GUARDRAIL"
  };
  const kind = kindByType[event.type] ?? "CHAIN";
  return spanRecord({
    name: event.name ?? event.type,
    kind,
    startNs: startForEvent(event),
    endNs: endForEvent(event),
    status: eventStatus(event),
    attributes: genericAttributes(event, kind),
    key: event.id
  });
}

function buildSpanRecords(trace) {
  const records = [];
  const pending = {
    llm: new Map(),
    tool: new Map(),
    retrieval: new Map(),
    framework: new Map(),
    task: new Map()
  };

  for (const event of trace.events ?? []) {
    if (event.type === "llm.prompt") {
      pushPending(pending.llm, event);
    } else if (event.type === "llm.response") {
      const prompt = takePending(pending.llm, event);
      records.push(prompt
        ? pairedRecord({
          name: event.name ?? prompt.name ?? "llm",
          kind: "LLM",
          startEvent: prompt,
          endEvent: event,
          attributes: llmAttributes(prompt, event),
          key: `${prompt.id}:${event.id}`
        })
        : singleRecord(event));
    } else if (event.type === "tool.call") {
      pushPending(pending.tool, event);
    } else if (event.type === "tool.result") {
      const call = takePending(pending.tool, event);
      records.push(call
        ? pairedRecord({
          name: event.name ?? call.name ?? "tool",
          kind: "TOOL",
          startEvent: call,
          endEvent: event,
          attributes: toolAttributes(call, event),
          key: `${call.id}:${event.id}`
        })
        : singleRecord(event));
    } else if (event.type === "retrieval.query") {
      pushPending(pending.retrieval, event);
    } else if (event.type === "retrieval.result") {
      const query = takePending(pending.retrieval, event);
      records.push(query
        ? pairedRecord({
          name: event.name ?? query.name ?? "retrieval",
          kind: "RETRIEVER",
          startEvent: query,
          endEvent: event,
          attributes: retrievalAttributes(query, event),
          key: `${query.id}:${event.id}`
        })
        : singleRecord(event));
    } else if (event.type === "framework.node.start") {
      pushPending(pending.framework, event);
    } else if (event.type === "framework.node.end") {
      const start = takePending(pending.framework, event);
      records.push(start
        ? pairedRecord({
          name: event.name ?? start.name ?? "framework.node",
          kind: "CHAIN",
          startEvent: start,
          endEvent: event,
          attributes: genericAttributes(event, "CHAIN"),
          key: `${start.id}:${event.id}`
        })
        : singleRecord(event));
    } else if (event.type === "agent.task.start") {
      pushPending(pending.task, event);
    } else if (event.type === "agent.task.end") {
      const start = takePending(pending.task, event);
      records.push(start
        ? pairedRecord({
          name: event.name ?? start.name ?? "agent.task",
          kind: "AGENT",
          startEvent: start,
          endEvent: event,
          attributes: genericAttributes(event, "AGENT"),
          key: `${start.id}:${event.id}`
        })
        : singleRecord(event));
    } else {
      records.push(singleRecord(event));
    }
  }

  for (const map of Object.values(pending)) {
    for (const items of map.values()) {
      for (const event of items) records.push(singleRecord(event));
    }
  }

  return records.sort((a, b) => (a.startNs < b.startNs ? -1 : a.startNs > b.startNs ? 1 : 0));
}

function buildSpan(trace, record, parentSpanId) {
  return {
    traceId: traceIdFor(trace),
    spanId: spanIdFor(trace, record.key),
    parentSpanId,
    name: record.name,
    kind: 1,
    startTimeUnixNano: String(record.startNs),
    endTimeUnixNano: String(record.endNs),
    attributes: record.attributes,
    status: { code: statusCode(record.status) }
  };
}

function rootSpan(trace, childRecords) {
  const startNs = timeUnixNano(trace.startedAt);
  const fallbackEnd = childRecords.at(-1)?.endNs ?? startNs;
  const endNs = trace.endedAt ? timeUnixNano(trace.endedAt) : fallbackEnd;
  return {
    traceId: traceIdFor(trace),
    spanId: spanIdFor(trace, "root"),
    name: trace.name ?? trace.runId,
    kind: 1,
    startTimeUnixNano: String(startNs),
    endTimeUnixNano: String(endNs < startNs ? startNs : endNs),
    attributes: attrs([
      ["openinference.span.kind", "AGENT"],
      ["agentlens.run.id", trace.runId],
      ["agentlens.run.name", trace.name],
      ["agentlens.run.status", trace.status],
      ["agentlens.trace.schema_version", trace.schemaVersion],
      ["metadata", trace.metadata ? jsonString(trace.metadata) : undefined]
    ]),
    status: { code: statusCode(trace.status) }
  };
}

export function buildOtelTrace(trace, { serviceName = trace?.app ?? "agentlens", scopeName = SCOPE_NAME } = {}) {
  if (!trace || typeof trace !== "object") throw new Error("buildOtelTrace requires a trace object");
  const childRecords = buildSpanRecords(trace);
  const root = rootSpan(trace, childRecords);
  const spans = [root, ...childRecords.map((record) => buildSpan(trace, record, root.spanId))];

  return {
    resourceSpans: [
      {
        resource: {
          attributes: attrs([
            ["service.name", serviceName],
            ["agentlens.app", trace.app],
            ["agentlens.run.id", trace.runId]
          ])
        },
        scopeSpans: [
          {
            scope: {
              name: scopeName,
              attributes: attrs([["agentlens.trace.schema_version", trace.schemaVersion]])
            },
            spans
          }
        ]
      }
    ]
  };
}

export function writeOtelTrace({ traceFile, out, serviceName = undefined } = {}) {
  if (!traceFile) throw new Error("writeOtelTrace requires traceFile");
  if (!out) throw new Error("writeOtelTrace requires out");
  const trace = readTrace(traceFile);
  const otel = buildOtelTrace(trace, { serviceName });
  writeJson(out, otel);
  return {
    out,
    traceId: traceIdFor(trace),
    spans: otel.resourceSpans[0].scopeSpans[0].spans.length
  };
}
