# agentlens-trace

Zero-dependency Python trace writer for [AgentLens](https://github.com/cnqiujunhu-dev/agentlens).

The package writes plain `agentlens.trace.v1` JSON files that can be validated, evaluated, scanned, rendered, bundled, and reviewed by the AgentLens CLI.

```python
from agentlens_trace import AgentLensRun, init_workspace, trace_llm_call

init_workspace()

run = AgentLensRun(app="python-agent", name="support answer")

trace_llm_call(
    run,
    "final-answer",
    {"messages": [{"role": "user", "content": "Can I trace Python agents?"}]},
    lambda _input: {
        "content": "Yes. AgentLens stores Python traces as local JSON artifacts.",
        "citations": ["agentlens-trace"],
    },
)

run.finish("passed")
run.write(".agentlens/runs/python-agent.json")
```

Local development from the AgentLens repository:

```bash
PYTHONPATH=python/agentlens-trace/src python -m agentlens_trace --out .agentlens/runs/python-package-demo.json
node ./bin/agentlens.js validate trace .agentlens/runs/python-package-demo.json
node ./bin/agentlens.js eval .agentlens/runs/python-package-demo.json --config evals/default.json
```

Runtime dependencies: none.

Framework-shaped helpers are available without importing framework packages:

```python
from agentlens_trace import AgentLensRun
from agentlens_trace.adapters import AgentLensLangChainBridge, AgentLensLlamaIndexBridge, AgentLensCrewAIBridge

run = AgentLensRun(app="support-agent", name="framework answer")
bridge = AgentLensLangChainBridge(run, provider="openai-compatible", model="gpt-example")
bridge.on_retriever_start({"name": "policy-retriever"}, "refund policy")
```
