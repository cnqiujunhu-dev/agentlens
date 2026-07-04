import { traceAnthropicCompatibleMessage, traceOpenAiCompatibleChat } from "../src/adapters/llm.js";
import { initWorkspace, writeTrace } from "../src/store.js";
import { createRun, finishRun } from "../src/trace.js";

initWorkspace(process.cwd());

const openAiCompatibleClient = {
  chat: {
    completions: {
      async create(params) {
        return {
          choices: [{ message: { content: `Tracing ${params.messages.length} chat message.` } }],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 7,
            total_tokens: 16
          }
        };
      }
    }
  }
};

const anthropicCompatibleClient = {
  messages: {
    async create() {
      return {
        content: [{ type: "text", text: "AgentLens can wrap provider-style SDK calls without a runtime dependency." }],
        citations: ["provider-adapter-demo"],
        usage: {
          input_tokens: 12,
          output_tokens: 11
        }
      };
    }
  }
};

const run = createRun({
  app: "provider-adapters-demo",
  name: "provider-style LLM adapter demo"
});

await traceOpenAiCompatibleChat(run, {
  client: openAiCompatibleClient,
  params: {
    model: "demo-chat-model",
    messages: [{ role: "user", content: "Trace an OpenAI-compatible chat call." }]
  }
});

await traceAnthropicCompatibleMessage(run, {
  client: anthropicCompatibleClient,
  params: {
    model: "demo-message-model",
    max_tokens: 128,
    messages: [{ role: "user", content: "Trace an Anthropic-compatible message call." }]
  }
});

finishRun(run, "passed");
writeTrace(".agentlens/runs/provider-adapters-demo.json", run);
console.log("Wrote .agentlens/runs/provider-adapters-demo.json");
