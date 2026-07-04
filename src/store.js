import fs from "node:fs";
import path from "node:path";
import { validateTrace } from "./trace.js";

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function ensureParent(filePath) {
  ensureDir(path.dirname(filePath));
}

export function initWorkspace(root = process.cwd()) {
  const workspaceRoot = path.join(root, ".agentlens");
  const runsDir = path.join(workspaceRoot, "runs");
  const reportsDir = path.join(workspaceRoot, "reports");

  ensureDir(runsDir);
  ensureDir(reportsDir);

  return {
    root: workspaceRoot,
    runsDir,
    reportsDir
  };
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function writeJson(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export function writeText(filePath, value) {
  ensureParent(filePath);
  fs.writeFileSync(filePath, value, "utf8");
}

export function readTrace(filePath) {
  const trace = readJson(filePath);
  const result = validateTrace(trace);
  if (!result.valid) {
    throw new Error(`Invalid trace file ${filePath}: ${result.errors.join("; ")}`);
  }
  return trace;
}

export function writeTrace(filePath, trace) {
  const result = validateTrace(trace);
  if (!result.valid) {
    throw new Error(`Refusing to write invalid trace: ${result.errors.join("; ")}`);
  }
  writeJson(filePath, trace);
}
