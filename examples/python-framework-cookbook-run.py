#!/usr/bin/env python3

import argparse
from pathlib import Path

from agentlens_trace import AgentLensRun, init_workspace, trace_llm_call


def write_langchain_style(out_dir: Path) -> Path:
    run = AgentLensRun(
        app="python-langchain-style-agent",
        name="LangChain-style callback bridge demo",
        metadata={"language": "python", "framework": "langchain", "example": "python-framework-cookbook"},
    )

    class AgentLensLangChainBridge:
        def on_retriever_start(self, serialized, query, **kwargs):
            run.add_event(
                "retrieval.query",
                name=serialized.get("name", "retriever"),
                input={"query": query},
                metadata={"framework": "langchain", **kwargs},
            )

        def on_retriever_end(self, documents, **kwargs):
            run.add_event(
                "retrieval.result",
                name="policy-retriever",
                duration_ms=54,
                output={"documents": documents},
                metadata={"framework": "langchain", **kwargs},
            )

        def on_tool_start(self, serialized, input_str, **kwargs):
            run.add_tool_call(
                serialized.get("name", "tool"),
                input={"input": input_str},
                metadata={"framework": "langchain", "permission": "read-only", "risk": "low", **kwargs},
            )

        def on_tool_end(self, output, **kwargs):
            run.add_tool_result(
                "policy.lookup",
                output=output,
                duration_ms=73,
                metadata={"framework": "langchain", **kwargs},
            )

        def on_llm_start(self, serialized, prompts, **kwargs):
            messages = [{"role": "user", "content": prompt} for prompt in prompts]
            run.add_llm_prompt(
                "final-answer",
                messages,
                provider="mock-langchain-provider",
                model=serialized.get("model", "demo-model"),
                metadata={"framework": "langchain", **kwargs},
            )

        def on_llm_end(self, response, **kwargs):
            run.add_llm_response(
                "final-answer",
                response["content"],
                citations=response["citations"],
                duration_ms=118,
                usage=response["usage"],
                provider="mock-langchain-provider",
                model="demo-model",
                metadata={"framework": "langchain", **kwargs},
            )

    bridge = AgentLensLangChainBridge()
    bridge.on_retriever_start({"name": "policy-retriever"}, "refund policy", run_id="lc_retrieve")
    bridge.on_retriever_end([{"id": "refund-policy", "score": 0.94}], run_id="lc_retrieve")
    bridge.on_tool_start({"name": "policy.lookup"}, "refund policy", run_id="lc_tool")
    bridge.on_tool_end({"policy": "Refunds are available within 30 days."}, run_id="lc_tool")
    bridge.on_llm_start({"model": "demo-model"}, ["Can I refund this order?"], run_id="lc_llm")
    bridge.on_llm_end({
        "content": "Refunds are available within 30 days.",
        "citations": ["refund-policy"],
        "usage": {"inputTokens": 9, "outputTokens": 8, "totalTokens": 17, "costUsd": 0.0002},
    }, run_id="lc_llm")

    run.finish("passed")
    out = out_dir / "python-langchain-style-demo.json"
    run.write(str(out))
    return out


