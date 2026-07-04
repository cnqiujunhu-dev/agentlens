# Contributing to AgentLens

AgentLens is early. The best contributions are small, testable improvements that make agent traces easier to capture, replay, evaluate, or share.

## Good First Contributions

- Improve trace examples.
- Add eval assertion cases.
- Add dashboard usability fixes.
- Add framework adapter examples.
- Improve docs where setup or concepts are unclear.
- Pick a scoped task from [docs/ROADMAP.md](docs/ROADMAP.md).

## Development

```bash
node ./bin/agentlens.js demo --out .agentlens/runs/demo.json
node ./bin/agentlens.js inspect .agentlens/runs/demo.json
node ./bin/agentlens.js replay .agentlens/runs/demo.json
node ./bin/agentlens.js eval .agentlens/runs/demo.json --config evals/default.json
node ./bin/agentlens.js dashboard .agentlens/runs/demo.json --out .agentlens/reports/demo.html
```

## Pull Requests

- Keep changes focused.
- Add or update examples when behavior changes.
- Keep the CLI output readable.
- Avoid adding dependencies unless they remove clear complexity.
- Document any trace schema changes.

## Design Principles

- Local-first by default.
- Plain files over hidden services.
- Framework-neutral integrations.
- CI-friendly output and exit codes.
- Explain failures clearly.
