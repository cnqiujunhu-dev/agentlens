from __future__ import annotations

import argparse

from .. import AgentLensRun, init_workspace
from . import AgentLensCrewAIBridge, AgentLensLangChainBridge, AgentLensLlamaIndexBridge


def _demo_answer(_input):
    return {
        "content": "agentlens_trace.adapters records framework-shaped Python agent events.",
        "citations": ["agentlens-trace-adapters"],
        "usage": {
            "inputTokens": 12,
            "outputTokens": 10,
            "totalTokens": 22,
            "costUsd": 0.0002,
        },
    }


def build_demo_run() -> AgentLensRun:
    run = AgentLensRun(
        app="python-adapter-package-agent",
        name="agentlens_trace.adapters package demo",
        metadata={"language": "python", "package": "agentlens-trace", "adapter": "agentlens_trace.adapters"},
    )

    langchain = AgentLensLangChainBridge(run, provider="adapter-demo", model="demo-model")
    langchain.on_retriever_start({"name": "policy-retriever"}, "adapter docs", run_id="adapter_lc_retrieve")
    langchain.on_retriever_end(
        [{"id": "agentlens-trace-adapters", "score": 0.95}],
        duration_ms=37,
        run_id="adapter_lc_retrieve",
    )
    langchain.on_llm_start({"model": "demo-model"}, ["Can Python framework adapters write AgentLens traces?"])

    llamaindex = AgentLensLlamaIndexBridge(run, provider="adapter-demo", model="demo-model")
    llamaindex.event_start("RETRIEVE", {"query": "framework adapter evidence"}, permission="read-only", risk="low")
    llamaindex.event_end(
        "RETRIEVE",
        {"nodes": [{"id": "agentlens-trace-adapters", "score": 0.93}]},
        duration_ms=42,
    )

    crewai = AgentLensCrewAIBridge(run, provider="adapter-demo", model="demo-model")
    crewai.agent_message("planner", "Use framework adapter evidence before answering.")
    crewai.task_start("review-framework-evidence", input={"task": "Check adapter traces."}, agent="reviewer")
    crewai.tool_call(
        "docs.lookup",
        input={"query": "agentlens_trace.adapters"},
        agent="reviewer",
        permission="read-only",
        risk="low",
    )
    crewai.tool_result(
        "docs.lookup",
        output={"documents": [{"id": "agentlens-trace-adapters"}]},
        duration_ms=29,
        agent="reviewer",
    )
    crewai.task_end(
        "review-framework-evidence",
        output={"citations": ["agentlens-trace-adapters"]},
        duration_ms=58,
        agent="reviewer",
    )
    crewai.final_answer(
        "adapter-demo-answer",
        {"messages": [{"role": "user", "content": "Can Python framework adapters write AgentLens traces?"}]},
        _demo_answer,
        agent="reviewer",
    )

    run.finish("passed")
    return run


def main() -> None:
    parser = argparse.ArgumentParser(description="Write a demo AgentLens trace from agentlens_trace.adapters.")
    parser.add_argument("--out", default=".agentlens/runs/python-adapters-demo.json")
    args = parser.parse_args()

    init_workspace()
    run = build_demo_run()
    run.write(args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
