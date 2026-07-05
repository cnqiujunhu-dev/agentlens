# MCP Risk Exceptions

Reviewed MCP risk exceptions let a team keep high-risk tools blocked by default while allowing narrow, time-boxed exceptions when a tool has been reviewed.

Use this when an MCP server exposes tools that can write data, delete records, send messages, move money, run commands, or touch internal systems. The goal is not to hide risk. The goal is to make each approved risk explicit, owned, expiring, and easy to review in a pull request.

## Policy Shape

Start from a rule that blocks high and critical MCP tool risks:

```json
{
  "id": "no-high-risk-tools",
  "type": "forbidden-mcp-tool-risks",
  "risks": ["high", "critical"],
  "requireExceptionOwner": true,
  "requireExceptionExpiry": true,
  "exceptions": []
}
```

When a reviewed exception is needed, add the narrowest matching entry:

```json
{
  "server": "internal-db-tools",
  "tool": "database.backup",
  "risk": "high",
  "owner": "platform-team",
  "expiresAt": "2026-12-31T00:00:00.000Z",
  "reason": "Approved for read-only backup verification in PR #1234"
}
```

AgentLens matches exceptions by `server`, `tool`, and `risk`. Missing `owner` or `expiresAt` fails the rule when the corresponding `requireExceptionOwner` or `requireExceptionExpiry` flag is enabled. Expired or invalid `expiresAt` values also fail the rule.

## Review Checklist

Use this checklist in the pull request that adds or extends an exception:

- The exception names one server and one tool, not a broad wildcard.
- The `risk` matches the trace metadata or MCP tool inventory risk.
- The `owner` is a team or person accountable for re-review.
- The `expiresAt` value is short enough for the operational risk.
- The `reason` links to the change request, incident, ticket, or design review.
- A recorded trace shows the reviewed tool behavior.
- CI runs `agentlens ci --scan` with the MCP policy config.

## GitHub Actions

Run the MCP policy pack in CI:

```yaml
- name: Run AgentLens MCP policy
  uses: cnqiujunhu-dev/agentlens@v0.2.0
  with:
    runs: .agentlens/runs
    config: evals/mcp-policy.json
    scan-fail-on: high
```

For pull requests, combine this with PR comment output so reviewers can see which traces failed without opening raw JSON:

```yaml
- name: Run AgentLens MCP policy
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.2.0
  with:
    runs: .agentlens/runs
    config: evals/mcp-policy.json
    pr-comment: .agentlens/reports/agentlens-pr-comment.md
```

## Failure Modes

AgentLens fails the eval when:

- a trace uses a forbidden MCP risk with no matching exception
- an exception is missing an owner while `requireExceptionOwner` is true
- an exception is missing an expiry while `requireExceptionExpiry` is true
- an exception expiry is invalid or in the past
- the exception does not match the observed server, tool, and risk

## Operating Model

Keep exceptions in the same eval config that CI uses. Review changes to that file like code. Prefer short expiry windows and renew only with a fresh trace artifact. Remove exceptions when the tool is redesigned, split into a safer permission, or moved behind a narrower MCP server allowlist.
