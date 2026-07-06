# Python Framework Cookbook

AgentLens' Python trace writer is intentionally plain JSON. This cookbook shows where to place that writer in Python agent frameworks without adding AgentLens as a framework dependency or running a hosted backend.

The examples are runnable simulations. They do not import LangChain, LlamaIndex, or CrewAI, so the repository stays dependency-light. The `agentlens-trace` package now includes importable zero-dependency bridge helpers under `agentlens_trace.adapters`; copy those helpers or wire them into the matching framework boundary in your project.

The helpers normalize common framework-shaped payloads: plain dicts, enum-like event names and payload keys, message objects with `role`/`type` and `content`, response objects with usage metadata, and source document metadata used for citations.

Start a Python project with `agentlens init --python` if you want the trace writer and a CI-ready starter under `.agentlens/python/`. For package-style local development, use `PYTHONPATH=python/agentlens-trace/src` and import `agentlens_trace`.

## Quick Demo

```bash
npm run demo:python:frameworks
PYTHONPATH=python/agentlens-trace/src python -m agentlens_trace.adapters --out .agentlens/runs/python-adapters-demo.json
```

The demo writes and verifies:

- `.agentlens/runs/python-langchain-style-demo.json`
- `.agentlens/runs/python-langchain-fixture-demo.json`
- `.agentlens/runs/python-llamaindex-style-demo.json`
- `.agentlens/runs/python-crewai-style-demo.json`

Each trace is validated, evaluated, scanned, and exported to OTLP JSON.

## Choosing Boundaries

| Project shape | Best AgentLens boundary | Events to write |
| --- | --- | --- |
| LangChain chain, retriever, tool, or agent executor | Callback handler methods or explicit `invoke` / `ainvoke` wrappers | `retrieval.query`, `retrieval.result`, `tool.call`, `tool.result`, `llm.prompt`, `llm.response` |
| LlamaIndex query engine, retriever, or synthesizer | Callback manager events or explicit query/retrieve/synthesize wrappers | `retrieval.query`, `retrieval.result`, `llm.prompt`, `llm.response` |
| CrewAI crew, agent, task, or flow | Around `kickoff`, `kickoff_async`, task callbacks, or flow methods | `agent.message`, `agent.task.start`, `agent.task.end`, `tool.call`, `tool.result`, `llm.prompt`, `llm.response` |

Use framework-native callbacks when they already expose the details you need. Use explicit wrappers when callbacks are unstable, hard to attach consistently, or do not include enough application-specific metadata.

## LangChain-Style Callback Bridge

LangChain's callback surface includes LLM, retriever, tool, chain, and agent events. In AgentLens, the useful minimum is to record retriever input/output, tool input/output, and the final model call.

```python
from agentlens_trace import AgentLensRun
from agentlens_trace.adapters import AgentLensLangChainBridge

run = AgentLensRun(app="support-agent", name="langchain-refund-answer")
bridge = AgentLensLangChainBridge(run, provider="openai-compatible", model="gpt-example")

bridge.on_retriever_start({"name": "policy-retriever"}, "refund policy")
bridge.on_retriever_end([{"id": "refund-policy", "score": 0.94}], duration_ms=54)
bridge.on_tool_start({"name": "policy.lookup"}, "refund policy", permission="read-only", risk="low")
bridge.on_tool_end({"policy": "Refunds are available within 30 days."}, duration_ms=73)
bridge.on_llm_start({"model": "gpt-example"}, ["Can I refund this order?"])
bridge.on_llm_end({"content": "Refunds are available within 30 days.", "citations": ["refund-policy"]})
```

Attach the handler where your LangChain version expects callbacks, or keep the same event mapping inside a wrapper around the chain execution.

## LangChain-Like Object Fixture

`examples/python-langchain-fixture-run.py` exercises payload shapes closer to LangChain callback objects without importing LangChain:

