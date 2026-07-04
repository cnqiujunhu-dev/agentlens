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

Write a schema to a file:

```bash
node ./bin/agentlens.js schema trace --out /tmp/agentlens.trace.schema.json
```

## API

```js
import { listSchemas, readSchema, schemaPath } from "agentlens";

console.log(listSchemas());
console.log(schemaPath("trace"));
console.log(readSchema("eval"));
```

## Notes

The schemas are intended for editor completion, CI integration, and external tooling. AgentLens still uses its own lightweight runtime validation for trace reads so the CLI can stay dependency-free.
