from __future__ import annotations

import argparse

from . import AgentLensRun, init_workspace, trace_llm_call


def _demo_answer(_input):
    return {
        "content": "agentlens-trace writes AgentLens-compatible Python traces.",
        "citations": ["agentlens-trace-package"],
        "usage": {
            "inputTokens": 9,
            "outputTokens": 9,
            "totalTokens": 18,
            "costUsd": 0.0002,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Write a demo AgentLens trace from the agentlens-trace package.")
    parser.add_argument("--out", default=".agentlens/runs/python-package-demo.json")
    args = parser.parse_args()

    init_workspace()
    run = AgentLensRun(
        app="python-package-agent",
        name="agentlens-trace package demo",
        metadata={"language": "python", "package": "agentlens-trace"},
    )
    run.add_tool_call(
        "kb.search",
        input={"query": "agentlens-trace package"},
        metadata={"permission": "read-only", "risk": "low", "adapter": "python-package"},
    )
    run.add_tool_result(
        "kb.search",
        duration_ms=12,
        output={"documents": [{"id": "agentlens-trace-package"}]},
    )
    trace_llm_call(
        run,
        "final-answer",
        {"messages": [{"role": "user", "content": "Can Python write AgentLens traces?"}]},
        _demo_answer,
        provider="python-package",
        model="demo-model",
    )
    run.finish("passed")
    run.write(args.out)
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
