import fs from "node:fs";
import { fileURLToPath } from "node:url";

const SCHEMAS = {
  trace: "../schemas/agentlens.trace.v1.schema.json",
  eval: "../schemas/agentlens.eval.v1.schema.json"
};

export function listSchemas() {
  return Object.keys(SCHEMAS);
}

export function schemaPath(kind) {
  const relativePath = SCHEMAS[kind];
  if (!relativePath) {
    throw new Error(`Unknown schema kind: ${kind}. Expected one of: ${listSchemas().join(", ")}`);
  }
  return fileURLToPath(new URL(relativePath, import.meta.url));
}

export function readSchema(kind) {
  return JSON.parse(fs.readFileSync(schemaPath(kind), "utf8"));
}
