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

function textFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return undefined;

  const text = blocks
    .map((block) => {
      if (typeof block === "string") return block;
      if (typeof block?.text === "string") return block.text;
      if (typeof block?.content === "string") return block.content;
      return undefined;
    })
    .filter(Boolean)
    .join("");

  return text || undefined;
}

function extractContent(result) {
  if (typeof result === "string") return result;

  const chatContent = result?.choices?.[0]?.message?.content;
  const directContent = result?.content ?? result?.message?.content ?? result?.text;

  return (
    result?.output_text ??
    (typeof chatContent === "string" ? chatContent : textFromBlocks(chatContent)) ??
    (typeof directContent === "string" ? directContent : textFromBlocks(directContent)) ??
    textFromBlocks(result?.output)
  );
}

function extractUsage(result) {
  const usage = result?.usage;
  if (!usage) return undefined;

  return {
    inputTokens: usage.inputTokens ?? usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokens,
    outputTokens: usage.outputTokens ?? usage.output_tokens ?? usage.completion_tokens ?? usage.completionTokens,
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

export async function traceOpenAiCompatibleChat(run, options = {}) {
  const { client, params, name = "chat.completions.create", metadata = {} } = options;
  if (!client?.chat?.completions || typeof client.chat.completions.create !== "function") {
    throw new Error("traceOpenAiCompatibleChat requires client.chat.completions.create");
  }
  if (!params || typeof params !== "object") {
    throw new Error("traceOpenAiCompatibleChat requires params");
  }

  return traceLlmCall(
    run,
    {
      name,
      provider: "openai-compatible",
      model: params.model,
      input: params,
      metadata: { adapter: "openai-compatible-chat", ...metadata }
    },
    () => client.chat.completions.create(params)
  );
}

export async function traceAnthropicCompatibleMessage(run, options = {}) {
  const { client, params, name = "messages.create", metadata = {} } = options;
  if (!client?.messages || typeof client.messages.create !== "function") {
    throw new Error("traceAnthropicCompatibleMessage requires client.messages.create");
  }
  if (!params || typeof params !== "object") {
    throw new Error("traceAnthropicCompatibleMessage requires params");
  }

  return traceLlmCall(
    run,
    {
      name,
      provider: "anthropic-compatible",
      model: params.model,
      input: params,
      metadata: { adapter: "anthropic-compatible-message", ...metadata }
    },
    () => client.messages.create(params)
  );
}
