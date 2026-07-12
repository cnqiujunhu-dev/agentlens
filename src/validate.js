import { readJson } from "./store.js";
import { validateTrace } from "./trace.js";

const EVAL_SCHEMA_VERSION = "agentlens.eval.v1";
const REVIEW_SCHEMA_VERSION = "agentlens.review.v1";

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

function assertObject(errors, value, path) {
  if (!isObject(value)) errors.push(`${path} must be an object`);
}

function assertString(errors, value, path) {
  if (typeof value !== "string" || value.length === 0) errors.push(`${path} is required`);
}

function assertDateTime(errors, value, path) {
  if (typeof value !== "string" || value.length === 0) {
    errors.push(`${path} is required`);
  } else if (Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO date-time string`);
  }
}

function assertBoolean(errors, value, path) {
  if (typeof value !== "boolean") errors.push(`${path} must be a boolean`);
}

function assertInteger(errors, value, path) {
  if (!Number.isInteger(value)) errors.push(`${path} must be an integer`);
}

function assertStringOrNull(errors, value, path) {
  if (value !== null && typeof value !== "string") errors.push(`${path} must be a string or null`);
  if (typeof value === "string" && value.length === 0) errors.push(`${path} must be a non-empty string or null`);
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

function validateWorkflowCounts(errors, value, path) {
  if (!isObject(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  assertInteger(errors, value.chains, `${path}.chains`);
  assertInteger(errors, value.tasks, `${path}.tasks`);
  assertInteger(errors, value.errors, `${path}.errors`);
}

function validateReviewCiResult(errors, result, index) {
  const prefix = `summary.ci.results[${index}]`;
  if (!isObject(result)) {
    errors.push(`${prefix} must be an object`);
    return;
  }

  assertString(errors, result.file, `${prefix}.file`);
  if (result.traceId !== null && typeof result.traceId !== "string") errors.push(`${prefix}.traceId must be a string or null`);
  if (result.name !== null && typeof result.name !== "string") errors.push(`${prefix}.name must be a string or null`);
  assertBoolean(errors, result.passed, `${prefix}.passed`);
  if (result.error !== null && typeof result.error !== "string") errors.push(`${prefix}.error must be a string or null`);

  if (result.eval !== null) {
    if (!isObject(result.eval)) {
      errors.push(`${prefix}.eval must be an object or null`);
    } else {
      assertInteger(errors, result.eval.total, `${prefix}.eval.total`);
      assertInteger(errors, result.eval.passed, `${prefix}.eval.passed`);
      assertInteger(errors, result.eval.failed, `${prefix}.eval.failed`);
    }
  }

  if (result.scan !== null) {
    if (!isObject(result.scan)) {
      errors.push(`${prefix}.scan must be an object or null`);
    } else {
      assertBoolean(errors, result.scan.passed, `${prefix}.scan.passed`);
      assertInteger(errors, result.scan.findings, `${prefix}.scan.findings`);
      assertString(errors, result.scan.failOnSeverity, `${prefix}.scan.failOnSeverity`);
    }
  }
}

export function validateReviewManifest(manifest) {
  const errors = [];

  if (!isObject(manifest)) return { valid: false, errors: ["review manifest must be an object"] };
  if (manifest.schemaVersion !== REVIEW_SCHEMA_VERSION) errors.push(`schemaVersion must be ${REVIEW_SCHEMA_VERSION}`);

  if (manifest.generatedAt !== undefined) assertDateTime(errors, manifest.generatedAt, "generatedAt");

  if (manifest.options !== undefined) {
    if (!isObject(manifest.options)) {
      errors.push("options must be an object");
    } else {
      assertBoolean(errors, manifest.options.scan, "options.scan");
      assertString(errors, manifest.options.scanFailOnSeverity, "options.scanFailOnSeverity");
      assertString(errors, manifest.options.sections, "options.sections");
    }
  }

  if (manifest.links !== undefined) {
    if (!isObject(manifest.links)) {
      errors.push("links must be an object");
    } else {
      assertStringOrNull(errors, manifest.links.artifactUrl, "links.artifactUrl");
      assertStringOrNull(errors, manifest.links.sarifUrl, "links.sarifUrl");
    }
  }

  if (!isObject(manifest.status)) {
    errors.push("status must be an object");
  } else {
    assertBoolean(errors, manifest.status.passed, "status.passed");
    assertBoolean(errors, manifest.status.ci, "status.ci");
    assertInteger(errors, manifest.status.diffRegressions, "status.diffRegressions");
  }

  if (!isObject(manifest.inputs)) {
    errors.push("inputs must be an object");
  } else {
    assertString(errors, manifest.inputs.baselineFile, "inputs.baselineFile");
    assertString(errors, manifest.inputs.candidateFile, "inputs.candidateFile");
    assertString(errors, manifest.inputs.configPath, "inputs.configPath");
  }

  if (!isObject(manifest.files)) {
    errors.push("files must be an object");
  } else {
    for (const key of [
      "baseline",
      "candidate",
      "evalConfig",
      "ciSummary",
      "prComment",
      "ciReport",
      "diffText",
      "diffDashboard",
      "bundleIndex",
      "bundleManifest",
      "manifest",
      "readme"
    ]) {
      assertString(errors, manifest.files[key], `files.${key}`);
    }
    if (manifest.files.sarif !== null && manifest.files.sarif !== undefined && typeof manifest.files.sarif !== "string") {
      errors.push("files.sarif must be a string or null");
    }
  }

  assertObject(errors, manifest.summary, "summary");
  const summary = isObject(manifest.summary) ? manifest.summary : {};

  if (!isObject(summary.ci)) {
    errors.push("summary.ci must be an object");
  } else {
    assertInteger(errors, summary.ci.total, "summary.ci.total");
    assertInteger(errors, summary.ci.passed, "summary.ci.passed");
    assertInteger(errors, summary.ci.failed, "summary.ci.failed");
    if (!isObject(summary.ci.scan)) {
      errors.push("summary.ci.scan must be an object");
    } else {
      assertBoolean(errors, summary.ci.scan.enabled, "summary.ci.scan.enabled");
      assertString(errors, summary.ci.scan.failOnSeverity, "summary.ci.scan.failOnSeverity");
    }
    if (!Array.isArray(summary.ci.results)) {
      errors.push("summary.ci.results must be an array");
    } else {
      for (const [index, result] of summary.ci.results.entries()) validateReviewCiResult(errors, result, index);
    }
  }

  if (!isObject(summary.diff)) {
    errors.push("summary.diff must be an object");
  } else {
    if (!Array.isArray(summary.diff.regressions)) {
      errors.push("summary.diff.regressions must be an array");
    } else {
      for (const [index, regression] of summary.diff.regressions.entries()) {
        if (typeof regression !== "string") errors.push(`summary.diff.regressions[${index}] must be a string`);
      }
    }
    if (!isObject(summary.diff.workflow)) {
      errors.push("summary.diff.workflow must be an object");
    } else {
      validateWorkflowCounts(errors, summary.diff.workflow.baseline, "summary.diff.workflow.baseline");
      validateWorkflowCounts(errors, summary.diff.workflow.candidate, "summary.diff.workflow.candidate");
      validateWorkflowCounts(errors, summary.diff.workflow.deltas, "summary.diff.workflow.deltas");
      assertInteger(errors, summary.diff.workflow.regressions, "summary.diff.workflow.regressions");
      if (!Array.isArray(summary.diff.workflow.rows)) {
        errors.push("summary.diff.workflow.rows must be an array");
      } else {
        for (const [index, row] of summary.diff.workflow.rows.entries()) {
          const prefix = `summary.diff.workflow.rows[${index}]`;
          if (!isObject(row)) {
            errors.push(`${prefix} must be an object`);
          } else {
            assertString(errors, row.name, `${prefix}.name`);
            assertInteger(errors, row.baseline, `${prefix}.baseline`);
            assertInteger(errors, row.candidate, `${prefix}.candidate`);
            assertInteger(errors, row.delta, `${prefix}.delta`);
          }
        }
      }
    }
  }

  if (!isObject(summary.bundle)) {
    errors.push("summary.bundle must be an object");
  } else {
    assertInteger(errors, summary.bundle.total, "summary.bundle.total");
    assertInteger(errors, summary.bundle.valid, "summary.bundle.valid");
    assertInteger(errors, summary.bundle.invalid, "summary.bundle.invalid");
    assertString(errors, summary.bundle.index, "summary.bundle.index");
    assertString(errors, summary.bundle.manifest, "summary.bundle.manifest");
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
  if (kind === "review") return { kind, file: filePath, ...validateReviewManifest(data) };
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
