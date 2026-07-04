import { spawn } from "node:child_process";
import readline from "node:readline";
import { addEvent } from "../trace.js";

export const MCP_PROTOCOL_VERSION = "2025-06-18";

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

export class McpStdioClient {
  constructor({ command, args = [], cwd = process.cwd(), env = process.env, timeoutMs = 5000 } = {}) {
    if (!command) throw new Error("McpStdioClient requires command");

    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.timeoutMs = timeoutMs;
    this.nextId = 1;
    this.pending = new Map();
    this.notifications = [];
    this.stderr = "";
    this.child = null;
  }

  start() {
    if (this.child) return this;

    this.child = spawn(this.command, this.args, {
      cwd: this.cwd,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });

    const lines = readline.createInterface({
      input: this.child.stdout,
      crlfDelay: Infinity
    });

    lines.on("line", (line) => this.#handleLine(line));
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString("utf8");
    });

    this.child.on("exit", (code, signal) => {
      const error = new Error(`MCP stdio server exited before response: code=${code}, signal=${signal}`);
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(error);
      }
      this.pending.clear();
    });

    return this;
  }

  async initialize(params = {}) {
    const result = await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "agentlens",
        version: "0.1.0"
      },
      ...params
    });
    this.notify("notifications/initialized");
    return result;
  }

  async listTools(params = {}) {
    return this.request("tools/list", params);
  }

  async callTool(name, input = {}) {
    return this.request("tools/call", {
      name,
      arguments: input
    });
  }

  request(method, params = {}) {
    if (!this.child) this.start();

    const id = this.nextId++;
    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };

    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP stdio request timed out: ${method}`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer, method });
    });

    this.#send(message);
    return promise;
  }

  notify(method, params = undefined) {
    if (!this.child) this.start();
    const message = {
      jsonrpc: "2.0",
      method
    };
    if (params !== undefined) message.params = params;
    this.#send(message);
  }

  close() {
    if (!this.child) return;
    if (!this.child.killed) this.child.kill();
    this.child = null;
  }

  #send(message) {
    this.child.stdin.write(`${JSON.stringify(message)}\n`, "utf8");
  }

  #handleLine(line) {
    if (!line.trim()) return;

    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`Invalid MCP stdio JSON message: ${error.message}`));
      }
      this.pending.clear();
      return;
    }

    if (message.id !== undefined && this.pending.has(message.id)) {
      const pending = this.pending.get(message.id);
      clearTimeout(pending.timer);
      this.pending.delete(message.id);

      if (message.error) {
        const error = new Error(message.error.message ?? `MCP request failed: ${pending.method}`);
        error.code = message.error.code;
        error.data = message.error.data;
        pending.reject(error);
      } else {
        pending.resolve(message.result);
      }
      return;
    }

    this.notifications.push(message);
  }
}

export async function traceMcpStdioToolCall(run, options = {}) {
  const {
    command,
    args = [],
    cwd = process.cwd(),
    env = process.env,
    server = "mcp-stdio-server",
    tool,
    input = {},
    permission = "unknown",
    timeoutMs = 5000
  } = options;

  if (!run) throw new Error("traceMcpStdioToolCall requires a run");
  if (!tool) throw new Error("traceMcpStdioToolCall requires tool");

  const client = new McpStdioClient({ command, args, cwd, env, timeoutMs });
  const metadata = {
    adapter: "mcp",
    protocol: "mcp",
    transport: "stdio",
    server,
    command,
    permission
  };

  try {
    client.start();
    const initializeResult = await client.initialize();
    const toolsResult = await client.listTools();
    const toolDefinition = toolsResult?.tools?.find((item) => item.name === tool);
    const startedAtMs = Date.now();

    addEvent(run, {
      type: "tool.call",
      name: tool,
      input,
      metadata: {
        ...metadata,
        protocolVersion: initializeResult?.protocolVersion,
        toolSchema: toolDefinition?.inputSchema
      }
    });

    const result = await client.callTool(tool, input);
    const status = result?.isError ? "error" : "ok";

    addEvent(run, {
      type: "tool.result",
      name: tool,
      status,
      durationMs: durationSince(startedAtMs),
      output: result,
      metadata
    });

    if (result?.isError) {
      addEvent(run, {
        type: "error",
        name: `mcp.${tool}`,
        status: "error",
        output: result,
        metadata
      });
    }

    return result;
  } catch (error) {
    const normalized = normalizeError(error);
    addEvent(run, {
      type: "tool.result",
      name: tool,
      status: "error",
      output: normalized,
      metadata
    });
    addEvent(run, {
      type: "error",
      name: `mcp.${tool}`,
      status: "error",
      output: normalized,
      metadata
    });
    throw error;
  } finally {
    client.close();
  }
}
