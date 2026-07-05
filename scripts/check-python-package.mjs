import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const packageRoot = path.join(root, "python", "agentlens-trace");
const packageSrc = path.join(packageRoot, "src");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "agentlens-python-package-"));
const pycache = path.join(tmp, "pycache");
const traceFile = path.join(tmp, "python-package-demo.json");
const bin = path.join(root, "bin", "agentlens.js");
const evalConfig = path.join(root, "evals", "default.json");
const adapterSmoke = String.raw`
from agentlens_trace import AgentLensRun, TRACE_SCHEMA_VERSION, trace_async_llm_call, trace_llm_call
from agentlens_trace.adapters import AgentLensCrewAIBridge, AgentLensLangChainBridge, AgentLensLlamaIndexBridge

class Obj:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)

class PromptValue:
    def to_messages(self):
        return [Obj(type="human", content="Can object-shaped prompts be traced?")]

class EnumLike:
    def __init__(self, value=None, name=None):
        self.value = value
        self.name = name
    def __str__(self):
        return self.value or self.name or "EnumLike"

assert TRACE_SCHEMA_VERSION == "agentlens.trace.v1"
run = AgentLensRun(app="adapter-smoke", name="object payload smoke")

langchain = AgentLensLangChainBridge(run, provider="mock-provider")
langchain.on_llm_start(Obj(model_name="object-model"), PromptValue())
langchain.on_llm_end(Obj(
    content="Object-shaped LangChain responses work.",
    citations=[Obj(metadata={"doc_id": "doc_object"})],
    usage_metadata={"inputTokens": 3, "outputTokens": 4, "totalTokens": 7},
))

llamaindex = AgentLensLlamaIndexBridge(run)
llamaindex.event_start(EnumLike(value="retrieve"), {EnumLike(name="QUERY_STR"): "refund policy"})
llamaindex.event_end(EnumLike(value="retrieve"), {EnumLike(value="nodes"): [{"id": "node_object", "score": 0.9}]})

crewai = AgentLensCrewAIBridge(run, provider="mock-provider", model="object-model")
crewai.agent_message("planner", Obj(content="Plan with object payloads."))
crewai.final_answer(
    "crew-final-answer",
    {"messages": [{"role": "user", "content": "Can CrewAI helpers call models?"}]},
    lambda _input: {"content": "Yes.", "citations": ["crew_doc"]},
    agent="reviewer",
)

events = run.to_dict()["events"]
assert any(event.get("metadata", {}).get("adapter") == "agentlens_trace.adapters" for event in events)
assert any(event.get("input", {}).get("messages", [{}])[0].get("role") == "human" for event in events if event["type"] == "llm.prompt")
assert any("doc_object" in event.get("output", {}).get("citations", []) for event in events if event["type"] == "llm.response")
assert any(event["type"] == "retrieval.query" and event.get("input", {}).get("query") == "refund policy" for event in events)
assert AgentLensLangChainBridge and AgentLensLlamaIndexBridge and AgentLensCrewAIBridge
assert trace_async_llm_call and trace_llm_call
`;

function pythonCandidates() {
  if (process.env.PYTHON) return [[process.env.PYTHON, []]];
  return process.platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];
}

function findPython() {
  for (const [command, baseArgs] of pythonCandidates()) {
    const result = spawnSync(command, [...baseArgs, "-c", "import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (result.status === 0) return [command, baseArgs];
  }
  throw new Error("Python 3.8+ is required for npm run python:package");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      PYTHONPATH: [
        packageSrc,
        process.env.PYTHONPATH
      ].filter(Boolean).join(path.delimiter),
      PYTHONPYCACHEPREFIX: pycache
    }
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
    throw new Error(`${command} ${args.join(" ")} failed\n${output}`);
  }
  return result;
}

const pyproject = fs.readFileSync(path.join(packageRoot, "pyproject.toml"), "utf8");
for (const snippet of [
  'name = "agentlens-trace"',
  'version = "0.2.0"',
  'requires-python = ">=3.8"'
]) {
  if (!pyproject.includes(snippet)) throw new Error(`pyproject.toml missing ${snippet}`);
}

const [pythonCommand, pythonBaseArgs] = findPython();
run(pythonCommand, [
  ...pythonBaseArgs,
  "-m",
  "py_compile",
  path.join(packageSrc, "agentlens_trace", "__init__.py"),
  path.join(packageSrc, "agentlens_trace", "__main__.py"),
  path.join(packageSrc, "agentlens_trace", "adapters", "__init__.py")
]);
run(pythonCommand, [
  ...pythonBaseArgs,
  "-c",
  adapterSmoke
]);
run(pythonCommand, [...pythonBaseArgs, "-m", "agentlens_trace", "--out", traceFile], { stdio: "inherit" });
run(process.execPath, [bin, "validate", "trace", traceFile], { stdio: "inherit" });
run(process.execPath, [bin, "eval", traceFile, "--config", evalConfig], { stdio: "inherit" });
run(process.execPath, [bin, "scan", traceFile], { stdio: "inherit" });

console.log(`Python package smoke trace: ${traceFile}`);
