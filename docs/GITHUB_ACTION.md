# GitHub Action

AgentLens ships a composite GitHub Action for running trace evals and local scan gates in CI.

```yaml
name: agentlens

on:
  pull_request:
  push:

jobs:
  agentlens:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      issues: write
      pull-requests: read
    steps:
      - uses: actions/checkout@v7

      - name: Generate agent traces
        run: npm test

      - name: Run AgentLens evals
        id: agentlens
        uses: cnqiujunhu-dev/agentlens@v0.2.0
        with:
          runs: .agentlens/runs
          config: evals/default.json
          scan-fail-on: high

      - name: Use AgentLens result
        run: echo "AgentLens status: ${{ steps.agentlens.outputs.status }}"
```

The action fails the job when any trace fails its eval config, any enabled scan reaches the configured severity, or when no trace files are found.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `runs` | `.agentlens/runs` | Directory containing AgentLens trace JSON files. |
| `config` | `evals/default.json` | Eval config JSON file. |
| `node-version` | `22` | Node.js version used to run AgentLens. |
| `summary` | `true` | Write a Markdown report to the GitHub Actions step summary. |
| `pr-comment` | empty | Optional path to write Markdown suitable for a GitHub PR comment. |
| `scan` | `true` | Run the local AgentLens security scan after evals. |
| `scan-fail-on` | `high` | Lowest scan severity that fails the action: `low`, `medium`, `high`, `critical`, or `none`. |
| `sarif` | empty | Optional path for combined SARIF scan findings. Requires `scan: true`. |

## Outputs

| Output | Description |
| --- | --- |
| `status` | `PASS` when all traces pass and at least one trace is found; otherwise `FAIL`. |
| `total` | Number of trace files evaluated. |
| `passed` | Number of trace files that passed. |
| `failed` | Number of trace files that failed. |

Use these outputs in later steps:

```yaml
- name: Notify on agent regression
  if: steps.agentlens.outputs.status != 'PASS'
  run: echo "AgentLens found ${{ steps.agentlens.outputs.failed }} failing traces"
```

## Step Summary

By default, the action appends a Markdown report to `GITHUB_STEP_SUMMARY`. Disable it when you only want logs:

```yaml
- name: Run AgentLens evals
  uses: cnqiujunhu-dev/agentlens@v0.2.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    summary: false
    scan: false
```

## PR Comment Markdown

Use `pr-comment` when you want the action to write a stable Markdown body that another step can publish or upsert on a pull request:

```yaml
- name: Run AgentLens evals
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.2.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    pr-comment: .agentlens/reports/agentlens-pr-comment.md

- name: Upsert PR comment
  if: always() && github.event_name == 'pull_request'
  env:
    GH_TOKEN: ${{ github.token }}
    REPO: ${{ github.repository }}
    PR_NUMBER: ${{ github.event.pull_request.number }}
  run: |
    marker='<!-- agentlens-ci-comment -->'
    body_file='.agentlens/reports/agentlens-pr-comment.md'
    body="$(cat "$body_file")"
    comment_id="$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" --jq ".[] | select(.body | contains(\"$marker\")) | .id" | head -n 1)"

    if [[ -n "$comment_id" ]]; then
      gh api --method PATCH "repos/$REPO/issues/comments/$comment_id" -f body="$body"
    else
      gh api --method POST "repos/$REPO/issues/$PR_NUMBER/comments" -f body="$body"
    fi
```

The generated body includes `<!-- agentlens-ci-comment -->` so the workflow can update the existing AgentLens comment instead of posting duplicates.

## SARIF Upload

For GitHub code scanning, export SARIF with the CLI and upload it in a later step:

```yaml
- name: Export AgentLens SARIF
  run: node ./bin/agentlens.js scan .agentlens/runs/demo.json --sarif .agentlens/reports/agentlens-scan.sarif --fail-on none

- name: Upload AgentLens SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: .agentlens/reports/agentlens-scan.sarif
```

For all traces in a run directory, let the AgentLens Action write combined SARIF and upload it:

```yaml
- name: Run AgentLens evals
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.2.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    scan-fail-on: none
    sarif: .agentlens/reports/agentlens-ci.sarif

- name: Upload AgentLens SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: .agentlens/reports/agentlens-ci.sarif
```

## Local Repository Smoke Test

Inside this repository, CI also tests the action with:

```yaml
- name: GitHub Action smoke test
  id: agentlens-action
  uses: ./
  with:
    runs: .agentlens/runs
    config: evals/default.json
    scan-fail-on: high
    sarif: .agentlens/reports/agentlens-ci.sarif
```
