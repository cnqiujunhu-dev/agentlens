# Run Bundles

`agentlens bundle` turns a directory of AgentLens trace JSON files into a static review bundle. It writes an `index.html`, `manifest.json`, and one dashboard per valid trace.

Use it when you want to upload an artifact from CI, attach a compact run set to an issue, or review multiple agent traces without starting a local server.

## CLI

```bash
agentlens bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,timeline
```

Output:

```text
.agentlens/reports/bundle/index.html
.agentlens/reports/bundle/manifest.json
.agentlens/reports/bundle/001-run_....html
.agentlens/reports/bundle/002-run_....html
```

The index shows trace status, event counts, scan status, source file path, links to individual dashboards, and invalid trace files with validation errors. The manifest exposes the same bundle inventory as JSON for PR bots, artifact indexes, and other automation.

## Manifest

Every bundle includes `manifest.json` with a stable schema marker:

```json
{
  "schemaVersion": "agentlens.run-bundle.v1",
  "summary": {
    "total": 2,
    "valid": 1,
    "invalid": 1,
    "failed": 0,
    "scanFindings": 0
  },
  "items": []
}
```

Each valid item includes its source path, dashboard filename, trace id, app, name, status, event count, error count, scan status, and scan finding count. Invalid trace files include their source path and validation error.

## GitHub Actions Artifact

```yaml
- name: Run AgentLens evals
  id: agentlens
  uses: cnqiujunhu-dev/agentlens@v0.3.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    bundle: .agentlens/reports/bundle
    bundle-sections: summary,timeline

- name: Upload AgentLens run bundle
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: agentlens-run-bundle
    path: ${{ steps.agentlens.outputs.bundle }}
```

For PR review order, compact dashboard sections, and shareable filtered links, see [Dashboard Review Workflow](DASHBOARD_REVIEW.md).

## API

```js
import { writeRunBundle } from "agentlens";

const result = writeRunBundle({
  runsDir: ".agentlens/runs",
  outDir: ".agentlens/reports/bundle",
  sections: "summary,timeline"
});

console.log(result.index);
console.log(result.manifest);
```

## Notes

- The bundle is static HTML with no external assets.
- Each valid trace gets an AgentLens dashboard. Use `--sections summary,timeline` for compact PR artifacts, or omit `--sections` for the full report.
- `manifest.json` mirrors the index inventory for automation that should not parse HTML.
- Invalid trace JSON files are listed in the index instead of aborting the whole bundle.
- Scan findings are generated from the local trace content at bundle time.
