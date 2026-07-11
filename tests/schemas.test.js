import test from "node:test";
import assert from "node:assert/strict";
import { listSchemas, readSchema, schemaPath } from "../src/schemas.js";

test("schema helper exposes trace, eval, and review schemas", () => {
  assert.deepEqual(listSchemas().sort(), ["eval", "review", "trace"]);

  const traceSchema = readSchema("trace");
  const evalSchema = readSchema("eval");
  const reviewSchema = readSchema("review");

  assert.equal(traceSchema.properties.schemaVersion.const, "agentlens.trace.v1");
  assert.equal(evalSchema.properties.version.const, "agentlens.eval.v1");
  assert.equal(reviewSchema.properties.schemaVersion.const, "agentlens.review.v1");
  assert.ok(reviewSchema.properties.summary.properties.diff.properties.workflow);
  assert.equal(evalSchema.$defs.assertion.properties.type.enum.includes("forbidden-mcp-tool-risks"), true);
  assert.equal(evalSchema.$defs.assertion.properties.type.enum.includes("max-workflow-errors"), true);
  assert.equal(evalSchema.$defs.assertion.properties.type.enum.includes("min-workflow-tasks"), true);
  assert.ok(evalSchema.$defs.assertion.properties.exceptions);
  assert.ok(evalSchema.$defs.riskException);
  assert.ok(schemaPath("trace").endsWith("agentlens.trace.v1.schema.json"));
  assert.ok(schemaPath("review").endsWith("agentlens.review.v1.schema.json"));
});

test("schema helper rejects unknown schema kinds", () => {
  assert.throws(() => readSchema("missing"), /Unknown schema kind/);
});
