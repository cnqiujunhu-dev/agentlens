# OpenTelemetry Export

AgentLens can export a local AgentLens trace file as OTLP JSON with OpenInference-style semantic attributes. This is meant for teams that want AgentLens' local PR artifacts and still need a bridge toward Phoenix, Langfuse, OpenLIT, or an existing OpenTelemetry pipeline.

## CLI

Write OTLP JSON to a file:

```bash
agentlens otel .agentlens/runs/demo.json --out .agentlens/reports/demo.otlp.json
```

Print OTLP JSON to stdout:

```bash
agentlens otel .agentlens/runs/demo.json
```

Override the emitted resource service name:

```bash
agentlens otel .agentlens/runs/demo.json --service-name support-agent --out .agentlens/reports/support-agent.otlp.json
```

## JavaScript API

```js
import { buildOtelTrace, writeOtelTrace } from "agentlens";

const otlp = buildOtelTrace(trace, {
  serviceName: "support-agent"
});

const result = writeOtelTrace({
  traceFile: ".agentlens/runs/demo.json",
  out: ".agentlens/reports/demo.otlp.json",
  serviceName: "support-agent"
});

console.log(otlp.resourceSpans.length);
console.log(result.traceId, result.spans);
```

You can also import the focused module:

```js
import { buildOtelTrace, writeOtelTrace } from "agentlens/otel";
```

## Output Shape

The export writes an OTLP JSON `TracesData`-style object:

- Top level: `resourceSpans`.
- Resource attributes: `service.name`, `agentlens.app`, and `agentlens.run.id`.
- Scope name: `agentlens`.
- One root span for the AgentLens run with `openinference.span.kind = AGENT`.
- Child spans derived from trace events.

AgentLens pairs common start/end events into single spans:

- `llm.prompt` + `llm.response` -> `openinference.span.kind = LLM`
- `tool.call` + `tool.result` -> `openinference.span.kind = TOOL`
- `retrieval.query` + `retrieval.result` -> `openinference.span.kind = RETRIEVER`
- `framework.node.start` + `framework.node.end` -> `openinference.span.kind = CHAIN`
- `agent.task.start` + `agent.task.end` -> `openinference.span.kind = AGENT`

Unpaired events are exported as individual spans so no local trace evidence is silently dropped.

## Attributes

The exporter keeps AgentLens-specific evidence and adds interoperability-oriented attributes:

- OpenInference style: `openinference.span.kind`, `input.mime_type`, `input.value`, `output.mime_type`, `output.value`, `llm.model_name`, `llm.input_messages.*`, `llm.output_messages.*`, `tool.name`, and `retrieval.query`.
- Common GenAI style: `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, and `gen_ai.usage.*`.
- AgentLens-specific context: event ids, event types, run ids, MCP server, MCP permission, MCP risk, duration, status, and serialized metadata.

## Current Limits

- The exporter writes OTLP JSON to stdout or a file. It does not send data to a collector.
- It does not emit OTLP protobuf, gRPC, or HTTP collector requests yet.
- The output intentionally preserves trace payloads such as prompts, outputs, tool arguments, and retrieval documents. Run `agentlens redact` or `agentlens share` before publishing artifacts publicly.
- It is a bridge format, not a full production observability backend.

## References

- OpenTelemetry OTLP specification: https://opentelemetry.io/docs/specs/otlp/
- OpenTelemetry Protocol File Exporter: https://opentelemetry.io/docs/specs/otel/protocol/file-exporter/
- OpenInference specification: https://arize-ai.github.io/openinference/spec/
- OpenInference semantic conventions: https://arize-ai.github.io/openinference/spec/semantic_conventions.html
