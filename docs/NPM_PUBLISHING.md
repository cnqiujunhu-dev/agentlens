# AgentLens npm Publishing

This guide covers the JavaScript package and CLI publishing path.

## Package Identity

- npm package name: `agentlens-devtools`
- CLI binary: `agentlens`
- Repository: `https://github.com/cnqiujunhu-dev/agentlens`
- License: Apache-2.0

The npm package name is intentionally not `agentlens`. As of 2026-07-07, `agentlens` is already occupied on the public npm registry by an unrelated package. Use `agentlens-devtools` for package installs and imports, while keeping `agentlens` as the CLI command.

## First-Run Commands

After the npm package is published:

```bash
npm exec --package agentlens-devtools -- agentlens quickstart --python
npm install -D agentlens-devtools
npx agentlens doctor
```

For JavaScript API usage:

```js
import { createRun, writeTrace } from "agentlens-devtools";
```

Until the npm package is published, use a repository clone:

```bash
git clone https://github.com/cnqiujunhu-dev/agentlens.git
cd agentlens
npm install
node ./bin/agentlens.js quickstart --python
```

## Pre-Publish Gates

Run these from the repository root before publishing:

```bash
npm run verify
npm run release:audit
npm run pack:smoke
npm run npm:publish:check
npm pack --dry-run
npm publish --dry-run
```

`npm run pack:smoke` is the strongest local install gate. It packs the current repository, installs the tarball into a clean temporary project, runs `agentlens quickstart --python`, validates the generated trace, exports batch OTLP, and imports the public JavaScript API from `agentlens-devtools`.

`npm run npm:publish:check` is the strongest local publish gate. It validates package metadata, README/API install snippets, packed file contents from `npm pack --dry-run --json`, and `npm publish --dry-run --json` output. It fails if npm reports package auto-correction, such as bin field cleanup, because that means the published package may differ from the repository manifest.

## Publish

Use a real npm account with publish access to `agentlens-devtools`:

```bash
npm login
npm publish --access public
```

If two-factor auth is enabled for publishes, follow the npm prompt.

## Post-Publish Smoke Test

Run these from a temporary directory, not from the repository clone:

```bash
npm view agentlens-devtools version
npm exec --yes --package agentlens-devtools@0.3.0 -- agentlens quickstart --python
node --input-type=module -e "const m = await import('agentlens-devtools'); if (!m.createRun || !m.runQuickstart) throw new Error('missing exports'); console.log('agentlens-devtools ok')"
```

Confirm the quickstart output includes:

- `.agentlens/quickstart/runs/demo.json`
- `.agentlens/quickstart/reports/dashboard.html`
- `.agentlens/quickstart/reports/bundle/index.html`
- `.agentlens/quickstart/reports/pr-comment.md`
- `.agentlens/quickstart/share/demo/summary.md`

## Naming Rules

- Do not document `npm install agentlens`; that installs an unrelated package.
- Keep the CLI binary as `agentlens` so local commands remain short.
- Use `npm exec --package agentlens-devtools -- agentlens ...` for one-shot commands that must not resolve the unrelated `agentlens` package.
- Use `npm install -D agentlens-devtools` before documenting `npx agentlens ...` in a project-local workflow.
