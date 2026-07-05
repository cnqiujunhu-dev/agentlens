# AgentLens Release Checklist

Use this checklist before publishing the repository, cutting a release tag, or asking for public feedback.

## Release Gate

The public repo is not launch-ready until all of these are true:

- `npm run verify` passes locally.
- `npm run release:audit` passes locally.
- `npm pack --dry-run` includes the CLI, source, schemas, docs, README, license, and screenshot assets.
- `.github/workflows/ci.yml` passes on GitHub.
- The README shows the product, the five-minute demo, the GitHub Action, the roadmap, and launch materials.
- A current demo screenshot or GIF is linked from the README.
- The GitHub repo has a clear description, topics, license, issues, pull request template, support policy, code of conduct, and security policy.

## Local Validation

Run these from the repository root:

```bash
npm run verify
npm run doctor
npm run validate:demo
npm run scan:demo
npm run bundle:demo
npm run share:demo
npm run release:audit
npm run release:preflight:local
npm pack --dry-run
```

Expected result:

- Syntax checks pass.
- Unit tests pass.
- Demo traces, MCP demos, JSONL demos, diff dashboards, launch artifacts, and static dashboards generate.
- `agentlens doctor` reports no failed checks.
- `agentlens validate` reports no trace or eval config errors.
- `agentlens scan` reports no blocking high or critical findings for the demo trace.
- `agentlens bundle` writes a static run bundle index and per-trace dashboards.
- `agentlens share` writes a redacted share bundle.
- Release audit prints `AgentLens release audit passed`.
- Local release preflight warns only for expected unpublished-release gaps when run before pushing or tagging.
- Dry-run packaging includes `README.md`, `LICENSE`, `bin/agentlens.js`, `src/index.js`, and `docs/assets/dashboard-screenshot.png`.

## Demo Assets

Generate launch artifacts:

```bash
npm run launch:demo
npm run release:gif
npm run diff:dashboard
```

Open these files before recording:

- `.agentlens/launch/support-agent.html`
- `.agentlens/launch/mcp-policy.html`
- `.agentlens/launch/mcp-stdio.html`
- `.agentlens/launch/langgraph-style.html`
- `.agentlens/launch/unsafe-agent.html`
- `.agentlens/reports/diff-demo.html`
- `docs/assets/agentlens-demo.gif`

Follow [DEMO_RECORDING.md](DEMO_RECORDING.md) for the shot list and export checks.

## GitHub Repository Setup

Use this repository metadata at launch:

- Repository: `https://github.com/cnqiujunhu-dev/agentlens`
- Description: `Local-first DevTools for AI agents: trace, replay, eval, redact, and share model/tool-call runs.`
- Topics: `ai-agent`, `llm`, `observability`, `evals`, `mcp`, `devtools`, `ci`.
- Website: leave blank until there is a real project site.
- Features: enable Issues, disable Wiki unless it has a maintainer workflow.
- Security: keep `SECURITY.md` visible and do not ask users to report sensitive traces publicly.

Recommended pinned links:

- README quick demo.
- Dashboard screenshot or launch GIF.
- GitHub Action documentation.
- MCP adapter documentation.
- Launch plan or roadmap.

## Release Tag

Only tag after local validation and the GitHub workflow pass:

```bash
gh auth refresh -s workflow
git push origin main
git tag v0.2.0
git push origin v0.2.0
```

After tagging and configuring `origin`, run the strict gate:

```bash
npm run release:preflight
```

Use the release notes from [LAUNCH_COPY.md](LAUNCH_COPY.md). Keep the wording scoped to the MVP: local-first tracing, replay, evals, dashboards, CI, MCP policy checks, redaction, JSONL traces, and provider-style adapters.

## Public Launch

Before posting publicly:

- Confirm all README links work on GitHub.
- Confirm the screenshot or GIF renders in the README.
- Confirm the installation and demo commands work from a clean clone.
- Confirm `agentlens init` creates starter evals and a GitHub Action example.
- Confirm the first issue templates route bugs, adapter requests, and eval rule requests.
- Confirm the PR template asks for validation and trace safety.
- Prepare the launch post from [LAUNCH_POST.md](LAUNCH_POST.md).

## Current Release Status

As of the latest public release:

- Public GitHub repository: `https://github.com/cnqiujunhu-dev/agentlens`.
- Default branch: `main`.
- Latest release tag: `v0.2.0`.
- Strict release preflight should pass before any new release is published.
