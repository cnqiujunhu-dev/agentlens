from __future__ import annotations

import json
import secrets
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Awaitable, Callable, Dict, Iterable, Optional

TRACE_SCHEMA_VERSION = "agentlens.trace.v1"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _make_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(6)}"


def init_workspace(root: str = ".") -> Dict[str, str]:
    base = Path(root)
    runs_dir = base / ".agentlens" / "runs"
    reports_dir = base / ".agentlens" / "reports"
    runs_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)
    return {
        "root": str(base.resolve()),
        "runsDir": str(runs_dir),
        "reportsDir": str(reports_dir),
    }


def write_trace(path: str, trace: Dict[str, Any]) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as file:
        json.dump(trace, file, indent=2, ensure_ascii=False)
        file.write("\n")


def _duration_ms(started: float) -> float:
    return round((time.perf_counter() - started) * 1000, 3)


def _normalize_llm_output(result: Any) -> Dict[str, Any]:
    output = result if isinstance(result, dict) else {"content": str(result)}
    if "content" not in output:
        return {"content": json.dumps(output, ensure_ascii=False), "raw": output}
    return output


def _record_llm_error(
    run: "AgentLensRun",
    name: str,
    exc: Exception,
    duration_ms: float,
    provider: Optional[str],
    model: Optional[str],
    metadata: Optional[Dict[str, Any]],
) -> None:
    run.add_event(
        "llm.response",
        name=name,
        status="error",
        output={"error": str(exc), "type": exc.__class__.__name__},
        duration_ms=duration_ms,
        provider=provider,
        model=model,
        metadata=metadata,
    )
    run.add_event(
        "error",
        name=name,
        status="error",
        output={"message": str(exc), "type": exc.__class__.__name__},
    )


def _record_llm_success(
    run: "AgentLensRun",
    name: str,
    result: Any,
    duration_ms: float,
    provider: Optional[str],
    model: Optional[str],
    metadata: Optional[Dict[str, Any]],
) -> None:
    output = _normalize_llm_output(result)
    run.add_event(
        "llm.response",
        name=name,
        output=output,
        duration_ms=duration_ms,
        usage=output.get("usage") if isinstance(output.get("usage"), dict) else None,
        provider=provider,
        model=model,
        metadata=metadata,
    )


class AgentLensRun:
    def __init__(
        self,
        app: str = "python-agent",
        name: str = "untitled python run",
        metadata: Optional[Dict[str, Any]] = None,
        run_id: Optional[str] = None,
        started_at: Optional[str] = None,
    ) -> None:
        self.trace: Dict[str, Any] = {
            "schemaVersion": TRACE_SCHEMA_VERSION,
            "runId": run_id or _make_id("run"),
            "app": app,
            "name": name,
            "startedAt": started_at or _now_iso(),
            "endedAt": None,
            "status": "running",
            "metadata": metadata or {},
            "events": [],
        }

    def add_event(
        self,
        event_type: str,
        name: Optional[str] = None,
        status: str = "ok",
        input: Optional[Any] = None,
        output: Optional[Any] = None,
        duration_ms: Optional[float] = None,
        usage: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        event = {
            "id": extra.pop("id", None) or _make_id("evt"),
            "ts": extra.pop("ts", None) or _now_iso(),
            "type": event_type,
            "status": status,
        }
        if name is not None:
            event["name"] = name
        if input is not None:
            event["input"] = input
        if output is not None:
            event["output"] = output
        if duration_ms is not None:
            event["durationMs"] = duration_ms
        if usage is not None:
            event["usage"] = usage
        if metadata is not None:
            event["metadata"] = metadata

        for key, value in extra.items():
            if value is not None:
                event[key] = value

        self.trace["events"].append(event)
        return event

    def add_llm_prompt(
        self,
        name: str,
        messages: Iterable[Dict[str, Any]],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.add_event(
            "llm.prompt",
            name=name,
            input={"messages": list(messages)},
            provider=provider,
            model=model,
            metadata=metadata,
        )

    def add_llm_response(
        self,
        name: str,
        content: str,
        citations: Optional[Iterable[str]] = None,
        duration_ms: Optional[float] = None,
        usage: Optional[Dict[str, Any]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        raw: Optional[Any] = None,
    ) -> Dict[str, Any]:
        output: Dict[str, Any] = {"content": content}
        if citations is not None:
            output["citations"] = list(citations)
        if raw is not None:
            output["raw"] = raw
        return self.add_event(
            "llm.response",
            name=name,
            output=output,
            duration_ms=duration_ms,
            usage=usage,
            provider=provider,
            model=model,
            metadata=metadata,
        )

    def add_tool_call(
        self,
        name: str,
        input: Optional[Any] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.add_event("tool.call", name=name, input=input, metadata=metadata)

    def add_tool_result(
        self,
        name: str,
        output: Optional[Any] = None,
        duration_ms: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.add_event("tool.result", name=name, output=output, duration_ms=duration_ms, metadata=metadata)

    def finish(self, status: str = "passed") -> Dict[str, Any]:
        if not self.trace.get("endedAt"):
            self.trace["endedAt"] = _now_iso()
        self.trace["status"] = status
        return self.trace

    def to_dict(self) -> Dict[str, Any]:
        return self.trace

    def write(self, path: str) -> None:
        write_trace(path, self.trace)


def trace_llm_call(
    run: AgentLensRun,
    name: str,
    input: Dict[str, Any],
    call: Callable[[Dict[str, Any]], Any],
    provider: Optional[str] = None,
    model: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Any:
    run.add_event("llm.prompt", name=name, input=input, provider=provider, model=model, metadata=metadata)
    started = time.perf_counter()
    try:
        result = call(input)
    except Exception as exc:
        _record_llm_error(run, name, exc, _duration_ms(started), provider, model, metadata)
        raise

    _record_llm_success(run, name, result, _duration_ms(started), provider, model, metadata)
    return result


async def trace_async_llm_call(
    run: AgentLensRun,
    name: str,
    input: Dict[str, Any],
    call: Callable[[Dict[str, Any]], Awaitable[Any]],
    provider: Optional[str] = None,
    model: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Any:
    run.add_event("llm.prompt", name=name, input=input, provider=provider, model=model, metadata=metadata)
    started = time.perf_counter()
    try:
        result = await call(input)
    except Exception as exc:
        _record_llm_error(run, name, exc, _duration_ms(started), provider, model, metadata)
        raise

    _record_llm_success(run, name, result, _duration_ms(started), provider, model, metadata)
    return result
