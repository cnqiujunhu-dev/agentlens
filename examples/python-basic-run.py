#!/usr/bin/env python3

import argparse

from python_trace_writer import AgentLensRun, init_workspace, trace_llm_call


def fake_llm(_input):
    return {
        "content": "AgentLens traces Python agent runs as local review artifacts.",
        "citations": ["python-trace-writer"],
        "usage": {
            "inputTokens": 10,
            "outputTokens": 12,
            "totalTokens": 22,
            "costUsd": 0.0002,
        },
    }


def main():
    parser = argparse.ArgumentParser(description="Write an AgentLens trace from Python.")
    parser.add_argument("--out", default=".agentlens/runs/python-basic-demo.json")
    args = parser.parse_args()

    init_workspace()

    run = AgentLensRun(
        app="python-support-agent",
        name="python trace writer demo",
        metadata={"language": "python", "example": "python-basic-run"},
    )

    run.add_llm_prompt(
        "plan-answer",
        [{"role": "user", "content": "Can AgentLens work with Python agents?"}],
        provider="mock-python-provider",
        model="demo-model",
    )

    run.add_event(
        "retrieval.query",
        name="policy-search",
        input={"query": "python agent trace review"},
    )
    run.add_event(
        "retrieval.result",
        name="policy-search",
        duration_ms=64,
        output={"documents": [{"id": "python-trace-writer", "score": 0.97}]},
    )

    run.add_tool_call(
        "kb.search",
        input={"query": "python agent trace review"},
        metadata={
            "adapter": "python",
            "permission": "read-only",
            "risk": "low",
            "server": "local-kb",
        },
    )
    run.add_tool_result(
        "kb.search",
        duration_ms=92,
        output={"documents": [{"id": "python-trace-writer"}]},
    )

    trace_llm_call(
        run,
        "final-answer",
        {
            "messages": [
                {"role": "user", "content": "Can AgentLens work with Python agents?"},
                {"role": "tool", "content": "python-trace-writer evidence found"},
            ]
        },
        fake_llm,
        provider="mock-python-provider",
        model="demo-model",
        metadata={"route": "support.python"},
    )

    run.finish("passed")
    run.write(args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
