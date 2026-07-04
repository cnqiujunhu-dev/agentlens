import test from "node:test";
import assert from "node:assert/strict";
import { traceLlmCall } from "../src/adapters/llm.js";
import { createRun } from "../src/trace.js";

test("traceLlmCall records prompt and response events", async () => {
  const run = createRun({ app: "llm-test", name: "success" });

  const result = await traceLlmCall(
    run,
    {
      name: "answer",
      provider: "mock",
      model: "demo",
      input: { messages: [{ role: "user", content: "hello" }] }
    },
    async () => ({
      choices: [{ message: { content: "hello back" } }],
      citations: ["doc-1"],
      usage: {
        prompt_tokens: 3,
        completion_tokens: 2,
        total_tokens: 5
      }
    })
  );

  assert.equal(result.choices[0].message.content, "hello back");
  assert.equal(run.events.length, 2);
  assert.equal(run.events[0].type, "llm.prompt");
  assert.equal(run.events[1].type, "llm.response");
  assert.equal(run.events[1].output.content, "hello back");
  assert.deepEqual(run.events[1].output.citations, ["doc-1"]);
  assert.equal(run.events[1].usage.inputTokens, 3);
  assert.equal(run.events[1].usage.outputTokens, 2);
});

test("traceLlmCall records errors", async () => {
  const run = createRun({ app: "llm-test", name: "failure" });

  await assert.rejects(
    () =>
      traceLlmCall(run, { name: "answer", input: { messages: [] } }, async () => {
        throw new Error("model unavailable");
      }),
    /model unavailable/
  );

  assert.equal(run.events.length, 3);
  assert.equal(run.events[1].type, "llm.response");
  assert.equal(run.events[1].status, "error");
  assert.equal(run.events[2].type, "error");
});
