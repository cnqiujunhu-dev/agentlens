# AgentLens Support

AgentLens is early-stage open source. The fastest way to get useful help is to provide a small, redacted reproduction.

## Before Opening An Issue

Run:

```bash
agentlens doctor
npm run verify
```

If `agentlens doctor` reports failed checks, include the output in the issue after removing private paths or sensitive details.

## Where To Ask

- Bugs: use the bug report template.
- Framework, SDK, or MCP integrations: use the adapter request template.
- New eval or policy rules: use the eval rule request template.
- Security issues: do not open a public issue; follow [SECURITY.md](SECURITY.md).

## Sensitive Traces

Do not attach traces that contain secrets, customer data, credentials, private prompts, or proprietary tool outputs.

Use:

```bash
agentlens redact <trace-file> --out <redacted-trace-file>
```

For public issues, prefer the smallest trace that reproduces the problem.
