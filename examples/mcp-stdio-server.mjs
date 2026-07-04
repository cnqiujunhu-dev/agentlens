import readline from "node:readline";

const tools = [
  {
    name: "policy.lookup",
    description: "Look up a support policy by topic.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string"
        }
      },
      required: ["topic"]
    }
  }
];

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function rejectRequest(id, code, message, data = undefined) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } })}\n`);
}

async function handleRequest(message) {
  if (message.method === "initialize") {
    respond(message.id, {
      protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: "agentlens-demo-policy-server",
        version: "0.1.0"
      }
    });
    return;
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "tools/list") {
    respond(message.id, { tools });
    return;
  }

  if (message.method === "tools/call") {
    const toolName = message.params?.name;
    const args = message.params?.arguments ?? {};

    if (toolName !== "policy.lookup") {
      rejectRequest(message.id, -32602, `Unknown tool: ${toolName}`);
      return;
    }

    const payload = {
      topic: args.topic,
      sourceId: "policy-refund-30d",
      text: "Damaged items can be refunded within 30 days with proof of purchase."
    };

    respond(message.id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(payload)
        }
      ],
      structuredContent: payload
    });
    return;
  }

  rejectRequest(message.id, -32601, `Unknown method: ${message.method}`);
}

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity
});

input.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    await handleRequest(JSON.parse(line));
  } catch (error) {
    console.error(error);
  }
});
