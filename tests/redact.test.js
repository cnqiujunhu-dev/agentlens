import test from "node:test";
import assert from "node:assert/strict";
import { parseRedactKeys, redactTrace } from "../src/redact.js";
import { addEvent, createRun, finishRun, validateTrace } from "../src/trace.js";

test("redactTrace redacts nested secret-like fields", () => {
  const trace = createRun({
    app: "redact-agent",
    name: "redaction test",
    metadata: {
      token: "top-secret-token"
    }
  });

  addEvent(trace, {
    type: "tool.call",
    name: "api.fetch",
    input: {
      url: "https://example.test",
      headers: {
        authorization: "Bearer secret",
        "x-api-key": "secret-key"
      },
      nested: {
        password: "secret-password",
        safe: "keep"
      }
    }
  });
  addEvent(trace, { type: "llm.response", name: "final", output: { content: "ok", citations: ["doc"] } });
  finishRun(trace, "passed");

  const redacted = redactTrace(trace);

  assert.equal(redacted.metadata.token, "[REDACTED]");
  assert.equal(redacted.events[0].input.headers.authorization, "[REDACTED]");
  assert.equal(redacted.events[0].input.headers["x-api-key"], "[REDACTED]");
  assert.equal(redacted.events[0].input.nested.password, "[REDACTED]");
  assert.equal(redacted.events[0].input.nested.safe, "keep");
  assert.equal(redacted.metadata.redacted, true);
  assert.equal(validateTrace(redacted).valid, true);
});

test("redactTrace preserves token usage counters", () => {
  const trace = createRun();
  addEvent(trace, {
    type: "llm.response",
    name: "final",
    usage: {
      inputTokens: 10,
      outputTokens: 5,
      totalTokens: 15
    },
    output: { content: "ok" }
  });
  finishRun(trace, "passed");

  const redacted = redactTrace(trace);

  assert.equal(redacted.events[0].usage.inputTokens, 10);
  assert.equal(redacted.events[0].usage.outputTokens, 5);
  assert.equal(redacted.events[0].usage.totalTokens, 15);
});

test("redactTrace supports custom redaction keys", () => {
  const trace = createRun();
  addEvent(trace, {
    type: "tool.call",
    name: "crm.lookup",
    input: {
      customerEmail: "user@example.test",
      query: "keep"
    }
  });
  finishRun(trace, "passed");

  const redacted = redactTrace(trace, { keys: ["email"], replacement: "***" });

  assert.equal(redacted.events[0].input.customerEmail, "***");
  assert.equal(redacted.events[0].input.query, "keep");
});

test("parseRedactKeys parses comma-separated keys", () => {
  assert.deepEqual(parseRedactKeys("email, ssn , account"), ["email", "ssn", "account"]);
});
