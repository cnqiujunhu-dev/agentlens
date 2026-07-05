# Python Framework Cookbook

AgentLens' Python trace writer is intentionally plain JSON. This cookbook shows where to place that writer in Python agent frameworks without adding AgentLens as a framework dependency or running a hosted backend.

The examples are runnable simulations. They do not import LangChain, LlamaIndex, or CrewAI, so the repository stays dependency-light. Copy the patterns into the matching framework boundary in your project.

Start a Python project with `agentlens init --python` if you want the trace writer and a CI-ready starter under `.agentlens/python/`.

## Quick Demo

```bash
npm run demo:python:frameworks
```

The demo writes and verifies:

- `.agentlens/runs/python-langchain-style-demo.json`
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
from python_trace_writer import AgentLensRun

run = AgentLensRun(app="support-agent", name="langchain-refund-answer")

class AgentLensLangChainBridge:
    def on_retriever_start(self, serialized, query, **kwargs):
        run.add_event("retrieval.query", name=serialized.get("name", "retriever"), input={"query": query})

    def on_retriever_end(self, documents, **kwargs):
        run.add_event("retrieval.result", name="retriever", output={"documents": documents})

    def on_tool_start(self, serialized, input_str, **kwargs):
        run.add_tool_call(serialized.get("name", "tool"), input={"input": input_str})

    def on_tool_end(self, output, **kwargs):
        run.add_tool_result("tool", output=output)

    def on_llm_start(self, serialized, prompts, **kwargs):
        run.add_llm_prompt("final-answer", [{"role": "user", "content": prompt} for prompt in prompts])

    def on_llm_end(self, response, **kwargs):
        run.add_llm_response("final-answer", response["content"], citations=response.get("citations", []))
```

Attach the handler where your LangChain version expects callbacks, or keep the same event mapping inside a wrapper around the chain execution.

## LlamaIndex-Style Event Bridge

LlamaIndex callbacks expose event types for query, retrieve, synthesize, and LLM work. AgentLens does not need every internal event; start with retrieval and final synthesis.

```python
from python_trace_writer import AgentLensRun

run = AgentLensRun(app="rag-agent", name="llamaindex-refund-answer")

def on_event_start(event_type, payload):
    if event_type == "RETRIEVE":
        run.add_event("retrieval.query", name="index-retrieve", input={"query": payload["query"]})
    elif event_type == "LLM":
        run.add_llm_prompt("synthesize-answer", [{"role": "user", "content": payload["prompt"]}])

def on_event_end(event_type, payload):
    if event_type == "RETRIEVE":
        run.add_event("retrieval.result", name="index-retrieve", output={"documents": payload["nodes"]})
    elif event_type == "LLM":
        run.add_llm_response("synthesize-answer", payload["content"], citations=payload.get("citations", []))
```

If your query engine does not expose enough callback payload, wrap `retrieve(...)`, `query(...)`, or `aquery(...)` directly and record the same events.

## CrewAI-Style Task Boundary

CrewAI often gives you useful boundaries at the crew, task, agent, and flow level. Record task start/end and tool evidence, then record the final answer.

```python
from python_trace_writer import AgentLensRun, trace_llm_call

run = AgentLensRun(app="crew-agent", name="crewai-refund-answer")

run.add_event("agent.task.start", name="research-refund-policy", input={"task": "Find policy evidence"})
run.add_tool_call("research.search", input={"query": "refund policy"})
run.add_tool_result("research.search", output={"documents": [{"id": "refund-policy"}]})
run.add_event("agent.task.end", name="research-refund-policy", output={"citations": ["refund-policy"]})

trace_llm_call(
    run,
    "crew-final-answer",
    {"messages": [{"role": "user", "content": "Can I refund this order?"}]},
    lambda _input: {"content": "Refunds are available within 30 days.", "citations": ["refund-policy"]},
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
