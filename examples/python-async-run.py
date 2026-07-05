#!/usr/bin/env python3

import argparse
import asyncio
import time

from python_trace_writer import AgentLensRun, init_workspace, trace_async_llm_call


async def fake_retrieval(query):
    await asyncio.sleep(0.01)
    return [{"id": "async-python-trace-writer", "score": 0.98, "text": f"Evidence for {query}"}]


async def fake_llm(_input):
    await asyncio.sleep(0.01)
    return {
        "content": "AgentLens can trace async Python model, retrieval, and tool calls.",
        "citations": ["async-python-trace-writer"],
        "usage": {
            "inputTokens": 13,
            "outputTokens": 11,
            "totalTokens": 24,
            "costUsd": 0.0002,
        },
    }


async def main_async():
    parser = argparse.ArgumentParser(description="Write an AgentLens trace from an async Python flow.")
    parser.add_argument("--out", default=".agentlens/runs/python-async-demo.json")
    args = parser.parse_args()

    init_workspace()

    run = AgentLensRun(
        app="python-async-agent",
        name="async python trace writer demo",
        metadata={"language": "python", "example": "python-async-run", "async": True},
    )

    query = "async python agent trace review"
    run.add_event("retrieval.query", name="async-policy-search", input={"query": query})
    retrieval_started = time.perf_counter()
    documents = await fake_retrieval(query)
    run.add_event(
        "retrieval.result",
        name="async-policy-search",
        duration_ms=round((time.perf_counter() - retrieval_started) * 1000, 3),
        output={"documents": documents},
    )

    run.add_tool_call(
        "async.kb.search",
        input={"query": query},
        metadata={
            "adapter": "python",
            "permission": "read-only",
            "risk": "low",
            "server": "async-local-kb",
        },
    )
    run.add_tool_result(
        "async.kb.search",
        duration_ms=18,
        output={"documents": [{"id": document["id"]} for document in documents]},
    )

    await trace_async_llm_call(
        run,
        "async-final-answer",
        {
            "messages": [
                {"role": "user", "content": "Can AgentLens trace async Python agents?"},
                {"role": "tool", "content": "async-python-trace-writer evidence found"},
            ]
        },
        fake_llm,
        provider="mock-python-provider",
        model="demo-async-model",
        metadata={"route": "support.python.async"},
    )

    run.finish("passed")
    run.write(args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    asyncio.run(main_async())
