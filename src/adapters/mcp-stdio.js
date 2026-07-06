import { spawn } from "node:child_process";
import readline from "node:readline";
import { addEvent } from "../trace.js";
import { addMcpToolManifest } from "./mcp.js";

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

function tail(value, maxLength = 4000) {
  const text = String(value ?? "");
  return text.length > maxLength ? text.slice(-maxLength) : text;
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
    this.exitCode = null;
    this.exitSignal = null;
    this.spawnError = null;
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
      this.exitCode = code;
      this.exitSignal = signal;
      const error = new Error(`MCP stdio server exited before response: code=${code}, signal=${signal}`);
      this.#rejectPending(error);
      this.child = null;
    });

    this.child.on("error", (error) => {
      this.spawnError = normalizeError(error);
      this.#rejectPending(error);
    });

    return this;
  }

  async initialize(params = {}) {
    const result = await this.request("initialize", {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "agentlens",
        version: "0.3.0"
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

    let timer;
    const promise = new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP stdio request timed out after ${this.timeoutMs}ms: ${method}`));
      }, this.timeoutMs);

      this.pending.set(id, { resolve, reject, timer, method });
    });

    try {
      this.#send(message);
    } catch (error) {
      clearTimeout(timer);
      this.pending.delete(id);
      return Promise.reject(error);
    }

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
    this.#rejectPending(new Error("MCP stdio client closed before response"));
    if (!this.child.killed) {
      this.child.stdin.end();
      this.child.kill();
    }
    this.child = null;
  }

  diagnostics() {
    return {
      command: this.command,
      args: this.args,
      cwd: this.cwd,
      pid: this.child?.pid ?? null,
      pending: this.pending.size,
      notificationCount: this.notifications.length,
      stderrTail: tail(this.stderr),
      exitCode: this.exitCode,
      exitSignal: this.exitSignal,
      spawnError: this.spawnError
    };
  }

  #send(message) {
    if (!this.child?.stdin?.writable) {
      throw new Error("MCP stdio server stdin is not writable");
    }
    this.child.stdin.write(`${JSON.stringify(message)}\n`, "utf8");
  }

  #rejectPending(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  #handleLine(line) {
    if (!line.trim()) return;

    let message;
    try {
      message = JSON.parse(line);
    } catch (error) {
      this.#rejectPending(new Error(`Invalid MCP stdio JSON message: ${error.message}`));
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

export class McpStdioTraceSession {
  constructor(run, options = {}) {
    const {
      command,
      args = [],
      cwd = process.cwd(),
      env = process.env,
      server = "mcp-stdio-server",
      timeoutMs = 5000
    } = options;

    if (!run) throw new Error("McpStdioTraceSession requires a run");

    this.run = run;
    this.server = server;
    this.command = command;
    this.client = new McpStdioClient({ command, args, cwd, env, timeoutMs });
    this.initialized = false;
    this.initializeResult = null;
    this.toolsResult = null;
    this.manifest = null;
  }

  async initialize(params = {}) {
    if (this.initialized) return this;

    this.client.start();
    this.initializeResult = await this.client.initialize(params);
    this.toolsResult = await this.client.listTools();
    this.manifest = addMcpToolManifest(this.run, {
      server: this.server,
      tools: this.toolsResult?.tools ?? []
    });
    this.initialized = true;
    return this;
  }

  async callTool(tool, { input = {}, permission = undefined, metadata = {} } = {}) {
    if (!tool) throw new Error("McpStdioTraceSession.callTool requires tool");
    if (!this.initialized) await this.initialize();

    const toolDefinition = this.toolsResult?.tools?.find((item) => item.name === tool);
    const scannedTool = this.manifest?.tools?.find((item) => item.name === tool);
    const startedAtMs = Date.now();
    const eventMetadata = {
      adapter: "mcp",
      protocol: "mcp",
      transport: "stdio",
      server: this.server,
      command: this.command,
      permission: permission ?? scannedTool?.permission ?? "unknown",
      protocolVersion: this.initializeResult?.protocolVersion,
      serverInfo: this.initializeResult?.serverInfo,
      toolSchema: toolDefinition?.inputSchema,
      toolRisk: scannedTool?.risk,
      toolRiskReasons: scannedTool?.reasons,
      ...metadata
    };

    addEvent(this.run, {
      type: "tool.call",
      name: tool,
      input,
      metadata: eventMetadata
    });

    try {
      const result = await this.client.callTool(tool, input);
      const status = result?.isError ? "error" : "ok";
      const resultMetadata = {
        ...eventMetadata,
        diagnostics: this.client.diagnostics()
      };

      addEvent(this.run, {
        type: "tool.result",
        name: tool,
        status,
        durationMs: durationSince(startedAtMs),
        output: result,
        metadata: resultMetadata
      });

      if (result?.isError) {
        addEvent(this.run, {
          type: "error",
          name: `mcp.${tool}`,
          status: "error",
          output: result,
          metadata: resultMetadata
        });
      }

      return result;
    } catch (error) {
      const normalized = normalizeError(error);
      const errorMetadata = {
        ...eventMetadata,
        diagnostics: this.client.diagnostics()
      };

      addEvent(this.run, {
        type: "tool.result",
        name: tool,
        status: "error",
        durationMs: durationSince(startedAtMs),
        output: normalized,
        metadata: errorMetadata
      });
      addEvent(this.run, {
        type: "error",
        name: `mcp.${tool}`,
        status: "error",
        output: normalized,
        metadata: errorMetadata
      });
      throw error;
    }
  }

  diagnostics() {
    return this.client.diagnostics();
  }

  close() {
    this.client.close();
  }
}

export async function traceMcpStdioSession(run, options = {}, execute) {
  if (typeof execute !== "function") throw new Error("traceMcpStdioSession requires an execute function");

  const session = new McpStdioTraceSession(run, options);
  try {
    await session.initialize();
    return await execute(session);
  } finally {
    session.close();
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

  return traceMcpStdioSession(run, { command, args, cwd, env, server, timeoutMs }, (session) =>
    session.callTool(tool, { input, permission })
  );
}
