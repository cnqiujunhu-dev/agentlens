import { readJson } from "./store.js";
import { validateTrace } from "./trace.js";

const EVAL_SCHEMA_VERSION = "agentlens.eval.v1";

const KNOWN_ASSERTION_TYPES = new Set([
  "allowed-mcp-servers",
  "forbidden-mcp-tool-risks",
  "forbidden-tool-permissions",
  "forbidden-tools",
  "max-errors",
  "max-tool-duration-ms",
  "max-total-cost-usd",
  "max-workflow-errors",
  "min-workflow-chains",
  "min-workflow-tasks",
  "required-citations",
  "required-event-types",
  "required-final-response",
  "required-tool-metadata"
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertArray(errors, value, path) {
  if (value !== undefined && !Array.isArray(value)) errors.push(`${path} must be an array`);
}

function validateAssertion(assertion, index) {
  const errors = [];
  const prefix = `assertions[${index}]`;

  if (!isObject(assertion)) return [`${prefix} must be an object`];
  if (!assertion.id || typeof assertion.id !== "string") errors.push(`${prefix}.id is required`);
  if (!assertion.type || typeof assertion.type !== "string") {
    errors.push(`${prefix}.type is required`);
  } else if (!KNOWN_ASSERTION_TYPES.has(assertion.type)) {
    errors.push(`${prefix}.type is unknown: ${assertion.type}`);
  }

  assertArray(errors, assertion.eventTypes, `${prefix}.eventTypes`);
  assertArray(errors, assertion.keys, `${prefix}.keys`);
  assertArray(errors, assertion.permissions, `${prefix}.permissions`);
  assertArray(errors, assertion.risks, `${prefix}.risks`);
  assertArray(errors, assertion.servers, `${prefix}.servers`);
  assertArray(errors, assertion.tools, `${prefix}.tools`);
  assertArray(errors, assertion.exceptions, `${prefix}.exceptions`);
  assertArray(errors, assertion.allow, `${prefix}.allow`);

  return errors;
}

export function validateEvalConfig(config) {
  const errors = [];

  if (!isObject(config)) return { valid: false, errors: ["eval config must be an object"] };
  if (config.version !== EVAL_SCHEMA_VERSION) errors.push(`version must be ${EVAL_SCHEMA_VERSION}`);
  if (!config.name || typeof config.name !== "string") errors.push("name is required");
  if (!Array.isArray(config.assertions)) {
    errors.push("assertions must be an array");
  } else {
    for (const [index, assertion] of config.assertions.entries()) {
      errors.push(...validateAssertion(assertion, index));
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function validateArtifact(kind, filePath) {
  if (!kind) throw new Error("validateArtifact requires kind");
  if (!filePath) throw new Error("validateArtifact requires filePath");

  const data = readJson(filePath);
  if (kind === "trace") return { kind, file: filePath, ...validateTrace(data) };
  if (kind === "eval") return { kind, file: filePath, ...validateEvalConfig(data) };
  throw new Error(`Unknown validation kind: ${kind}`);
}

export function formatValidationReport(report) {
  const lines = [
    "AgentLens Validate",
    `Kind: ${report.kind}`,
    `File: ${report.file}`,
    `Status: ${report.valid ? "PASS" : "FAIL"}`,
    ""
  ];

  if (report.valid) {
    lines.push("No validation errors found.");
  } else {
    for (const error of report.errors) lines.push(`- ${error}`);
  }

  return lines.join("\n");
}
