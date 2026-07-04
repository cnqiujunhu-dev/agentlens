# MCP Adapter MVP

AgentLens currently includes a lightweight MCP-style tracing helper. It does not implement the MCP transport protocol yet. Instead, it wraps the tool-call boundary used by an agent or MCP client and records the call as AgentLens trace events.

## Why This Exists

MCP tool calls are high-value trace points:

- They often cross a trust boundary.
- They may read files, call internal APIs, or mutate systems.
- They are easy to demo but hard to debug after the fact.

The MVP focuses on capturing:

- server name
- tool name
- input
- output
- permission metadata
- duration
- errors

## Example

```js
import { createMcpRun, finishMcpRun, traceMcpToolCall } from "../src/adapters/mcp.js";

const run = createMcpRun({
  app: "mcp-demo-agent",
  name: "mcp policy lookup",
  server: "local-policy-server"
});

const result = await traceMcpToolCall(
  run,
  {
    server: "local-policy-server",
    tool: "policy.lookup",
    input: { topic: "damaged item refund" },
    permission: "read-only"
  },
  async (input) => ({
    topic: input.topic,
    sourceId: "policy-refund-30d",
    text: "Damaged items can be refunded within 30 days with proof of purchase."
  })
);

finishMcpRun(run, "passed");
```

Run the local demo:

```bash
npm run demo:mcp
node ./bin/agentlens.js replay .agentlens/runs/mcp-demo.json
node ./bin/agentlens.js eval .agentlens/runs/mcp-demo.json --config evals/default.json
node ./bin/agentlens.js eval .agentlens/runs/mcp-demo.json --config evals/mcp-policy.json
```

## Policy Evals

`evals/mcp-policy.json` includes the first MCP-focused policy pack:

- `allowed-mcp-servers`
- `required-tool-metadata`
- `forbidden-tool-permissions`
- `max-errors`
- `required-citations`

Example rule:

```json
{
  "id": "no-write-tools",
  "type": "forbidden-tool-permissions",
  "permissions": ["write", "admin", "destructive"]
}
```

This lets teams fail CI when an agent calls a write-capable or destructive tool without an explicit policy change.

## Next Steps

- Add a real MCP client/server transport example.
- Add server/tool allowlists.
- Add schema capture for tool definitions.
- Add a scanner for dangerous MCP capabilities.
