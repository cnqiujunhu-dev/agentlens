import { addEvent } from "../trace.js";

function normalizeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack
  };
}

function durationSince(startedAtMs) {
  return Math.max(0, Date.now() - startedAtMs);
}

function extractContent(result) {
  if (typeof result === "string") return result;
  return result?.content ?? result?.message?.content ?? result?.choices?.[0]?.message?.content ?? result?.text;
}

function extractUsage(result) {
  const usage = result?.usage;
  if (!usage) return undefined;

  return {
    inputTokens: usage.inputTokens ?? usage.prompt_tokens ?? usage.promptTokens,
    outputTokens: usage.outputTokens ?? usage.completion_tokens ?? usage.completionTokens,
    totalTokens: usage.totalTokens ?? usage.total_tokens,
    costUsd: usage.costUsd
  };
}

export async function traceLlmCall(run, options = {}, execute) {
  if (!run) throw new Error("traceLlmCall requires a run");
  if (typeof execute !== "function") throw new Error("traceLlmCall requires an execute function");

  const {
    name = "llm",
    provider,
    model,
    input,
    metadata = {}
  } = options;

  addEvent(run, {
    type: "llm.prompt",
    name,
    provider,
    model,
    input,
    metadata
  });

  const startedAtMs = Date.now();

  try {
    const result = await execute(input);
    const usage = extractUsage(result);
    addEvent(run, {
      type: "llm.response",
      name,
      provider,
      model,
      durationMs: durationSince(startedAtMs),
      usage,
      output: {
        content: extractContent(result),
        citations: result?.citations,
        raw: result
      },
      metadata
    });
    return result;
  } catch (error) {
    const normalized = normalizeError(error);
    addEvent(run, {
      type: "llm.response",
      name,
      provider,
      model,
      status: "error",
      durationMs: durationSince(startedAtMs),
      output: normalized,
      metadata
    });
    addEvent(run, {
      type: "error",
      name: `llm.${name}`,
      status: "error",
      output: normalized,
      metadata
    });
    throw error;
  }
}
