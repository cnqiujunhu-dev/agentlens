#!/usr/bin/env python3

import argparse
from pathlib import Path

from agentlens_trace import AgentLensRun, init_workspace
from agentlens_trace.adapters import AgentLensLangChainBridge


class FakeLangChainDocument:
    def __init__(self, page_content, metadata):
        self.page_content = page_content
        self.metadata = metadata


class FakeHumanMessage:
    type = "human"

    def __init__(self, content):
        self.content = content


class FakeAIMessage:
    type = "ai"

    def __init__(self, content):
        self.content = content


class FakeChatPromptValue:
    def __init__(self, messages):
        self._messages = messages

    def to_messages(self):
        return self._messages


class FakeChatGeneration:
    def __init__(self, content):
        self.message = FakeAIMessage(content)


class FakeLLMResult:
    def __init__(self, content, source_documents):
        self.generations = [[FakeChatGeneration(content)]]
        self.source_documents = source_documents
        self.llm_output = {
            "token_usage": {
                "inputTokens": 18,
                "outputTokens": 12,
                "totalTokens": 30,
                "costUsd": 0.0003,
            },
            "model_name": "fixture-chat-model",
        }


def write_fixture(out_dir: Path) -> Path:
    run = AgentLensRun(
        app="python-langchain-fixture-agent",
        name="LangChain-like object payload fixture",
        metadata={"language": "python", "framework": "langchain", "example": "python-langchain-fixture"},
    )
    bridge = AgentLensLangChainBridge(
        run,
        provider="fixture-langchain-provider",
        metadata={"fixture": "langchain-object-payload"},
    )

    documents = [
        FakeLangChainDocument(
            "Refunds are available within 30 days with proof of purchase.",
            {"doc_id": "lc_refund_policy", "source": "refund-policy.md", "score": 0.96},
        )
    ]

    bridge.on_retriever_start(
        {"id": ["langchain", "retrievers", "VectorStoreRetriever"]},
        "refund eligibility",
        run_id="lc_fixture_retriever",
        parent_run_id="lc_fixture_chain",
    )
    bridge.on_retriever_end(
        documents,
        duration_ms=41,
        run_id="lc_fixture_retriever",
        parent_run_id="lc_fixture_chain",
    )
    bridge.on_tool_start(
        {"id": ["langchain", "tools", "policy.lookup"]},
        {"query": "refund eligibility", "top_k": 1},
        permission="read-only",
        risk="low",
        run_id="lc_fixture_tool",
        parent_run_id="lc_fixture_chain",
    )
    bridge.on_tool_end(
        {"documents": [{"id": "lc_refund_policy"}]},
        duration_ms=33,
        run_id="lc_fixture_tool",
        parent_run_id="lc_fixture_chain",
    )
    bridge.on_llm_start(
        {"id": ["langchain", "chat_models", "ChatOpenAI"], "model_name": "fixture-chat-model"},
        FakeChatPromptValue([FakeHumanMessage("Can this order be refunded?")]),
        name="fixture-final-answer",
        run_id="lc_fixture_llm",
        parent_run_id="lc_fixture_chain",
    )
    bridge.on_llm_end(
        FakeLLMResult("Yes. The policy supports a 30-day refund.", documents),
        duration_ms=126,
        run_id="lc_fixture_llm",
        parent_run_id="lc_fixture_chain",
    )

    run.finish("passed")
    out = out_dir / "python-langchain-fixture-demo.json"
    run.write(str(out))
    return out


def main():
    parser = argparse.ArgumentParser(description="Write an AgentLens trace from LangChain-like object payloads.")
    parser.add_argument("--out-dir", default=".agentlens/runs")
    args = parser.parse_args()

    init_workspace()
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = write_fixture(out_dir)
    print(f"Wrote {path}")


if __name__ == "__main__":
    main()
