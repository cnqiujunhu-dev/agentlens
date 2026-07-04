import { DEFAULT_REDACT_KEYS } from "./redact.js";

export const SEVERITY_ORDER = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export const DEFAULT_SCAN_OPTIONS = {
  failOnSeverity: "high"
};

const SECRET_PATTERNS = [
  { id: "openai-api-key", label: "OpenAI API key-like value", severity: "high", pattern: /\bsk-[a-zA-Z0-9_-]{20,}\b/g },
  { id: "github-token", label: "GitHub token-like value", severity: "high", pattern: /\bgh[pousr]_[a-zA-Z0-9_]{20,}\b/g },
  { id: "aws-access-key", label: "AWS access key-like value", severity: "high", pattern: /\bA(KIA|SIA)[0-9A-Z]{16}\b/g },
  { id: "jwt", label: "JWT-like value", severity: "high", pattern: /\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\b/g },
  { id: "bearer-token", label: "Bearer token-like value", severity: "high", pattern: /\bbearer\s+[a-zA-Z0-9._-]{18,}\b/gi }
];

const PROMPT_INJECTION_PATTERNS = [
  {
    id: "ignore-instructions",
    label: "Prompt injection phrase asking the model to ignore prior instructions",
    severity: "medium",
    pattern: /\b(ignore|disregard)\s+(all\s+)?(previous|prior|above|system|developer)\s+(instructions|messages?)\b/i
  },
  {
    id: "reveal-system-prompt",
    label: "Prompt injection phrase asking for hidden instructions or system prompt",
    severity: "medium",
    pattern: /\b(reveal|print|show|dump|exfiltrate)\s+(your\s+)?(system prompt|hidden instructions|developer message|internal instructions)\b/i
  },
  {
    id: "jailbreak",
    label: "Jailbreak-style instruction detected",
    severity: "medium",
    pattern: /\b(jailbreak|bypass safety|developer mode|act as dan)\b/i
  }
];

const RISKY_TOOL_PATTERNS = [
  {
    id: "destructive-tool-name",
    label: "Destructive tool name",
    severity: "high",
    pattern: /(^|[._:/-])(delete|drop|truncate|destroy|wipe|erase|unlink|remove|rm)($|[._:/-])/i
  },
  {
    id: "command-execution-tool",
    label: "Command execution tool name",
    severity: "medium",
    pattern: /(^|[._:/-])(exec|shell|bash|powershell|terminal|command|spawn)($|[._:/-])/i
  },
  {
    id: "outbound-message-tool",
    label: "Outbound message tool name",
    severity: "medium",
    pattern: /(^|[._:/-])(send-email|send_email|email\.send|slack\.send|post-message|post_message|webhook)($|[._:/-])/i
  },
  {
    id: "money-movement-tool",
    label: "Payment or money movement tool name",
    severity: "high",
    pattern: /(^|[._:/-])(charge|payment|transfer|payout|refund)($|[._:/-])/i
  }
];

const SAFE_TOKEN_METRIC_KEYS = new Set([
  "cachedtokens",
  "completiontokens",
  "inputtokens",
  "outputtokens",
  "prompttokens",
  "reasoningtokens",
  "totaltokens"
]);

function canonicalKey(key) {
  return String(key ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key) {
  const canonical = canonicalKey(key);
  if (SAFE_TOKEN_METRIC_KEYS.has(canonical)) return false;
  return DEFAULT_REDACT_KEYS.some((pattern) => {
    const canonicalPattern = canonicalKey(pattern);
    return canonical === canonicalPattern || canonical.includes(canonicalPattern);
  });
}

function isRedactedValue(value) {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return (
    trimmed === "" ||
    /^\[?(redacted|masked|hidden|removed)\]?$/i.test(trimmed) ||
    /^\*{6,}$/.test(trimmed) ||
    trimmed.includes("[REDACTED]")
  );
}

function pathText(path) {
  let output = "";
  for (const part of path) {
    if (typeof part === "number") {
      output += `[${part}]`;
    } else {
      output += output ? `.${part}` : part;
    }
  }
  return output || "$";
}

function lastPathKey(path) {
  for (let index = path.length - 1; index >= 0; index -= 1) {
    if (typeof path[index] === "string") return path[index];
  }
  return "";
}

function walk(value, visitor, path = []) {
  visitor(value, path);

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, [...path, index]));
    return;
  }

  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      walk(nested, visitor, [...path, key]);
    }
  }
}

