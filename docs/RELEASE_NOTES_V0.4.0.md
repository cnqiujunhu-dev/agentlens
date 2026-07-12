# AgentLens v0.4.0 Release Notes Draft

AgentLens v0.4.0 is the review-automation release. It focuses on making agent behavior changes easy to inspect in GitHub pull requests without requiring a hosted account or a long-running dashboard.

## Highlights

- Workflow Review signals are now first-class in dashboards, eval rules, diff reports, PR comments, and run bundle manifests.
- `agentlens review` writes a complete before/after review pack with copied traces, eval policy, CI summary, stable PR comment Markdown, SARIF, diff dashboard, run bundle, README, and machine-readable `review.json`.
- Review manifests have a JSON Schema, runtime validator, CLI validation command, and GitHub Action output for downstream PR bots.
- Review manifests now carry provenance metadata: generation time, scan options, dashboard sections, artifact URL, and SARIF URL.
- The composite GitHub Action exposes review status, manifest path, provenance links, workflow counts, workflow deltas, and workflow regression count as outputs.
- `agentlens init --review` scaffolds a copyable before/after PR review workflow with manifest checks, artifact upload, and marker-based PR comment upsert.
- Review pack README files now show provenance metadata, uploaded links, generated files, diff regressions, and an option-preserving re-run command.
- Python framework bridge helpers have broader fixture coverage for LangChain-style, LlamaIndex-style, and CrewAI-style payloads.
- Launch materials now include a copyable PR comment example for README, release, and social demos.

## Who Should Try It

- Teams reviewing agent behavior changes in GitHub pull requests.
- Developers debugging one failed tool-using agent run without setting up a hosted observability platform.
- RAG and agent teams that want local CI gates for citations, cost, latency, workflow boundaries, scan findings, and risky tool calls.
- Maintainers who need static artifacts they can attach to issues, PRs, support threads, or incident notes.

## Quick Demo

```bash
git clone https://github.com/cnqiujunhu-dev/agentlens.git
cd agentlens
npm install
node ./bin/agentlens.js quickstart --python
npm run demo:regression-pr
```

Open:

- `.agentlens/quickstart/reports/dashboard.html`
- `.agentlens/quickstart/reports/bundle/index.html`
- `.agentlens/regression-pr/reports/pr-comment.md`
- `.agentlens/regression-pr/reports/diff.html`
- `.agentlens/regression-pr/reports/bundle/index.html`

## GitHub Action Example

```yaml
- name: Run AgentLens evals and review
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.4.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    review-baseline: .agentlens/baseline/refund.json
    review-candidate: .agentlens/candidate/refund.json
    review: .agentlens/reports/review
    review-sections: summary,scan,tool-calls,workflow,timeline
    artifact-url: https://github.com/acme/app/actions/runs/123/artifacts/456

- name: Route agent regression
  if: steps.agentlens.outputs.review-workflow-regressions != '0'
  run: |
    echo "Review status: ${{ steps.agentlens.outputs.review-status }}"
    echo "Manifest: ${{ steps.agentlens.outputs.review-manifest }}"
    echo "Task delta: ${{ steps.agentlens.outputs.review-workflow-task-delta }}"
```

## Validation

Before tagging:

```bash
npm run verify
npm run release:audit
npm run npm:publish:check
npm run python:publish:check
```

The release should ship only after local verification and the GitHub Actions `main` workflow are green.
