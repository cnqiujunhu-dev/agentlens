import fs from "node:fs";
import { addEvent, createRun, finishRun, validateTrace } from "./trace.js";
import { ensureParent } from "./store.js";

function writeLine(filePath, value) {
  ensureParent(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function compactRun(run) {
  const { events, ...rest } = run;
  return rest;
}

export class JsonlTraceWriter {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.run = createRun(options);
    ensureParent(filePath);
    fs.writeFileSync(filePath, "", "utf8");
    writeLine(filePath, {
      kind: "run.started",
      run: compactRun(this.run)
    });
  }

  addEvent(event) {
    const normalized = addEvent(this.run, event);
    writeLine(this.filePath, {
      kind: "event",
      event: normalized
    });
    return normalized;
  }

  finish(status = "passed") {
    finishRun(this.run, status);
    writeLine(this.filePath, {
      kind: "run.finished",
      run: compactRun(this.run)
    });
    return this.run;
  }
}

export function readJsonlTrace(filePath) {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  let trace = null;

  for (const record of lines) {
    if (record.kind === "run.started") {
      trace = {
        ...record.run,
        events: []
      };
    } else if (record.kind === "event") {
      if (!trace) throw new Error("JSONL trace event appeared before run.started");
      trace.events.push(record.event);
    } else if (record.kind === "run.finished") {
      if (!trace) throw new Error("JSONL trace finished before run.started");
      trace = {
        ...trace,
        ...record.run,
        events: trace.events
      };
    } else {
      throw new Error(`Unknown JSONL trace record kind: ${record.kind}`);
    }
  }

  if (!trace) throw new Error(`No run.started record found in ${filePath}`);

  const result = validateTrace(trace);
  if (!result.valid) {
    throw new Error(`Invalid JSONL trace ${filePath}: ${result.errors.join("; ")}`);
  }

  return trace;
}