def write_llamaindex_style(out_dir: Path) -> Path:
    run = AgentLensRun(
        app="python-llamaindex-style-agent",
        name="LlamaIndex-style callback bridge demo",
        metadata={"language": "python", "framework": "llamaindex", "example": "python-framework-cookbook"},
    )

    class AgentLensLlamaIndexBridge:
        def event_start(self, event_type, payload):
            if event_type == "RETRIEVE":
                run.add_event("retrieval.query", name="index-retrieve", input={"query": payload["query"]}, metadata={"framework": "llamaindex"})
                run.add_tool_call(
                    "vector_index.retrieve",
                    input={"query": payload["query"]},
                    metadata={"framework": "llamaindex", "permission": "read-only", "risk": "low"},
                )
            elif event_type == "LLM":
                run.add_llm_prompt(
                    "synthesize-answer",
                    [{"role": "user", "content": payload["prompt"]}],
                    provider="mock-llamaindex-provider",
                    model="demo-model",
                    metadata={"framework": "llamaindex"},
                )

        def event_end(self, event_type, payload):
            if event_type == "RETRIEVE":
                run.add_event(
                    "retrieval.result",
                    name="index-retrieve",
                    duration_ms=46,
                    output={"documents": payload["nodes"]},
                    metadata={"framework": "llamaindex"},
                )
                run.add_tool_result(
                    "vector_index.retrieve",
                    duration_ms=46,
                    output={"documents": [{"id": node["id"]} for node in payload["nodes"]]},
                    metadata={"framework": "llamaindex"},
                )
            elif event_type == "LLM":
                run.add_llm_response(
                    "synthesize-answer",
                    payload["content"],
                    citations=payload["citations"],
                    duration_ms=109,
                    usage=payload["usage"],
                    provider="mock-llamaindex-provider",
                    model="demo-model",
                    metadata={"framework": "llamaindex"},
                )

    bridge = AgentLensLlamaIndexBridge()
    bridge.event_start("RETRIEVE", {"query": "return policy evidence"})
    bridge.event_end("RETRIEVE", {"nodes": [{"id": "node_refund_policy", "score": 0.91}]})
    bridge.event_start("LLM", {"prompt": "Use retrieved policy evidence to answer the refund question."})
    bridge.event_end("LLM", {
        "content": "The retrieved policy says refunds are allowed within 30 days.",
        "citations": ["node_refund_policy"],
        "usage": {"inputTokens": 11, "outputTokens": 10, "totalTokens": 21, "costUsd": 0.0002},
    })

    run.finish("passed")
    out = out_dir / "python-llamaindex-style-demo.json"
    run.write(str(out))
    return out


def write_crewai_style(out_dir: Path) -> Path:
    run = AgentLensRun(
        app="python-crewai-style-agent",
        name="CrewAI-style task boundary demo",
        metadata={"language": "python", "framework": "crewai", "example": "python-framework-cookbook"},
    )

    run.add_event(
        "agent.message",
        name="planner",
        output={"role": "planner", "content": "Research policy evidence before answering."},
        metadata={"framework": "crewai", "agent": "planner"},
    )
    run.add_event(
        "agent.task.start",
        name="research-refund-policy",
        input={"task": "Find refund policy evidence."},
        metadata={"framework": "crewai", "agent": "researcher"},
    )
    run.add_tool_call(
        "research.search",
        input={"query": "refund policy"},
        metadata={"framework": "crewai", "permission": "read-only", "risk": "low", "agent": "researcher"},
    )
    run.add_tool_result(
        "research.search",
        duration_ms=88,
        output={"documents": [{"id": "crew_refund_policy"}]},
        metadata={"framework": "crewai", "agent": "researcher"},
    )
    run.add_event(
        "agent.task.end",
        name="research-refund-policy",
        duration_ms=132,
        output={"citations": ["crew_refund_policy"]},
        metadata={"framework": "crewai", "agent": "researcher"},
    )

    trace_llm_call(
        run,
        "crew-final-answer",
        {"messages": [{"role": "user", "content": "Can the user refund this order?"}]},
        lambda _input: {
            "content": "The crew found policy evidence that supports a 30-day refund.",
            "citations": ["crew_refund_policy"],
            "usage": {"inputTokens": 10, "outputTokens": 11, "totalTokens": 21, "costUsd": 0.0002},
        },
        provider="mock-crewai-provider",
        model="demo-model",
        metadata={"framework": "crewai", "agent": "reviewer"},
    )

    run.finish("passed")
    out = out_dir / "python-crewai-style-demo.json"
    run.write(str(out))
    return out


def main():
    parser = argparse.ArgumentParser(description="Write AgentLens traces from Python framework-style boundaries.")
    parser.add_argument("--out-dir", default=".agentlens/runs")
    args = parser.parse_args()

    init_workspace()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    written = [
        write_langchain_style(out_dir),
        write_llamaindex_style(out_dir),
        write_crewai_style(out_dir),
    ]

    for path in written:
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
