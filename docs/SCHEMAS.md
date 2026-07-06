# JSON Schemas

AgentLens publishes JSON Schema files for trace and eval configs.

## Files

- `schemas/agentlens.trace.v1.schema.json`
- `schemas/agentlens.eval.v1.schema.json`

## CLI

Print a schema:

```bash
node ./bin/agentlens.js schema trace
node ./bin/agentlens.js schema eval
```

Validate a file:

```bash
node ./bin/agentlens.js validate trace .agentlens/runs/demo.json
node ./bin/agentlens.js validate eval evals/default.json
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

The schemas are intended for editor completion, CI integration, and external tooling. AgentLens also uses its own lightweight runtime validation for trace and eval files so the CLI can stay dependency-free and return focused terminal errors.
