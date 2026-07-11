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
        uses: cnqiujunhu-dev/agentlens@v0.3.0
        with:
          runs: .agentlens/runs
          config: evals/default.json
          scan-fail-on: high
          bundle: .agentlens/reports/bundle

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
| `bundle` | empty | Optional directory to write a static AgentLens run bundle. |
| `bundle-sections` | `summary,scan,tool-calls,workflow,filters,timeline` | Dashboard sections used when `bundle` is set. |
| `review-baseline` | empty | Optional baseline trace file for a before/after review pack. |
| `review-candidate` | empty | Optional candidate trace file for a before/after review pack. |
| `review` | empty | Optional directory to write a review pack. Must be used with `review-baseline` and `review-candidate`. |
| `review-sections` | `summary,scan,tool-calls,workflow,filters,timeline` | Dashboard sections used for the review pack run bundle. |
| `review-fail-on-failure` | `false` | Fail the action when the generated review pack reports failing eval or scan gates. |
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
| `bundle` | Directory containing the generated run bundle when `bundle` is set. |
| `bundle-manifest` | Path to the generated run bundle `manifest.json` when `bundle` is set. |
| `review` | Directory containing the generated review pack when review inputs are set. |
| `review-pr-comment` | Path to the generated review PR comment Markdown. |
| `review-bundle` | Directory containing the generated review run bundle. |
| `review-bundle-manifest` | Path to the generated review run bundle `manifest.json`. |
| `review-manifest` | Path to the generated review pack `review.json`. |
| `review-workflow-chains` | Candidate chain event count from the review diff. |
| `review-workflow-tasks` | Candidate task event count from the review diff. |
| `review-workflow-errors` | Candidate workflow error marker count from the review diff. |
| `review-workflow-chain-delta` | Candidate minus baseline chain event delta from the review diff. |
| `review-workflow-task-delta` | Candidate minus baseline task event delta from the review diff. |
| `review-workflow-error-delta` | Candidate minus baseline workflow error marker delta from the review diff. |
| `review-workflow-regressions` | Count of workflow regressions detected from chain, task, and workflow error deltas. |

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
  uses: cnqiujunhu-dev/agentlens@v0.3.0
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
  uses: cnqiujunhu-dev/agentlens@v0.3.0
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

## Run Bundle Artifact

Use `bundle` when you want the action to generate a static review bundle even if evals or scans fail:

```yaml
- name: Run AgentLens evals
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.3.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    bundle: .agentlens/reports/bundle
    bundle-sections: summary,scan,tool-calls,workflow,filters,timeline

- name: Upload AgentLens run bundle
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: agentlens-run-bundle
    path: ${{ steps.agentlens.outputs.bundle }}
```

The generated bundle includes `index.html`, `manifest.json`, and one dashboard per valid trace. The `bundle-manifest` output points directly to the manifest for later workflow steps.

For a complete PR review handoff with uploaded dashboard bundles, compact sections, and filtered view links, see [Dashboard Review Workflow](DASHBOARD_REVIEW.md).

## Review Pack Artifact

Use `review-baseline`, `review-candidate`, and `review` when a workflow has before/after traces and should produce a static PR review pack:

```yaml
- name: Run AgentLens evals and review
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.3.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    review-baseline: .agentlens/baseline/refund.json
    review-candidate: .agentlens/candidate/refund.json
    review: .agentlens/reports/review
    review-sections: summary,scan,tool-calls,workflow,timeline

- name: Upload AgentLens review pack
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: agentlens-review
    path: ${{ steps.agentlens.outputs.review }}
```

The review pack includes copied traces, `eval.json`, `review.json`, `reports/pr-comment.md`, `reports/diff.html`, `reports/agentlens-ci.sarif`, and `reports/bundle/index.html`. The `review-manifest` output points directly to the machine-readable manifest for later workflow steps, and it can be checked with `agentlens validate review`. The generated PR comment and step summary include a trace diff section with workflow chain, task, and error deltas so reviewers can see workflow regressions before opening the HTML dashboard. Add `review-fail-on-failure: true` when the before/after review should fail the job if the candidate violates eval or scan gates.

Workflow outputs are available for downstream automation:

```yaml
- name: Route workflow regression
  if: steps.agentlens.outputs.review-workflow-regressions != '0'
  run: |
    echo "Manifest: ${{ steps.agentlens.outputs.review-manifest }}"
    echo "Task delta: ${{ steps.agentlens.outputs.review-workflow-task-delta }}"
    echo "Workflow errors: ${{ steps.agentlens.outputs.review-workflow-errors }}"
```

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
  uses: cnqiujunhu-dev/agentlens@v0.3.0
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
