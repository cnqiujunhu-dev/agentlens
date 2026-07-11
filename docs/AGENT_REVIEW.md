# Agent Review Packs

`agentlens review` turns a baseline trace and a candidate trace into a pull-request-ready review pack.

```bash
agentlens review .agentlens/runs/baseline.json .agentlens/runs/candidate.json \
  --config evals/default.json \
  --out .agentlens/review
```

Use it when a code change alters agent behavior and reviewers need static evidence without rerunning the model. The command copies both traces into an isolated review folder, evaluates them with the selected policy, scans them by default, renders a before/after diff, and writes Markdown that can be pasted or upserted into a pull request.

Generated files:

- `.agentlens/review/runs/baseline.json`: copied baseline trace.
- `.agentlens/review/runs/candidate.json`: copied candidate trace.
- `.agentlens/review/eval.json`: copied eval policy used for the review.
- `.agentlens/review/review.json`: machine-readable review manifest with status, generated file paths, CI counts, workflow deltas, and bundle links.
- `.agentlens/review/reports/ci-summary.md`: GitHub Actions step summary body with trace diff workflow regressions.
- `.agentlens/review/reports/pr-comment.md`: stable PR comment body with the `agentlens-ci-comment` marker and workflow diff summary.
- `.agentlens/review/reports/ci-report.txt`: plain text CI report.
- `.agentlens/review/reports/diff.txt`: before/after trace diff.
- `.agentlens/review/reports/diff.html`: static diff dashboard.
- `.agentlens/review/reports/agentlens-ci.sarif`: scan findings for GitHub code scanning when scan is enabled.
- `.agentlens/review/reports/bundle/index.html`: static run bundle for reviewer handoff.

By default, `agentlens review` generates artifacts and exits successfully even when the candidate fails eval or scan gates. In CI, add `--fail-on-failure`:

```bash
agentlens review .agentlens/runs/baseline.json .agentlens/runs/candidate.json \
  --config evals/default.json \
  --out .agentlens/review \
  --fail-on-failure
```

Useful options:

- `--no-scan`: skip security scan and SARIF generation.
- `--json`: print the same machine-readable manifest that is written to `review.json`.
- `--scan-fail-on medium`: lower the scan failure threshold.
- `--sections summary,scan,timeline`: reduce dashboard sections for compact artifacts.
- `--artifact-url <url>`: add an uploaded bundle link to `pr-comment.md`.
- `--sarif-url <url>`: add an uploaded SARIF link to `pr-comment.md`.

This is the production version of the regression PR demo. The demo still exists for screenshots and launch material, while `agentlens review` is meant for real before/after traces from application tests, eval datasets, or CI jobs.

The composite GitHub Action can generate the same pack with `review-baseline`, `review-candidate`, and `review` inputs. See [GITHUB_ACTION.md](GITHUB_ACTION.md#review-pack-artifact).
