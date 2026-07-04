# AgentLens Security Scan

`agentlens scan` runs local heuristic checks against an AgentLens trace. It is designed for pre-commit, PR, support, and public sharing workflows where a quick safety pass is better than manually reading a long JSON trace.

## CLI

```bash
agentlens scan .agentlens/runs/demo.json
agentlens scan .agentlens/runs/demo.json --fail-on medium
agentlens scan .agentlens/runs/demo.json --json
agentlens ci --runs .agentlens/runs --config evals/default.json --scan --scan-fail-on high
```

Default behavior:

- `high` and `critical` findings fail the command.
- `medium` findings are reported but do not fail unless `--fail-on medium` is used.
- `--fail-on none` reports findings without changing the exit code.

## What It Checks

- Secret-shaped values: OpenAI-style API keys, GitHub tokens, AWS access keys, JWTs, and bearer tokens.
- Sensitive keys: unredacted values under fields such as `apiKey`, `authorization`, `password`, `secret`, `session`, and `token`.
- Prompt injection phrases: text asking the model to ignore prior instructions, reveal hidden instructions, or use jailbreak-style behavior.
- Risky tool calls: declared `metadata.toolRisk` values and tool names that suggest destructive, command execution, outbound messaging, or money movement behavior.

## API

```js
import { formatScanReport, readTrace, scanTrace } from "agentlens";

const trace = readTrace(".agentlens/runs/demo.json");
const report = scanTrace(trace, { failOnSeverity: "medium" });

console.log(formatScanReport(report));
```

## Share Bundles

`agentlens share` redacts the trace first and then writes `scan.txt` from the redacted trace:

```bash
agentlens share .agentlens/runs/demo.json --config evals/default.json --out .agentlens/share/demo
```

The share summary includes scan status and finding counts. Always review public bundles manually before attaching them to an issue or PR.

## CI Gate

`agentlens ci` can run eval rules and scan findings together:

```bash
agentlens ci --runs .agentlens/runs --config evals/default.json --scan --scan-fail-on high
```

The composite GitHub Action enables scan by default. Use `scan: false` when you want eval-only CI.

## Limits

The scan is heuristic. It can miss secrets that do not match known patterns and can flag benign text that resembles risky content. Treat it as a fast local guardrail, not as a replacement for security review.
