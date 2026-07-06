# Python Publishing

This guide covers the release path for the `agentlens-trace` Python package in `python/agentlens-trace/`.

The package is intentionally small and zero-dependency. It should only be published after the JavaScript CLI, trace schema, Python writer, adapter helpers, and release docs all pass the same repository gates.

## Package Shape

- Distribution name: `agentlens-trace`
- Import name: `agentlens_trace`
- Source root: `python/agentlens-trace/src`
- Core module: `agentlens_trace`
- Adapter module: `agentlens_trace.adapters`
- Runtime dependencies: none
- Current version source of truth: `package.json` and `python/agentlens-trace/pyproject.toml` must match

Published package entrypoints must support:

```bash
python -m agentlens_trace --out .agentlens/runs/python-package-demo.json
python -m agentlens_trace.adapters --out .agentlens/runs/python-adapters-demo.json
```

## Local Gates

Run these before publishing or tagging:

```bash
npm run check
npm test
npm run python:package
npm run python:publish:check
npm run release:audit
npm run verify
```

`npm run python:package` verifies the source-tree import path with `PYTHONPATH=python/agentlens-trace/src`.

`npm run python:publish:check` is the stronger publishing gate. It:

- checks `pyproject.toml` metadata against `package.json`
- checks `python/agentlens-trace/README.md` for package usage snippets
- installs `python/agentlens-trace` into a temporary target directory with `pip install --target`
- inspects installed `METADATA`
- inspects installed `RECORD`
- imports `agentlens_trace` and `agentlens_trace.adapters` from the installed package
- runs both package module entrypoints
- validates, evaluates, and scans both generated traces

The script first attempts a no-build-isolation install so missing local build backend issues are visible. If the local Python environment cannot import `setuptools.build_meta`, it retries with standard PEP 517 build isolation.

## Manual Build Check

For a release rehearsal, build a wheel and source distribution in the package directory:

```bash
cd python/agentlens-trace
python -m pip install --upgrade build twine
python -m build
python -m twine check --strict dist/*
```

Do not commit generated files under:

```text
python/agentlens-trace/build/
python/agentlens-trace/dist/
python/agentlens-trace/src/*.egg-info/
```

Those paths are ignored because they are local build artifacts.

## TestPyPI Rehearsal

Use TestPyPI before the first real PyPI release or after changing package metadata:

```bash
cd python/agentlens-trace
python -m build
python -m twine check --strict dist/*
python -m twine upload --repository testpypi dist/*
```

Then test installability in a clean environment:

```bash
python -m pip install --index-url https://test.pypi.org/simple/ --no-deps agentlens-trace==0.3.1
python -m agentlens_trace --out .agentlens/runs/python-package-demo.json
python -m agentlens_trace.adapters --out .agentlens/runs/python-adapters-demo.json
```

Only upload to PyPI after TestPyPI install and module entrypoint checks pass.

## Trusted Publishing

Prefer PyPI Trusted Publishing for GitHub Actions releases. It avoids storing long-lived PyPI API tokens in repository secrets.

The repository includes `.github/workflows/python-publish.yml` for trusted publishing.

Recommended release shape:

1. Cut a GitHub release tag such as `v0.3.1`.
2. GitHub Actions runs `.github/workflows/python-publish.yml`.
3. The workflow builds `python/agentlens-trace/dist/*`.
4. The workflow checks the distribution metadata.
5. The workflow publishes with PyPI Trusted Publishing.

The workflow supports two publishing modes:

- Manual TestPyPI rehearsal through `workflow_dispatch` with `target: testpypi`, using the `testpypi` GitHub environment and TestPyPI repository URL.
- Manual PyPI publishing through `workflow_dispatch` with `target: pypi`, or automatic PyPI publishing when a GitHub release is published, using the `pypi` GitHub environment.

Both upload jobs use `pypa/gh-action-pypi-publish@release/v1` with GitHub OIDC and `id-token: write`; no PyPI token secret is required or expected.

Configure trusted publishers before running the publishing jobs:

- PyPI project: `agentlens-trace`
- TestPyPI project: `agentlens-trace`
- Owner: `cnqiujunhu-dev`
- Repository: `agentlens`
- Workflow filename: `python-publish.yml`
- Environment names: `testpypi` for TestPyPI and `pypi` for PyPI

## Versioning Rules

- Keep `package.json` and `python/agentlens-trace/pyproject.toml` versions identical for now.
- Do not publish `agentlens-trace` from an untagged commit.
- Do not reuse a version number once uploaded to PyPI or TestPyPI.
- Update `CHANGELOG.md`, `docs/ROADMAP.md`, and this guide when package behavior changes.
- Run `npm run release:preflight` after the GitHub release tag exists.

## Rollback

PyPI package files cannot be replaced in-place. If a bad package is uploaded:

1. Yank the broken release on PyPI if install prevention is needed.
2. Fix the repository.
3. Bump to a new patch version.
4. Run the full local gate again.
5. Publish the new version.
6. Document the incident and fix in `CHANGELOG.md`.

## Current Limits

- `agentlens-trace` is PyPI-ready but not assumed to be published from this repository state.
- The package has explicit instrumentation helpers, not automatic framework instrumentation.
- The adapter helpers are framework-shaped and zero-dependency; they are not version-specific LangChain, LlamaIndex, or CrewAI plugins yet.
- The publishing workflow will fail at the upload step until the matching PyPI and TestPyPI trusted publishers are configured.

## Sources Reviewed

- Python Packaging User Guide: https://packaging.python.org/guides/publishing-package-distribution-releases-using-github-actions-ci-cd-workflows/
- Python Packaging tool recommendations: https://packaging.python.org/guides/tool-recommendations/
- PyPI Trusted Publishers: https://docs.pypi.org/trusted-publishers/
- PyPI publishing with a Trusted Publisher: https://docs.pypi.org/trusted-publishers/using-a-publisher/
- Twine documentation: https://twine.readthedocs.io/
