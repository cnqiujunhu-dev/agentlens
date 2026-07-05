# LLM SDK Wrapper Cookbook

Use this guide when you already have an LLM SDK call and want AgentLens traces without changing providers, routing through a gateway, or adding an observability backend.

AgentLens does not require an OpenAI, Anthropic, LangChain, LangGraph, AutoGen, CrewAI, or MCP dependency. The wrapper records what your code sends and receives, then writes a local trace that can be replayed, evaluated, scanned, redacted, bundled, and attached to a pull request.

## Choose A Wrapper

| Existing call shape | AgentLens helper | Use when |
| --- | --- | --- |
| Any async function | `traceLlmCall` | You have a custom client, gateway, local model, or nonstandard response object. |
| `client.chat.completions.create(params)` | `traceOpenAiCompatibleChat` | Your SDK uses the OpenAI chat-completions shape or an OpenAI-compatible gateway. |
| `client.messages.create(params)` | `traceAnthropicCompatibleMessage` | Your SDK uses a message-creation shape with `content` blocks and `usage`. |

All three helpers produce the same core event pair:

- `llm.prompt`
- `llm.response`

If the SDK call throws, AgentLens records an error `llm.response` plus an `error` event, then rethrows the original error so your application behavior stays intact.

## Generic SDK Wrapper

Use `traceLlmCall` when you want full control over the SDK call:

```js
import { createRun, finishRun, traceLlmCall, writeTrace } from "agentlens";

const run = createRun({
  app: "support-agent",
  name: "refund-answer",
  metadata: {
    requestId: "req_123",
    environment: "ci"
  }
});

try {
  const result = await traceLlmCall(
    run,
    {
      name: "final-answer",
      provider: "my-provider",
      model: "my-model",
      input: {
        messages: [{ role: "user", content: "Can I refund this order?" }]
      },
      metadata: {
        route: "support.refund"
      }
    },
    async (input) => {
      return myLlmClient.chat(input);
    }
  );

  finishRun(run, result?.content ? "passed" : "failed");
} catch (error) {
  finishRun(run, "failed");
  throw error;
} finally {
  writeTrace(".agentlens/runs/refund-answer.json", run);
}
```

`traceLlmCall` stores the raw SDK result under `output.raw` and tries to normalize a display-friendly `output.content`, `output.citations`, and `usage`.

## OpenAI-Compatible Chat

Use `traceOpenAiCompatibleChat` when your client exposes `chat.completions.create`:

```js
import { createRun, finishRun, traceOpenAiCompatibleChat, writeTrace } from "agentlens";

const run = createRun({
  app: "support-agent",
  name: "openai-compatible-chat"
});

try {
  await traceOpenAiCompatibleChat(run, {
    client,
    params: {
      model: "gpt-compatible-model",
      messages: [
        { role: "system", content: "Answer with citations." },
        { role: "user", content: "What is the refund window?" }
      ]
    },
    metadata: {
      route: "support.refund"
    }
  });

  finishRun(run, "passed");
} catch (error) {
  finishRun(run, "failed");
  throw error;
} finally {
  writeTrace(".agentlens/runs/openai-compatible-chat.json", run);
}
```

This helper normalizes common usage keys such as `prompt_tokens`, `completion_tokens`, and `total_tokens`.

## Anthropic-Compatible Messages

Use `traceAnthropicCompatibleMessage` when your client exposes `messages.create`:

```js
import { createRun, finishRun, traceAnthropicCompatibleMessage, writeTrace } from "agentlens";

const run = createRun({
  app: "support-agent",
  name: "anthropic-compatible-message"
});

try {
  await traceAnthropicCompatibleMessage(run, {
    client,
    params: {
      model: "message-model",
      max_tokens: 512,
      messages: [{ role: "user", content: "Summarize this ticket." }]
    },
    metadata: {
      route: "support.summary"
    }
  });

  finishRun(run, "passed");
} catch (error) {
  finishRun(run, "failed");
  throw error;
} finally {
  writeTrace(".agentlens/runs/anthropic-compatible-message.json", run);
}
```

This helper extracts text from common content block shapes such as `{ text: "..." }` and normalizes usage keys such as `input_tokens` and `output_tokens`.

## Capture Useful Metadata

Prefer stable, low-cardinality metadata that helps review a run:

```js
const run = createRun({
  app: "checkout-agent",
  name: "coupon-resolution",
  metadata: {
    environment: process.env.CI ? "ci" : "local",
    commit: process.env.GITHUB_SHA,
    requestId: request.id
  }
});
```

Good event metadata:

- route or workflow name
- prompt version
- eval pack name
- retrieval index name
- tool permission level
- agent role

Avoid storing raw secrets, API keys, bearer tokens, customer emails, or full authorization headers. Use `agentlens redact` or `agentlens share` before attaching traces to public issues.

## Run Evals And Scans

After writing traces, use the same local artifact in CI:

```bash
agentlens eval .agentlens/runs/refund-answer.json --config evals/default.json
agentlens scan .agentlens/runs/refund-answer.json
agentlens dashboard .agentlens/runs/refund-answer.json --out .agentlens/reports/refund-answer.html --sections summary,scan,tool-calls,filters,timeline
```

For a directory of traces:

```bash
agentlens ci --runs .agentlens/runs --config evals/default.json --scan --pr-comment-md .agentlens/reports/agentlens-pr-comment.md
agentlens bundle .agentlens/runs --out .agentlens/reports/bundle --sections summary,scan,tool-calls,filters,timeline
```

## GitHub Actions Pattern

```yaml
- name: Run AgentLens evals
  uses: cnqiujunhu-dev/agentlens@v0.2.0
  with:
    runs: .agentlens/runs
    config: evals/default.json
    scan-fail-on: high
    pr-comment: .agentlens/reports/agentlens-pr-comment.md
    bundle: .agentlens/reports/bundle
    bundle-sections: summary,scan,tool-calls,filters,timeline
```

This gives reviewers:

- a CI pass/fail status
- a stable PR comment body
- scan findings that can block high-risk traces
- a static run bundle with `index.html` and `manifest.json`
- individual dashboards with timeline filters and tool call groups

## Error Handling Pattern

Always finish failed runs explicitly:

```js
try {
  await traceLlmCall(run, options, execute);
  finishRun(run, "passed");
} catch (error) {
  finishRun(run, "failed");
  throw error;
} finally {
  writeTrace(".agentlens/runs/current.json", run);
}
```

The helper records the LLM error event. Your `catch` block marks the whole run as failed and keeps your application semantics unchanged.

## When To Use A Platform Too

Use AgentLens when you need local, reviewable evidence for a run. Add Langfuse, Phoenix, OpenLIT, LangSmith, Braintrust, Helicone, OpenLLMetry, or a general APM stack when you also need long-term retention, hosted dashboards, prompt registries, production alerts, user analytics, human review queues, or fleet-wide telemetry.

The two approaches can coexist: AgentLens can be your local and PR artifact layer while a platform handles production monitoring.
