# JSONL Streaming Traces

AgentLens Trace v1 is still the canonical in-memory and materialized JSON format. JSONL is an append-friendly storage format for long-running agents where events should be written as they happen.

## Record Format

Each line is one JSON object:

```json
{"kind":"run.started","run":{"schemaVersion":"agentlens.trace.v1","runId":"run_...","app":"streaming-agent","name":"jsonl streaming demo","startedAt":"...","endedAt":null,"status":"running","metadata":{}}}
{"kind":"event","event":{"id":"evt_...","ts":"...","type":"llm.prompt","status":"ok","name":"planner"}}
{"kind":"event","event":{"id":"evt_...","ts":"...","type":"llm.response","status":"ok","name":"final-answer"}}
{"kind":"run.finished","run":{"schemaVersion":"agentlens.trace.v1","runId":"run_...","app":"streaming-agent","name":"jsonl streaming demo","startedAt":"...","endedAt":"...","status":"passed","metadata":{}}}
```

## Usage

```js
import { JsonlTraceWriter, readJsonlTrace } from "../src/jsonl.js";

const writer = new JsonlTraceWriter(".agentlens/runs/jsonl-demo.jsonl", {
  app: "streaming-agent",
  name: "jsonl streaming demo"
});

writer.addEvent({ type: "llm.prompt", name: "planner" });
writer.addEvent({ type: "llm.response", name: "final-answer" });
writer.finish("passed");

const trace = readJsonlTrace(".agentlens/runs/jsonl-demo.jsonl");
```

CLI materialization:

```bash
npm run demo:jsonl
node ./bin/agentlens.js materialize .agentlens/runs/jsonl-demo.jsonl --out .agentlens/runs/jsonl-demo.json
node ./bin/agentlens.js eval .agentlens/runs/jsonl-demo.json --config evals/default.json
```

## Why JSONL

- Events can be flushed as they happen.
- Crashed runs still leave partial evidence.
- Large traces can be processed line by line later.
- The final materialized trace stays compatible with existing replay, eval, and dashboard commands.
