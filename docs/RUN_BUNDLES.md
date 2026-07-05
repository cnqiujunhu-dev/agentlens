# Run Bundles

`agentlens bundle` turns a directory of AgentLens trace JSON files into a static review bundle. It writes an `index.html` plus one dashboard per valid trace.

Use it when you want to upload an artifact from CI, attach a compact run set to an issue, or review multiple agent traces without starting a local server.

## CLI

```bash
agentlens bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,timeline
```

Output:

```text
.agentlens/reports/bundle/index.html
.agentlens/reports/bundle/001-run_....html
.agentlens/reports/bundle/002-run_....html
```

The index shows trace status, event counts, scan status, source file path, links to individual dashboards, and invalid trace files with validation errors.

## GitHub Actions Artifact

```yaml
- name: Build AgentLens run bundle
  run: node ./bin/agentlens.js bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,timeline

- name: Upload AgentLens run bundle
  uses: actions/upload-artifact@v4
  with:
    name: agentlens-run-bundle
    path: .agentlens/reports/bundle
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
```

## Notes

- The bundle is static HTML with no external assets.
- Each valid trace gets an AgentLens dashboard. Use `--sections summary,timeline` for compact PR artifacts, or omit `--sections` for the full report.
- Invalid trace JSON files are listed in the index instead of aborting the whole bundle.
- Scan findings are generated from the local trace content at bundle time.