function compactSample(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= 120) return text;
  return `${text.slice(0, 117)}...`;
}

function maskSecretSample(value) {
  let masked = String(value ?? "");
  for (const rule of SECRET_PATTERNS) {
    masked = masked.replace(rule.pattern, (match) => {
      if (match.toLowerCase().startsWith("bearer ")) return "Bearer [REDACTED]";
      if (match.length <= 8) return "[REDACTED]";
      return `${match.slice(0, Math.min(4, match.length))}...${match.slice(-4)}`;
    });
  }
  return compactSample(masked);
}

function injectionCandidatePath(path) {
  const key = lastPathKey(path).toLowerCase();
  return ["content", "text", "prompt", "message", "messages", "query", "question", "answer", "completion"].some((part) => key.includes(part));
}

function eventContext(trace, path) {
  if (path[0] !== "events" || typeof path[1] !== "number") return {};
  const event = trace.events?.[path[1]] ?? {};
  return {
    eventId: event.id,
    eventType: event.type,
    eventName: event.name
  };
}

function createFinding(trace, finding) {
  return {
    severity: finding.severity,
    category: finding.category,
    ruleId: finding.ruleId,
    message: finding.message,
    path: pathText(finding.path),
    ...eventContext(trace, finding.path),
    ...(finding.sample ? { sample: finding.sample } : {})
  };
}

function severityCounts(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity] += 1;
  return counts;
}

function categoryCounts(findings) {
  const counts = {};
  for (const finding of findings) counts[finding.category] = (counts[finding.category] ?? 0) + 1;
  return counts;
}

function thresholdValue(value) {
  if (!value || value === "none") return Infinity;
  return SEVERITY_ORDER[value] ?? SEVERITY_ORDER.high;
}

function sortedFindings(findings) {
  return [...findings].sort((a, b) => {
    const severityDelta = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
    if (severityDelta !== 0) return severityDelta;
    return a.path.localeCompare(b.path);
  });
}

function scanScalarValue(trace, value, path, findings) {
  const key = lastPathKey(path);

  if (isSensitiveKey(key) && !isRedactedValue(value) && (typeof value !== "object" || value === null)) {
    findings.push(
      createFinding(trace, {
        severity: "high",
        category: "secret",
        ruleId: "sensitive-key",
        message: `Sensitive key "${key}" contains an unredacted value`,
        path,
        sample: "[REDACTED]"
      })
    );
  }

  if (typeof value !== "string" || isRedactedValue(value)) return;

  for (const rule of SECRET_PATTERNS) {
    rule.pattern.lastIndex = 0;
    if (rule.pattern.test(value)) {
      findings.push(
        createFinding(trace, {
          severity: rule.severity,
          category: "secret",
          ruleId: rule.id,
          message: rule.label,
          path,
          sample: maskSecretSample(value)
        })
      );
    }
  }

  if (injectionCandidatePath(path)) {
    for (const rule of PROMPT_INJECTION_PATTERNS) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(value)) {
        findings.push(
          createFinding(trace, {
            severity: rule.severity,
            category: "prompt-injection",
            ruleId: rule.id,
            message: rule.label,
            path,
            sample: compactSample(value)
          })
        );
      }
    }
  }
}

function isReadOnlyTool(event) {
  const permission = String(event.metadata?.permission ?? "").toLowerCase();
  return ["read", "read-only", "readonly", "safe"].includes(permission);
}

function scanToolCall(trace, event, index, findings) {
  const risk = String(event.metadata?.toolRisk ?? event.metadata?.risk ?? "").toLowerCase();
  if (risk === "critical" || risk === "high") {
    findings.push(
      createFinding(trace, {
        severity: risk,
        category: "tool-risk",
        ruleId: "declared-tool-risk",
        message: `Tool call declares ${risk} risk`,
        path: ["events", index],
        sample: event.name ?? "unnamed-tool"
      })
    );
  }

  const toolName = String(event.name ?? "");
  for (const rule of RISKY_TOOL_PATTERNS) {
    rule.pattern.lastIndex = 0;
    if (toolName && rule.pattern.test(toolName) && !isReadOnlyTool(event)) {
      findings.push(
        createFinding(trace, {
          severity: rule.severity,
          category: "tool-risk",
          ruleId: rule.id,
          message: rule.label,
          path: ["events", index],
          sample: toolName
        })
      );
    }
  }
}

