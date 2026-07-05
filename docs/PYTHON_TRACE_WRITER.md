# Python Trace Writer

AgentLens is a JavaScript package, but the trace format is plain JSON. The Python trace writer example shows how Python-heavy agent, RAG, notebook, and evaluation projects can write AgentLens-compatible traces without adopting a hosted observability backend or adding a Python dependency. It includes sync and async wrappers for explicit model-call instrumentation.

## Quick Start

Run the Python demo and then validate, evaluate, scan, and export the generated trace:

```bash
npm run demo:python
```

The demo writes:

- `.agentlens/runs/python-basic-demo.json`
- `.agentlens/runs/python-async-demo.json`
- `.agentlens/reports/python-basic-demo.otlp.json`
- `.agentlens/reports/python-async-demo.otlp.json`

You can also run the Python file directly:

```bash
python examples/python-basic-run.py --out .agentlens/runs/python-basic-demo.json
python examples/python-async-run.py --out .agentlens/runs/python-async-demo.json
node ./bin/agentlens.js validate trace .agentlens/runs/python-basic-demo.json
node ./bin/agentlens.js eval .agentlens/runs/python-basic-demo.json --config evals/default.json
node ./bin/agentlens.js dashboard .agentlens/runs/python-basic-demo.json --out .agentlens/reports/python-basic-demo.html
node ./bin/agentlens.js otel .agentlens/runs/python-basic-demo.json --out .agentlens/reports/python-basic-demo.otlp.json
```

## Minimal Usage

Copy `examples/python_trace_writer/agentlens_trace.py` into a Python project, or import it from this repository when experimenting. If you import from this repository outside `examples/python-basic-run.py`, set `PYTHONPATH=examples`.

```python
from python_trace_writer import AgentLensRun, init_workspace, trace_llm_call

init_workspace()

run = AgentLensRun(app="support-agent", name="refund-answer")

def call_model(input):
    return {
        "content": "Refunds are available within 30 days.",
        "citations": ["refund-policy"],
        "usage": {
            "inputTokens": 12,
            "outputTokens": 9,
            "totalTokens": 21,
            "costUsd": 0.0002,
        },
    }

trace_llm_call(
    run,
    "final-answer",
    {"messages": [{"role": "user", "content": "Can I refund this order?"}]},
    call_model,
    provider="my-provider",
    model="my-model",
)

run.finish("passed")
run.write(".agentlens/runs/refund-answer.json")
```

## Async Usage

Use `trace_async_llm_call` when your model, retrieval, or tool code already runs through `asyncio`:

```python
import asyncio

from python_trace_writer import AgentLensRun, init_workspace, trace_async_llm_call

init_workspace()

run = AgentLensRun(app="support-agent", name="async-refund-answer")

async def call_model(input):
    await asyncio.sleep(0.01)
    return {
        "content": "Async traces work with the same AgentLens CLI.",
        "citations": ["async-python-trace-writer"],
    }

asyncio.run(trace_async_llm_call(
    run,
    "final-answer",
    {"messages": [{"role": "user", "content": "Can async Python agents emit traces?"}]},
    call_model,
    provider="my-provider",
    model="my-model",
))

run.finish("passed")
run.write(".agentlens/runs/async-refund-answer.json")
```

## Event Helpers

The helper can write the same core events used by the JavaScript API:

- `llm.prompt`
- `llm.response`
- `retrieval.query`
- `retrieval.result`
- `tool.call`
- `tool.result`
- `error`

It also exposes `add_event(...)` for custom events, so Python teams can record framework-specific steps before AgentLens has a dedicated Python adapter.

## CI Pattern

After a Python test suite writes one or more trace files, use the existing AgentLens CLI:

```bash
node ./bin/agentlens.js ci --runs .agentlens/runs --config evals/default.json --scan --pr-comment-md .agentlens/reports/pr-comment.md
node ./bin/agentlens.js bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,scan,tool-calls,filters,timeline
```

This keeps the Python application code simple while reusing AgentLens' evals, scan rules, SARIF, dashboards, run bundles, and GitHub Action integration.

## Current Limits

- This is a copyable zero-dependency helper, not a packaged PyPI SDK.
- It focuses on explicit instrumentation. It does not auto-instrument LangChain, LlamaIndex, CrewAI, or provider SDKs yet.
- The helper supports synchronous and `asyncio` model-call wrappers.
- The generated traces can contain prompts, tool arguments, and retrieved documents. Redact before sharing publicly.