- serialized component IDs such as `["langchain", "chat_models", "ChatOpenAI"]`
- document objects with `page_content` and `metadata`
- prompt values exposing `to_messages()`
- message objects with `type` and `content`
- LLM result objects with `generations` and nested `llm_output.token_usage`

Run it through the framework demo gate:

```bash
npm run demo:python:frameworks
node ./bin/agentlens.js replay .agentlens/runs/python-langchain-fixture-demo.json
```

## LlamaIndex-Style Event Bridge

LlamaIndex callbacks expose event types for query, retrieve, synthesize, and LLM work. AgentLens does not need every internal event; start with retrieval and final synthesis.

```python
from agentlens_trace import AgentLensRun
from agentlens_trace.adapters import AgentLensLlamaIndexBridge

run = AgentLensRun(app="rag-agent", name="llamaindex-refund-answer")
bridge = AgentLensLlamaIndexBridge(run, provider="openai-compatible", model="gpt-example")

bridge.event_start("RETRIEVE", {"query": "return policy evidence"}, permission="read-only", risk="low")
bridge.event_end("RETRIEVE", {"nodes": [{"id": "node_refund_policy", "score": 0.91}]}, duration_ms=46)
bridge.event_start("LLM", {"prompt": "Use retrieved policy evidence to answer the refund question."})
bridge.event_end("LLM", {"content": "Refunds are available within 30 days.", "citations": ["node_refund_policy"]})
```

If your query engine does not expose enough callback payload, wrap `retrieve(...)`, `query(...)`, or `aquery(...)` directly and record the same events.

## CrewAI-Style Task Boundary

CrewAI often gives you useful boundaries at the crew, task, agent, and flow level. Record task start/end and tool evidence, then record the final answer.

```python
from agentlens_trace import AgentLensRun
from agentlens_trace.adapters import AgentLensCrewAIBridge

run = AgentLensRun(app="crew-agent", name="crewai-refund-answer")
bridge = AgentLensCrewAIBridge(run, provider="openai-compatible", model="gpt-example")

bridge.agent_message("planner", "Research policy evidence before answering.")
bridge.task_start("research-refund-policy", input={"task": "Find policy evidence"}, agent="researcher")
bridge.tool_call("research.search", input={"query": "refund policy"}, agent="researcher", permission="read-only", risk="low")
bridge.tool_result("research.search", output={"documents": [{"id": "refund-policy"}]}, agent="researcher")
bridge.task_end("research-refund-policy", output={"citations": ["refund-policy"]}, agent="researcher")

bridge.llm_call(
    "crew-final-answer",
    {"messages": [{"role": "user", "content": "Can I refund this order?"}]},
    lambda _input: {"content": "Refunds are available within 30 days.", "citations": ["refund-policy"]},
    agent="reviewer",
)
```

For `kickoff_async` or native async flows, use `trace_async_llm_call` and record task/tool events around the awaited work.

## CI Pattern

After any Python framework test writes traces:

```bash
node ./bin/agentlens.js ci --runs .agentlens/runs --config evals/default.json --scan --pr-comment-md .agentlens/reports/pr-comment.md
node ./bin/agentlens.js bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,scan,tool-calls,filters,timeline
```

That keeps framework-specific code in Python while reusing AgentLens' existing evals, scan rules, dashboards, run bundles, GitHub Action, and OTLP JSON export.

## Sources Reviewed

- LangChain callback API reference: https://reference.langchain.com/python/langchain-core/callbacks
- LangChain callbacks design note: https://www.langchain.com/blog/callbacks
- LlamaIndex callbacks docs: https://developers.llamaindex.ai/python/framework/module_guides/observability/callbacks/
- CrewAI agents docs: https://docs.crewai.com/v1.15.1/en/concepts/agents
- CrewAI crews docs: https://docs.crewai.com/v1.15.0/en/concepts/crews
- CrewAI async kickoff docs: https://docs.crewai.com/v1.15.1/en/learn/kickoff-async