export function scanTrace(trace, options = {}) {
  const scanOptions = { ...DEFAULT_SCAN_OPTIONS, ...options };
  const findings = [];

  walk(trace, (value, path) => scanScalarValue(trace, value, path, findings));

  for (const [index, event] of (trace.events ?? []).entries()) {
    if (event.type === "tool.call") scanToolCall(trace, event, index, findings);
  }

  const orderedFindings = sortedFindings(findings);
  const failThreshold = thresholdValue(scanOptions.failOnSeverity);
  const passed = !orderedFindings.some((finding) => SEVERITY_ORDER[finding.severity] >= failThreshold);

  return {
    traceId: trace.runId,
    passed,
    failOnSeverity: scanOptions.failOnSeverity,
    summary: {
      findings: orderedFindings.length,
      bySeverity: severityCounts(orderedFindings),
      byCategory: categoryCounts(orderedFindings)
    },
    findings: orderedFindings
  };
}

export function formatScanReport(report) {
  const lines = [
    `Scan: ${report.traceId}`,
    `Status: ${report.passed ? "PASS" : "FAIL"}`,
    `Fail on severity: ${report.failOnSeverity}`,
    `Findings: ${report.summary.findings}`,
    `Severity: critical ${report.summary.bySeverity.critical}, high ${report.summary.bySeverity.high}, medium ${report.summary.bySeverity.medium}, low ${report.summary.bySeverity.low}`,
    ""
  ];

  if (report.findings.length === 0) {
    lines.push("No scan findings.");
    return lines.join("\n");
  }

  for (const finding of report.findings) {
    const event = [finding.eventType, finding.eventName].filter(Boolean).join(" / ");
    lines.push(`[${finding.severity.toUpperCase()}] ${finding.ruleId}: ${finding.message}`);
    lines.push(`  Path: ${finding.path}`);
    if (event) lines.push(`  Event: ${event}`);
    if (finding.sample) lines.push(`  Sample: ${finding.sample}`);
  }

  return lines.join("\n");
}

function sarifLevel(severity) {
  if (severity === "critical" || severity === "high") return "error";
  if (severity === "medium") return "warning";
  return "note";
}

function sarifRules(findings) {
  const rules = new Map();
  for (const finding of findings) {
    if (rules.has(finding.ruleId)) continue;
    rules.set(finding.ruleId, {
      id: finding.ruleId,
      name: finding.ruleId,
      shortDescription: { text: finding.message },
      fullDescription: { text: `${finding.category} finding with ${finding.severity} severity.` },
      helpUri: "https://github.com/cnqiujunhu-dev/agentlens/blob/main/docs/SECURITY_SCAN.md",
      properties: {
        category: finding.category,
        severity: finding.severity
      }
    });
  }
  return [...rules.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function sarifResult(finding, traceFile) {
  return {
    ruleId: finding.ruleId,
    level: sarifLevel(finding.severity),
    message: {
      text: `${finding.message} at ${finding.path}`
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: traceFile
          },
          region: {
            startLine: 1,
            startColumn: 1
          }
        },
        logicalLocations: [
          {
            name: finding.path,
            kind: "jsonpath"
          }
        ]
      }
    ],
    properties: {
      severity: finding.severity,
      category: finding.category,
      path: finding.path,
      ...(finding.eventId ? { eventId: finding.eventId } : {}),
      ...(finding.eventType ? { eventType: finding.eventType } : {}),
      ...(finding.eventName ? { eventName: finding.eventName } : {}),
      ...(finding.sample ? { sample: finding.sample } : {})
    }
  };
}

export function formatScanReportsSarif(items = []) {
  const allFindings = items.flatMap((item) => item.report?.findings ?? []);
  return {
    version: "2.1.0",
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "AgentLens",
            informationUri: "https://github.com/cnqiujunhu-dev/agentlens",
            rules: sarifRules(allFindings)
          }
        },
        results: items.flatMap((item) => (item.report?.findings ?? []).map((finding) => sarifResult(finding, item.traceFile ?? "trace.json")))
      }
    ]
  };
}

export function formatScanSarif(report, { traceFile = "trace.json" } = {}) {
  return formatScanReportsSarif([{ report, traceFile }]);
}
