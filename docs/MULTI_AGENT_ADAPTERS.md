# Multi-Agent Adapters

AgentLens includes zero-dependency helpers for tracing AutoGen-style chats, CrewAI-style task crews, and other multi-agent workflows. The helpers do not import those frameworks. They record the same plain AgentLens JSON events around the agent turns and task functions you already control.

## Why This Exists

Multi-agent systems often fail between agents: a planner gives weak instructions, a researcher cites the wrong source, or a reviewer approves an unsafe draft. The multi-agent helpers capture:

- agent messages
- task start and end spans
- framework, workflow, agent, role, and task metadata
- task input and output summaries
- duration and errors
- final `llm.response` events for existing eval rules

## API

```js
import { addAgentMessage, createMultiAgentRun, finishRun, traceAgentTask } from "agentlens-devtools";

const run = createMultiAgentRun({
  app: "support-agent",
  name: "refund review",
  framework: "autogen",
  workflow: "planner-researcher-reviewer"
});

addAgentMessage(run, {
  agent: "planner",
  content: "Research the refund policy, then ask the reviewer to check it."
});

const research = await traceAgentTask(
  run,
  {
    agent: "researcher",
    role: "assistant",
    name: "lookup-refund-policy",
    input: { topic: "damaged item refund" }
  },
  async () => ({
    finding: "Damaged items can be refunded within 30 days.",
    citations: ["policy-refund-30d"]
  })
);

finishRun(run, "passed");
```

## Runnable Examples

AutoGen-style group chat:

```bash
npm run demo:autogen
node ./bin/agentlens.js replay .agentlens/runs/autogen-style-demo.json
node ./bin/agentlens.js eval .agentlens/runs/autogen-style-demo.json --config evals/multi-agent-basic.json
```

CrewAI-style task crew:

```bash
npm run demo:crewai
node ./bin/agentlens.js replay .agentlens/runs/crewai-style-demo.json
node ./bin/agentlens.js eval .agentlens/runs/crewai-style-demo.json --config evals/multi-agent-basic.json
```

## Events

The helpers record:

- `agent.message`
- `agent.task.start`
- `agent.task.end`
- `error` when a task throws

The examples also write a final `llm.response` so existing citation and final-answer eval rules work without special multi-agent logic.

`evals/multi-agent-basic.json` also gates workflow shape with `min-workflow-tasks` and `max-workflow-errors`, so CI fails when task boundary events are missing or a workflow error marker appears.

## Notes

Use `addAgentMessage` for visible conversation turns and `traceAgentTask` for work units such as research, planning, review, tool execution, or writing. Inside a task, you can still call `addEvent`, `traceLlmCall`, `traceMcpToolCall`, or any other AgentLens helper to capture model, tool, retrieval, and MCP activity.
