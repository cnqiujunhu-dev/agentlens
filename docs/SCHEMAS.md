# JSON Schemas

AgentLens publishes JSON Schema files for traces, eval configs, and review manifests.

## Files

- `schemas/agentlens.trace.v1.schema.json`
- `schemas/agentlens.eval.v1.schema.json`
- `schemas/agentlens.review.v1.schema.json`

## CLI

Print a schema:

```bash
node ./bin/agentlens.js schema trace
node ./bin/agentlens.js schema eval
node ./bin/agentlens.js schema review
```

Validate a file:

```bash
node ./bin/agentlens.js validate trace .agentlens/runs/demo.json
node ./bin/agentlens.js validate eval evals/default.json
node ./bin/agentlens.js validate review .agentlens/review/review.json
```

Write a schema to a file:

```bash
node ./bin/agentlens.js schema trace --out /tmp/agentlens.trace.schema.json
```

## API

```js
import { listSchemas, readSchema, schemaPath } from "agentlens-devtools";

console.log(listSchemas());
console.log(schemaPath("trace"));
console.log(readSchema("eval"));
```

## Notes

The eval schema includes policy assertion names for event requirements, tool and MCP governance, cost and latency budgets, citation checks, and workflow gates such as `min-workflow-tasks`, `min-workflow-chains`, and `max-workflow-errors`. The review schema covers `review.json` status, generated file paths, CI counts, workflow diff deltas, and run bundle links.

The schemas are intended for editor completion, CI integration, and external tooling. AgentLens also uses its own lightweight runtime validation for trace, eval, and review files so the CLI can stay dependency-free and return focused terminal errors.
