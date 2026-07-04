# Trace Redaction

AgentLens traces can contain prompts, tool inputs, headers, retrieval chunks, metadata, and errors. Before sharing a trace in a public issue or demo, redact sensitive fields.

## CLI

```bash
node ./bin/agentlens.js redact .agentlens/runs/demo.json --out .agentlens/runs/demo.redacted.json
```

Custom keys:

```bash
node ./bin/agentlens.js redact .agentlens/runs/demo.json --keys email,ssn,account --out .agentlens/runs/demo.redacted.json
```

Default key patterns:

- `api_key`
- `apikey`
- `authorization`
- `cookie`
- `password`
- `secret`
- `session`
- `token`

Keys are matched case-insensitively and as substrings, so `x-api-key` and `customerToken` are both redacted.

## API

```js
import { readTrace, redactTrace, writeTrace } from "agentlens";

const trace = readTrace(".agentlens/runs/demo.json");
const redacted = redactTrace(trace, {
  keys: ["authorization", "token", "customerEmail"]
});

writeTrace(".agentlens/runs/demo.redacted.json", redacted);
```

## Limits

Redaction is key-based. It does not yet scan arbitrary string values for secrets. Treat public traces as sensitive until reviewed.
