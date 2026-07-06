# Dashboard Review Workflow

AgentLens dashboards are static HTML files for reviewing recorded agent runs without rerunning the model. Use them in pull requests, issues, incident notes, and support handoffs when raw trace JSON is too slow to inspect.

## Build Review Artifacts

For one trace:

```bash
agentlens dashboard .agentlens/runs/demo.json --out .agentlens/reports/demo.html
```

For a pull request or CI run with multiple traces:

```bash
agentlens bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,scan,tool-calls,filters,timeline
```

Upload `.agentlens/reports/bundle` as a CI artifact so reviewers can open `index.html`, inspect `manifest.json` from automation, and then drill into individual dashboards.

## Review Order

Use this order when reviewing an agent regression:

1. Start with `Summary` to confirm status, event count, cost, errors, and scan state.
2. Check `Security Scan` for leaked secrets, prompt-injection phrases, and high-risk tool calls.
3. Use `Tool Calls` to find repeated or risky tools. Each group shows count, errors, risk, latency, server, permission, and first/last timeline links.
4. Use `Timeline Filters` to narrow by event type, status, search text, or MCP risk.
5. Use `Timeline Jumps` for first error, first high-risk call, first tool call, final response, and last event.
6. Copy the filtered view link and paste it into a PR comment when another reviewer needs to inspect the same slice.

## Share Filtered Views

Dashboard filters are stored in the URL hash:

```text
#agentlens-filter?q=database.delete&type=tool.call
```

Set filters in the dashboard and click `Copy view link`. The copied URL opens the same static HTML file and restores the current search, type, status, and risk filters. This works for uploaded GitHub Actions artifacts, local files, and files served by `agentlens serve`.

## Compact Reports

Use `--sections` when a dashboard will be attached to a PR comment or support ticket:

```bash
agentlens dashboard .agentlens/runs/demo.json \
  --out .agentlens/reports/review.html \
  --sections summary,scan,tool-calls,filters,timeline
```

Available sections:

- `summary`
- `event-types`
- `scan`
- `tool-calls`
- `filters`
- `timeline`

For a very short artifact, use `--sections summary,tool-calls,timeline`. For security review, keep `scan` and `filters` enabled.

## GitHub Actions Pattern

```yaml
- name: Run AgentLens evals
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.3.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    scan-fail-on: high
    pr-comment: .agentlens/reports/agentlens-pr-comment.md
    bundle: .agentlens/reports/bundle
    bundle-sections: summary,scan,tool-calls,filters,timeline

- name: Upload AgentLens run bundle
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: agentlens-run-bundle
    path: ${{ steps.agentlens.outputs.bundle }}
```

The PR comment should summarize pass/fail status. The uploaded bundle should be the place reviewers inspect full traces, copy filtered dashboard links, and decide whether the agent behavior changed as intended.

## Redaction

Before attaching dashboards to public issues or external support threads, prefer `agentlens share` so the trace is redacted first:

```bash
agentlens share .agentlens/runs/demo.json --config evals/default.json --out .agentlens/share/demo --sections summary,scan,tool-calls,filters,timeline
```

Always review public artifacts manually. The local scan is a useful guardrail, not a complete security review.
