from __future__ import annotations

import json
from typing import Any, Callable, Dict, Iterable, List, Optional

from .. import AgentLensRun, trace_llm_call

ADAPTER_NAME = "agentlens_trace.adapters"


def _json_safe(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(item) for item in value]

    for method_name in ("model_dump", "dict", "to_dict"):
        method = getattr(value, method_name, None)
        if callable(method):
            try:
                return _json_safe(method())
            except Exception:
                pass

    return repr(value)


def _document_safe(value: Any) -> Any:
    safe = _json_safe(value)
    if isinstance(safe, str) and value is not None and not isinstance(value, str):
        page_content = getattr(value, "page_content", None)
        metadata = getattr(value, "metadata", None)
        if page_content is not None or metadata is not None:
            return {
                "page_content": _as_text(page_content),
                "metadata": _json_safe(metadata or {}),
            }
    return safe


def _documents_safe(value: Any) -> Any:
    if isinstance(value, (list, tuple, set)):
        return [_document_safe(item) for item in value]
    return _document_safe(value)


def _key_label(value: Any) -> str:
    raw = getattr(value, "value", None)
    if raw is None:
        raw = getattr(value, "name", None)
    if raw is None:
        raw = str(value)
    tail = str(raw).split(".")[-1]
    return "".join(char for char in tail.lower() if char.isalnum())


