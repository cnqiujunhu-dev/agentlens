#!/usr/bin/env python3

import argparse
from pathlib import Path

from agentlens_trace import AgentLensRun, init_workspace
from agentlens_trace.adapters import AgentLensCrewAIBridge, AgentLensLangChainBridge, AgentLensLlamaIndexBridge


class FakeLlamaIndexQueryBundle:
    def __init__(self, query_str):
        self.query_str = query_str


class FakeLlamaIndexNode:
    def __init__(self, node_id, text, metadata):
        self.node_id = node_id
        self.metadata = metadata
        self._text = text

    def get_content(self):
        return self._text


class FakeLlamaIndexNodeWithScore:
    def __init__(self, node, score):
        self.node = node
        self.score = score


class FakeLlamaIndexResponse:
    def __init__(self, response, source_nodes):
        self.response = response
        self.source_nodes = source_nodes
        self.usage_metadata = {
            "inputTokens": 13,
            "outputTokens": 11,
            "totalTokens": 24,
            "costUsd": 0.0002,
        }


def write_langchain_style(out_dir: Path) -> Path:
    run = AgentLensRun(
        app="python-langchain-style-agent",
        name="LangChain-style callback bridge demo",
        metadata={"language": "python", "framework": "langchain", "example": "python-framework-cookbook"},
    )

    bridge = AgentLensLangChainBridge(run, provider="mock-langchain-provider", model="demo-model")
    bridge.on_retriever_start({"name": "policy-retriever"}, "refund policy", run_id="lc_retrieve")
    bridge.on_retriever_end([{"id": "refund-policy", "score": 0.94}], duration_ms=54, run_id="lc_retrieve")
    bridge.on_tool_start({"name": "policy.lookup"}, "refund policy", permission="read-only", risk="low", run_id="lc_tool")
    bridge.on_tool_end({"policy": "Refunds are available within 30 days."}, duration_ms=73, run_id="lc_tool")
    bridge.on_llm_start({"model": "demo-model"}, ["Can I refund this order?"], run_id="lc_llm")
    bridge.on_llm_end({
        "content": "Refunds are available within 30 days.",
        "citations": ["refund-policy"],
        "usage": {"inputTokens": 9, "outputTokens": 8, "totalTokens": 17, "costUsd": 0.0002},
    }, duration_ms=118, run_id="lc_llm")

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

    bridge = AgentLensLlamaIndexBridge(run, provider="mock-llamaindex-provider", model="demo-model")
    query = FakeLlamaIndexQueryBundle("return policy evidence")
    source_nodes = [
        FakeLlamaIndexNodeWithScore(
            FakeLlamaIndexNode(
                "li_refund_policy_node",
                "Refund policy evidence says refunds are available within 30 days.",
                {"source": "llamaindex-refund-policy.md", "doc_id": "li_refund_policy", "category": "policy"},
            ),
            0.91,
        )
    ]

    bridge.event_start("RETRIEVE", {"str_or_query_bundle": query}, permission="read-only", risk="low")
    bridge.event_end("RETRIEVE", {"source_nodes": source_nodes}, duration_ms=46)
    bridge.event_start("LLM", {"prompt": "Use retrieved policy evidence to answer the refund question."})
    bridge.event_end(
        "LLM",
        FakeLlamaIndexResponse(
            "The retrieved policy says refunds are allowed within 30 days.",
            source_nodes,
        ),
        duration_ms=109,
    )

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

    bridge = AgentLensCrewAIBridge(run, provider="mock-crewai-provider", model="demo-model")
    bridge.agent_message("planner", "Research policy evidence before answering.")
    bridge.task_start("research-refund-policy", input={"task": "Find refund policy evidence."}, agent="researcher")
    bridge.tool_call(
        "research.search",
        input={"query": "refund policy"},
        agent="researcher",
        permission="read-only",
        risk="low",
    )
    bridge.tool_result(
        "research.search",
        duration_ms=88,
        output={"documents": [{"id": "crew_refund_policy"}]},
        agent="researcher",
    )
    bridge.task_end(
        "research-refund-policy",
        duration_ms=132,
        output={"citations": ["crew_refund_policy"]},
        agent="researcher",
    )

    bridge.llm_call(
        "crew-final-answer",
        {"messages": [{"role": "user", "content": "Can the user refund this order?"}]},
        lambda _input: {
            "content": "The crew found policy evidence that supports a 30-day refund.",
            "citations": ["crew_refund_policy"],
            "usage": {"inputTokens": 10, "outputTokens": 11, "totalTokens": 21, "costUsd": 0.0002},
        },
        agent="reviewer",
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
