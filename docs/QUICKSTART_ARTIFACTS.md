# Quickstart Artifacts

`agentlens quickstart` creates an isolated, launch-ready artifact pack under `.agentlens/quickstart/`.

```bash
agentlens quickstart
agentlens quickstart --python
```

Use it when you want to evaluate AgentLens from a clean clone without mixing demo traces into your own `.agentlens/runs` directory. The command initializes the workspace, writes a passing demo trace, evaluates it, scans it, renders review artifacts, and prints the next commands to run.

Generated files:

- `.agentlens/quickstart/runs/demo.json`: AgentLens trace file.
- `.agentlens/quickstart/reports/dashboard.html`: static dashboard for the trace.
- `.agentlens/quickstart/reports/eval.txt`: eval report from `.agentlens/evals/default.json`.
- `.agentlens/quickstart/reports/scan.txt`: security and quality scan report.
- `.agentlens/quickstart/reports/ci-summary.md`: GitHub Actions summary Markdown.
- `.agentlens/quickstart/reports/pr-comment.md`: stable PR comment body with the `agentlens-ci-comment` marker.
- `.agentlens/quickstart/reports/trace.otlp.json`: OpenTelemetry/OpenInference-style OTLP JSON export.
- `.agentlens/quickstart/reports/bundle/index.html`: static run bundle for review artifacts.
- `.agentlens/quickstart/share/demo/summary.md`: redacted share bundle summary for issues or support threads.
- `.agentlens/examples/github-action.yml`: copyable GitHub Action template with run bundle upload and marker-based PR comment upsert.

With `--python`, quickstart also writes the Python starter from `agentlens init --python`:

- `.agentlens/python/agentlens_trace.py`
- `.agentlens/python/basic_run.py`
- `.agentlens/examples/python-github-action.yml`: Python trace generation plus the same run bundle upload and PR comment upsert pattern.

For before/after review packs, run `agentlens init --review` to add `.agentlens/examples/review-github-action.yml` with review manifest checks, artifact upload, and PR comment upsert.

The quickstart pack is intentionally separate from `.agentlens/runs`. That makes it safe to run in a repository that already contains passing or failing traces while still demonstrating the same CI, dashboard, bundle, share, scan, and OTLP paths used by real projects.
