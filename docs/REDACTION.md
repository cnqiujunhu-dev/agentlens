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
import { readTrace, redactTrace, writeTrace } from "agentlens-devtools";

const trace = readTrace(".agentlens/runs/demo.json");
const redacted = redactTrace(trace, {
  keys: ["authorization", "token", "customerEmail"]
});

writeTrace(".agentlens/runs/demo.redacted.json", redacted);
```

## Limits

Redaction is key-based. Run `agentlens scan` after redaction to catch common secret-shaped string values and risky trace content:

```bash
node ./bin/agentlens.js scan .agentlens/runs/demo.redacted.json
```

Treat public traces as sensitive until reviewed. The scan is heuristic and does not replace manual review.
