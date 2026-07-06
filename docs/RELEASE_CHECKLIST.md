# AgentLens Release Checklist

Use this checklist before publishing the repository, cutting a release tag, or asking for public feedback.

## Release Gate

The public repo is not launch-ready until all of these are true:

- `npm run verify` passes locally.
- `npm run release:audit` passes locally.
- `npm pack --dry-run` includes the CLI, source, schemas, docs, README, license, and screenshot assets.
- `package.json` uses `agentlens-devtools` as the npm package name while exposing the `agentlens` CLI binary.
- `.github/workflows/ci.yml` passes on GitHub.
- [NPM_PUBLISHING.md](NPM_PUBLISHING.md) is current before publishing the JavaScript package.
- [PYTHON_PUBLISHING.md](PYTHON_PUBLISHING.md) is current before publishing `agentlens-trace`.
- `.github/workflows/python-publish.yml` is current before configuring PyPI or TestPyPI Trusted Publishers.
- The README shows the product, the five-minute demo, the GitHub Action, the roadmap, and launch materials.
- A current demo screenshot or GIF is linked from the README.
- The GitHub repo has a clear description, topics, license, issues, pull request template, support policy, code of conduct, and security policy.

## Local Validation

Run these from the repository root:

```bash
npm run verify
node ./bin/agentlens.js quickstart --python
npm run python:package
npm run python:publish:check
npm run pack:smoke
npm run npm:publish:check
PYTHONPATH=python/agentlens-trace/src python -m agentlens_trace.adapters --out .agentlens/runs/python-adapters-demo.json
npm run doctor
npm run validate:demo
npm run scan:demo
npm run diff:demo
node ./bin/agentlens.js review .agentlens/runs/demo.json .agentlens/runs/failing-demo.json --config evals/default.json --out .agentlens/review
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
- `agentlens quickstart` writes an isolated `.agentlens/quickstart/` artifact pack.
- `npm run python:package` verifies the `agentlens-trace` package import path, `agentlens_trace.adapters`, and demo trace.
- `npm run python:publish:check` verifies local installability, installed package metadata, installed package files, and installed package entrypoints.
- `npm run pack:smoke` verifies the packed npm tarball installs into a clean temporary project, runs `agentlens quickstart --python`, validates the generated trace, exports batch OTLP, and imports the public API from `agentlens-devtools`.
- `npm run npm:publish:check` verifies npm package metadata, packed files, publish dry-run output, and that npm does not auto-correct the package manifest.
- `.github/workflows/python-publish.yml` builds distributions, runs Python smoke checks, and publishes only through Trusted Publishing.
- `agentlens doctor` reports no failed checks.
- `agentlens validate` reports no trace or eval config errors.
- `agentlens scan` reports no blocking high or critical findings for the demo trace.
- `agentlens review` writes a PR-ready baseline/candidate review pack.
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
git tag v0.3.0
git push origin v0.3.0
```

After tagging and configuring `origin`, run the strict gate:

```bash
npm run release:preflight
```

Use the release notes from [LAUNCH_COPY.md](LAUNCH_COPY.md). Keep the wording scoped to the MVP: local-first tracing, replay, evals, dashboards, CI, MCP policy checks, redaction, JSONL traces, and provider-style adapters.

For JavaScript package publishing, follow [NPM_PUBLISHING.md](NPM_PUBLISHING.md). Publish the npm package as `agentlens-devtools`; keep the CLI binary as `agentlens`. Do not document `npm install agentlens`, because that npm package name is already occupied by an unrelated package.

After the first npm publish, smoke test from a temporary directory:

```bash
npm view agentlens-devtools version
npm exec --yes --package agentlens-devtools@0.3.0 -- agentlens quickstart --python
node --input-type=module -e "const m = await import('agentlens-devtools'); if (!m.createRun || !m.runQuickstart) throw new Error('missing exports')"
```

For Python package publishing, follow [PYTHON_PUBLISHING.md](PYTHON_PUBLISHING.md). Rehearse on TestPyPI before the first real PyPI upload or after package metadata changes. Prefer PyPI Trusted Publishing through GitHub Actions instead of long-lived PyPI API tokens.

Configure PyPI and TestPyPI trusted publishers to match `.github/workflows/python-publish.yml`, the `pypi` and `testpypi` GitHub environments, and the `agentlens-trace` project before running the publish jobs.

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
- Latest published release tag: `v0.3.0`.
- Current release candidate tag: next patch or minor release.
- Strict release preflight should pass before any new release is published.
