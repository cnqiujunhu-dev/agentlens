# GitHub Action

AgentLens ships a composite GitHub Action for running trace evals in CI.

```yaml
name: agentlens

on:
  pull_request:
  push:

jobs:
  agentlens:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate agent traces
        run: npm test

      - name: Run AgentLens evals
        uses: your-org/agentlens@v0
        with:
          runs: .agentlens/runs
          config: evals/default.json
```

The action fails the job when any trace fails its eval config or when no trace files are found.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `runs` | `.agentlens/runs` | Directory containing AgentLens trace JSON files. |
| `config` | `evals/default.json` | Eval config JSON file. |
| `node-version` | `20` | Node.js version used to run AgentLens. |
| `summary` | `true` | Write a Markdown report to the GitHub Actions step summary. |

## Step Summary

By default, the action appends a Markdown report to `GITHUB_STEP_SUMMARY`. Disable it when you only want logs:

```yaml
- name: Run AgentLens evals
  uses: your-org/agentlens@v0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    summary: false
```

## Local Repository Smoke Test

Inside this repository, CI also tests the action with:

```yaml
- name: GitHub Action smoke test
  uses: ./
  with:
    runs: .agentlens/runs
    config: evals/default.json
```
