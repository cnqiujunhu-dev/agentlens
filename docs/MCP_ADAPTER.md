# MCP Adapter MVP

AgentLens includes a lightweight MCP-style tracing helper and a zero-dependency stdio JSON-RPC transport demo. The helper wraps the tool-call boundary used by an agent or MCP client and records the call as AgentLens trace events.

## Why This Exists

MCP tool calls are high-value trace points:

- They often cross a trust boundary.
- They may read files, call internal APIs, or mutate systems.
- They are easy to demo but hard to debug after the fact.

The MVP focuses on capturing:

- server name
- tool name
- tool schemas and tool inventory
- input
- output
- permission metadata
- inferred tool risk
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

## Tool Inventory And Risk Scan

Use `scanMcpTools` when you have a `tools/list` response or a local list of MCP-style tool definitions:

```js
import { addMcpToolManifest, scanMcpTools } from "agentlens";

const tools = [
  {
    name: "policy.lookup",
    description: "Read refund policy text by topic.",
    permission: "read-only",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" }
      }
    }
  }
];

const scan = scanMcpTools({ server: "local-policy-server", tools });
addMcpToolManifest(run, { server: "local-policy-server", tools });
```

The scanner classifies tools as `low`, `medium`, `high`, or `critical` risk from explicit permissions, annotations, tool names, descriptions, and schema input keys. The manifest is stored as an `mcp.tools` event so a trace can show both the tool call and the server capability surface.

Run the local demo:

```bash
npm run demo:mcp
node ./bin/agentlens.js replay .agentlens/runs/mcp-demo.json
node ./bin/agentlens.js eval .agentlens/runs/mcp-demo.json --config evals/default.json
node ./bin/agentlens.js eval .agentlens/runs/mcp-demo.json --config evals/mcp-policy.json
```

Run the stdio transport demo:

```bash
npm run demo:mcp:stdio
node ./bin/agentlens.js replay .agentlens/runs/mcp-stdio-demo.json
node ./bin/agentlens.js eval .agentlens/runs/mcp-stdio-demo.json --config evals/mcp-policy.json
```

The stdio demo starts `examples/mcp-stdio-server.mjs` as a child process and uses newline-delimited JSON-RPC messages for `initialize`, `tools/list`, and `tools/call`.

## Policy Evals

`evals/mcp-policy.json` includes the first MCP-focused policy pack:

- `allowed-mcp-servers`
- `required-tool-metadata`
- `forbidden-tool-permissions`
- `forbidden-mcp-tool-risks`
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

Risk rule example:

```json
{
  "id": "no-high-risk-tools",
  "type": "forbidden-mcp-tool-risks",
  "risks": ["high", "critical"]
}
```

Reviewed exception example:

```json
{
  "id": "reviewed-risk-policy",
  "type": "forbidden-mcp-tool-risks",
  "risks": ["high", "critical"],
  "requireExceptionOwner": true,
  "requireExceptionExpiry": true,
  "exceptions": [
    {
      "server": "internal-db-tools",
      "tool": "database.backup",
      "risk": "high",
      "owner": "platform-team",
      "expiresAt": "2026-12-31T00:00:00.000Z",
      "reason": "reviewed backup-only operation"
    }
  ]
}
```

If an exception has `expiresAt` in the past, AgentLens treats it as invalid and the risk is no longer suppressed. Use `requireExceptionOwner` and `requireExceptionExpiry` when you want CI to fail ownerless or permanent high-risk exceptions.

## Next Steps

- Add server/tool allowlists.
- Add richer dashboards for exception review history.