def _lookup(value: Any, key: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        if key in value:
            return value[key]
        target = _key_label(key)
        for candidate_key, candidate_value in value.items():
            if _key_label(candidate_key) == target:
                return candidate_value
        return default
    return getattr(value, key, default)


def _first_value(value: Any, keys: Iterable[str], default: Any = None) -> Any:
    for key in keys:
        candidate = _lookup(value, key, None)
        if candidate is not None:
            return candidate
    return default


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    safe = _json_safe(value)
    if isinstance(safe, str):
        return safe
    return json.dumps(safe, ensure_ascii=False)


def _metadata(framework: str, defaults: Optional[Dict[str, Any]] = None, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    metadata: Dict[str, Any] = {"framework": framework, "adapter": ADAPTER_NAME}
    if defaults:
        metadata.update({key: _json_safe(value) for key, value in defaults.items() if value is not None})

    data = dict(extra or {})
    nested = data.pop("metadata", None)
    metadata.update({key: _json_safe(value) for key, value in data.items() if value is not None})
    if isinstance(nested, dict):
        metadata.update({key: _json_safe(value) for key, value in nested.items() if value is not None})
    return metadata


def _pop_duration(data: Dict[str, Any]) -> Optional[float]:
    value = data.pop("duration_ms", None)
    if value is None:
        value = data.pop("durationMs", None)
    return value


def _serialized_name(serialized: Any, fallback: str) -> str:
    value = _first_value(serialized, ("name", "id", "tool", "class_name"), fallback)
    if isinstance(value, (list, tuple)) and value:
        value = value[-1]
    return str(value or fallback)


def _serialized_model(serialized: Any, fallback: Optional[str]) -> Optional[str]:
    value = _first_value(serialized, ("model", "model_name", "modelName"), fallback)
    return str(value) if value is not None else None


def _messages_from_prompts(prompts: Any) -> List[Dict[str, Any]]:
    to_messages = getattr(prompts, "to_messages", None)
    if callable(to_messages):
        try:
            return _messages_from_prompts(to_messages())
        except Exception:
            pass

    if isinstance(prompts, dict):
        messages = prompts.get("messages")
        if isinstance(messages, list):
            return [_json_safe(message) for message in messages]
        prompt = prompts.get("prompt")
        if prompt is not None:
            return [{"role": "user", "content": _as_text(prompt)}]

    if isinstance(prompts, str):
        return [{"role": "user", "content": prompts}]

    messages: List[Dict[str, Any]] = []
    try:
        iterator = iter(prompts)
    except TypeError:
        return [{"role": "user", "content": _as_text(prompts)}]

    for prompt in iterator:
        if isinstance(prompt, dict) and "role" in prompt and "content" in prompt:
            messages.append(_json_safe(prompt))
        else:
            role = _first_value(prompt, ("role", "type"), "user")
            content = _first_value(prompt, ("content", "text"), prompt)
            messages.append({"role": str(role or "user"), "content": _as_text(content)})
    return messages


def _response_content(response: Any) -> str:
    value = _first_value(response, ("content", "text", "output", "response"), None)
    if value is not None:
        return _as_text(value)

    generations = _lookup(response, "generations", None)
    if isinstance(generations, list) and generations:
        first_group = generations[0]
        if isinstance(first_group, list) and first_group:
            return _generation_content(first_group[0])
        return _generation_content(first_group)

    return _as_text(response)


def _generation_content(generation: Any) -> str:
    text = _first_value(generation, ("text", "content"), None)
    if text is not None:
        return _as_text(text)

    message = _lookup(generation, "message", None)
    if message is not None:
        content = _first_value(message, ("content", "text"), None)
        if content is not None:
            return _as_text(content)
        return _as_text(message)

    return _as_text(generation)


def _response_citations(response: Any) -> Optional[List[str]]:
    value = _first_value(response, ("citations", "sources", "source_documents"), None)
    if value is None:
        return None
    if isinstance(value, str):
        return [value]
    try:
        citations = []
        for item in value:
            citation = _first_value(item, ("id", "source", "name"), None)
            if citation is None:
                citation = _first_value(_lookup(item, "metadata", None), ("id", "source", "doc_id"), item)
            citations.append(_as_text(citation))
        return citations
    except TypeError:
        return [_as_text(value)]


def _response_usage(response: Any) -> Optional[Dict[str, Any]]:
    value = _first_value(response, ("usage", "usage_metadata", "token_usage", "response_metadata", "llm_output"), None)
    nested = _first_value(value, ("token_usage", "usage", "usage_metadata"), None)
    if isinstance(nested, dict):
        return _json_safe(nested)
    if isinstance(value, dict):
        return _json_safe(value)
    return None


def _payload_value(payload: Any, keys: Iterable[str], default: Any = None) -> Any:
    return _first_value(payload, keys, default)


def _event_type(value: Any) -> str:
    raw = getattr(value, "value", None)
    if raw is None:
        raw = getattr(value, "name", None)
    if raw is None:
        raw = value
    return str(raw).split(".")[-1].upper()


class AgentLensLangChainBridge:
    """Small callback-shaped bridge for LangChain-style retriever, tool, and LLM events."""

    def __init__(
        self,
        run: AgentLensRun,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        retriever_name: str = "retriever",
        tool_name: str = "tool",
        llm_name: str = "final-answer",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.run = run
        self.provider = provider
        self.model = model
        self.retriever_name = retriever_name
        self.tool_name = tool_name
        self.llm_name = llm_name
        self.metadata = metadata or {}
        self._active_retriever_name = retriever_name
        self._active_tool_name = tool_name
        self._active_llm_name = llm_name
        self._active_provider = provider
        self._active_model = model

    def _metadata(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _metadata("langchain", self.metadata, extra)

    def on_retriever_start(self, serialized: Any, query: Any, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        name = str(data.pop("name", _serialized_name(serialized, self.retriever_name)))
        self._active_retriever_name = name
        return self.run.add_event(
            "retrieval.query",
            name=name,
            input={"query": _json_safe(query)},
            metadata=self._metadata(data),
        )

    def on_retriever_end(self, documents: Any, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        duration_ms = _pop_duration(data)
        name = str(data.pop("name", self._active_retriever_name))
        return self.run.add_event(
            "retrieval.result",
            name=name,
            output={"documents": _documents_safe(documents)},
            duration_ms=duration_ms,
            metadata=self._metadata(data),
        )

    def on_tool_start(self, serialized: Any, input_str: Any, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        name = str(data.pop("name", _serialized_name(serialized, self.tool_name)))
        self._active_tool_name = name
        return self.run.add_tool_call(
            name,
            input={"input": _json_safe(input_str)},
            metadata=self._metadata(data),
        )

    def on_tool_end(self, output: Any, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        duration_ms = _pop_duration(data)
        name = str(data.pop("name", self._active_tool_name))
        return self.run.add_tool_result(
            name,
            output=_json_safe(output),
            duration_ms=duration_ms,
            metadata=self._metadata(data),
        )

    def on_llm_start(self, serialized: Any, prompts: Any, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        name = str(data.pop("name", self.llm_name))
        provider = data.pop("provider", self.provider)
        model = data.pop("model", _serialized_model(serialized, self.model))
        self._active_llm_name = name
        self._active_provider = provider
        self._active_model = model
        return self.run.add_llm_prompt(
            name,
            _messages_from_prompts(prompts),
            provider=provider,
            model=model,
            metadata=self._metadata(data),
        )

    def on_llm_end(self, response: Any, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        duration_ms = _pop_duration(data)
        name = str(data.pop("name", self._active_llm_name))
        provider = data.pop("provider", self._active_provider)
        model = data.pop("model", self._active_model)
        return self.run.add_llm_response(
            name,
            _response_content(response),
            citations=_response_citations(response),
            duration_ms=duration_ms,
            usage=_response_usage(response),
            provider=provider,
            model=model,
            metadata=self._metadata(data),
            raw=_json_safe(response),
        )

    def on_llm_error(self, error: Exception, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        duration_ms = _pop_duration(data)
        name = str(data.pop("name", self._active_llm_name))
        event = self.run.add_event(
            "llm.response",
            name=name,
            status="error",
            output={"error": str(error), "type": error.__class__.__name__},
            duration_ms=duration_ms,
            provider=data.pop("provider", self._active_provider),
            model=data.pop("model", self._active_model),
            metadata=self._metadata(data),
        )
        self.run.add_event(
            "error",
            name=name,
            status="error",
            output={"message": str(error), "type": error.__class__.__name__},
            metadata=self._metadata(),
        )
        return event


class AgentLensLlamaIndexBridge:
    """Small event-shaped bridge for LlamaIndex-style retrieve and LLM events."""

    def __init__(
        self,
        run: AgentLensRun,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        retrieve_name: str = "index-retrieve",
        tool_name: str = "vector_index.retrieve",
        llm_name: str = "synthesize-answer",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.run = run
        self.provider = provider
        self.model = model
        self.retrieve_name = retrieve_name
        self.tool_name = tool_name
        self.llm_name = llm_name
        self.metadata = metadata or {}

    def _metadata(self, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return _metadata("llamaindex", self.metadata, extra)

    def event_start(self, event_type: str, payload: Any, **kwargs: Any) -> Optional[Dict[str, Any]]:
        data = dict(kwargs)
        event = _event_type(event_type)
        if event in {"RETRIEVE", "RETRIEVAL"}:
            name = str(data.pop("name", self.retrieve_name))
            tool_name = str(data.pop("tool_name", self.tool_name))
            query = _payload_value(payload, ("query", "query_str", "str_or_query_bundle"), "")
            self.run.add_tool_call(
                tool_name,
                input={"query": _json_safe(query)},
                metadata=self._metadata(data),
            )
            return self.run.add_event(
                "retrieval.query",
                name=name,
                input={"query": _json_safe(query)},
                metadata=self._metadata(data),
            )

        if event in {"LLM", "SYNTHESIZE", "SYNTHESIS"}:
            name = str(data.pop("name", self.llm_name))
            prompt = _payload_value(payload, ("messages", "prompt", "query"), payload)
            return self.run.add_llm_prompt(
                name,
                _messages_from_prompts(prompt),
                provider=data.pop("provider", self.provider),
                model=data.pop("model", self.model),
                metadata=self._metadata(data),
            )

        return None

    def event_end(self, event_type: str, payload: Any, **kwargs: Any) -> Optional[Dict[str, Any]]:
        data = dict(kwargs)
        duration_ms = _pop_duration(data)
        event = _event_type(event_type)
        if event in {"RETRIEVE", "RETRIEVAL"}:
            name = str(data.pop("name", self.retrieve_name))
            tool_name = str(data.pop("tool_name", self.tool_name))
            documents = _payload_value(payload, ("nodes", "documents", "source_nodes"), [])
            self.run.add_tool_result(
                tool_name,
                output={"documents": _json_safe(documents)},
                duration_ms=duration_ms,
                metadata=self._metadata(data),
            )
            return self.run.add_event(
                "retrieval.result",
                name=name,
                output={"documents": _json_safe(documents)},
                duration_ms=duration_ms,
                metadata=self._metadata(data),
            )

        if event in {"LLM", "SYNTHESIZE", "SYNTHESIS"}:
            name = str(data.pop("name", self.llm_name))
            return self.run.add_llm_response(
                name,
                _response_content(payload),
                citations=_response_citations(payload),
                duration_ms=duration_ms,
                usage=_response_usage(payload),
                provider=data.pop("provider", self.provider),
                model=data.pop("model", self.model),
                metadata=self._metadata(data),
                raw=_json_safe(payload),
            )

        return None

    def on_event_start(self, event_type: str, payload: Any, **kwargs: Any) -> Optional[Dict[str, Any]]:
        return self.event_start(event_type, payload, **kwargs)

    def on_event_end(self, event_type: str, payload: Any, **kwargs: Any) -> Optional[Dict[str, Any]]:
        return self.event_end(event_type, payload, **kwargs)


class AgentLensCrewAIBridge:
    """Small task-shaped bridge for CrewAI-style agent, task, tool, and final answer events."""

    def __init__(
        self,
        run: AgentLensRun,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.run = run
        self.provider = provider
        self.model = model
        self.metadata = metadata or {}

    def _metadata(self, agent: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        defaults = dict(self.metadata)
        if agent is not None:
            defaults["agent"] = agent
        return _metadata("crewai", defaults, extra)

    def agent_message(self, agent: str, content: Any, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        name = str(data.pop("name", agent))
        return self.run.add_event(
            "agent.message",
            name=name,
            output={"role": agent, "content": _as_text(content)},
            metadata=self._metadata(agent, data),
        )

    def task_start(self, name: str, input: Optional[Any] = None, agent: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        return self.run.add_event(
            "agent.task.start",
            name=name,
            input=_json_safe(input),
            metadata=self._metadata(agent, data),
        )

    def task_end(
        self,
        name: str,
        output: Optional[Any] = None,
        duration_ms: Optional[float] = None,
        agent: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        data = dict(kwargs)
        if duration_ms is None:
            duration_ms = _pop_duration(data)
        return self.run.add_event(
            "agent.task.end",
            name=name,
            output=_json_safe(output),
            duration_ms=duration_ms,
            metadata=self._metadata(agent, data),
        )

    def tool_call(self, name: str, input: Optional[Any] = None, agent: Optional[str] = None, **kwargs: Any) -> Dict[str, Any]:
        data = dict(kwargs)
        return self.run.add_tool_call(
            name,
            input=_json_safe(input),
            metadata=self._metadata(agent, data),
        )

    def tool_result(
        self,
        name: str,
        output: Optional[Any] = None,
        duration_ms: Optional[float] = None,
        agent: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        data = dict(kwargs)
        if duration_ms is None:
            duration_ms = _pop_duration(data)
        return self.run.add_tool_result(
            name,
            output=_json_safe(output),
            duration_ms=duration_ms,
            metadata=self._metadata(agent, data),
        )

    def llm_call(
        self,
        name: str,
        input: Dict[str, Any],
        call: Callable[[Dict[str, Any]], Any],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        agent: Optional[str] = None,
        **kwargs: Any,
    ) -> Any:
        return trace_llm_call(
            self.run,
            name,
            input,
            call,
            provider=provider or self.provider,
            model=model or self.model,
            metadata=self._metadata(agent, dict(kwargs)),
        )

    def final_answer(
        self,
        name: str,
        input: Dict[str, Any],
        call: Callable[[Dict[str, Any]], Any],
        provider: Optional[str] = None,
        model: Optional[str] = None,
        agent: Optional[str] = None,
        **kwargs: Any,
    ) -> Any:
        return self.llm_call(name, input, call, provider=provider, model=model, agent=agent, **kwargs)


__all__ = [
    "ADAPTER_NAME",
    "AgentLensCrewAIBridge",
    "AgentLensLangChainBridge",
    "AgentLensLlamaIndexBridge",
]
