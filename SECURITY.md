# Security Policy

AgentLens records prompts, tool inputs, tool outputs, retrieval results, metadata, and errors. Those traces may contain secrets or private data.

## Supported Versions

AgentLens is currently pre-1.0. Security fixes target the latest version on the main branch.

## Reporting a Vulnerability

Please do not open a public issue for sensitive vulnerabilities.

Until a dedicated security contact is published, report issues privately to the repository owner.

Useful details:

- Affected version or commit.
- Reproduction steps.
- Whether a trace contains sensitive data.
- Expected impact.

## Handling Sensitive Traces

- Do not commit `.agentlens/runs` or `.agentlens/reports`.
- Redact secrets before sharing traces.
- Use `agentlens redact <trace-file>` before attaching traces to public issues.
- Prefer minimal reproduction traces in public issues.
- Be careful when tracing tools that read files, execute commands, or access private APIs.
