# Agent Regression PR Example

AgentLens can generate the artifacts a maintainer needs when a pull request changes agent behavior: eval output, scan findings, SARIF, a before/after diff, and a static run bundle.

Run the local example:

```bash
npm run demo:regression-pr
```

![AgentLens regression PR diff](assets/regression-pr-diff.png)

It writes a complete PR review bundle to `.agentlens/regression-pr/`:

```text
.agentlens/regression-pr/
  runs/
    baseline.json
    candidate.json
  eval.json
  reports/
    ci-summary.md
    ci-report.txt
    agentlens-ci.sarif
    diff.html
    diff.txt
    bundle/index.html
```

## What It Shows

The baseline trace passes. The candidate trace intentionally regresses:

- the final answer has no citation
- a forbidden outbound tool is called
- a sensitive `apiKey` field is not redacted
- prompt injection text appears in retrieved content
- cost increases beyond the PR eval budget

That produces:

- a failing CI summary
- SARIF scan findings for GitHub code scanning
- a static diff dashboard showing status, cost, error, event, and tool deltas
- a static run bundle with one dashboard per trace

## GitHub Actions Shape

In a real repository, the shape is:

```yaml
- name: Run AgentLens evals
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.2.0
  with:
    runs: .agentlens/runs
    config: .agentlens/evals/pr-regression.json
    scan-fail-on: high
    sarif: .agentlens/reports/agentlens-ci.sarif

- name: Upload AgentLens SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: .agentlens/reports/agentlens-ci.sarif

- name: Build AgentLens run bundle
  run: node ./bin/agentlens.js bundle .agentlens/runs --out .agentlens/reports/bundle

- name: Upload AgentLens run bundle
  uses: actions/upload-artifact@v4
  with:
    name: agentlens-run-bundle
    path: .agentlens/reports/bundle
```

Use `agentlens diff` and `agentlens diff-dashboard` when you have a known-good baseline trace and a candidate trace from the pull request.
