# Agent Connector Architecture
## ECOS AI Operations Platform

**Document ID:** AIOP-AC-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Design Goal

The connector layer ensures the AIOP platform is vendor-agnostic. Any AI coding agent — whether Claude Code, Gemini CLI, GitHub Copilot Workspace, OpenAI Codex, or a future custom agent — can be integrated without changing the Worker, Control Plane, or task model. The only change required is adding a new connector class.

---

## 2. Connector Interface

Every agent connector must implement the `AgentConnector` interface:

```
Interface: AgentConnector

Methods:

  isAvailable(): bool
    — Check whether the agent binary/CLI is installed and accessible.
    — Returns false if the agent is not available on this worker machine.
    — Used during startup to validate agent presence.

  getVersion(): string | null
    — Return the agent's current version string.
    — Returns null if the agent is unavailable.
    — Example: "1.5.7", "2024-12", null

  getCapabilities(): string[]
    — Return the list of capability tags this agent supports.
    — Must match the tags declared in the AiopAgent registry record.
    — Example: ["code_generation", "refactoring", "test_writing", "explanation"]

  run(
    task: TaskDescriptor,
    workspacePath: string,
    environment: Map<string, string>
  ): ExecutionResult
    — Execute the task.
    — task:          the task description, type, context, and steps
    — workspacePath: absolute path to the isolated workspace (git repo cloned here)
    — environment:   decrypted secrets and task context as env vars
    — Returns:       ExecutionResult (see below)
    — Throws:        ConnectorException on fatal errors

  abort(): void
    — Terminate the running execution immediately.
    — Called when timeout occurs or the operator sends a cancel command.
    — Must guarantee the process is killed and all resources are released.
```

### TaskDescriptor

```
TaskDescriptor {
  task_id:              string
  execution_id:         string
  title:                string
  description:          string       // Full prompt for the AI agent
  type:                 string       // "feature", "bug_fix", "refactor", etc.
  priority:             string
  target_branch:        string
  repository_url:       string
  context:              Map<string, any>   // Structured supplementary context
  steps:                TaskStep[]         // Optional sub-steps if decomposed
  model:                string | null      // Override default model ("claude-sonnet-5")
  timeout_seconds:      integer
  max_tokens:           integer | null
}
```

### ExecutionResult

```
ExecutionResult {
  success:              bool
  exit_code:            integer
  failure_code:         string | null     // "timeout", "agent_crash", "test_failure"
  failure_message:      string | null
  tokens_used:          integer | null
  model_version:        string | null
  agent_version:        string | null
  duration_seconds:     integer
  files_modified:       string[]          // List of modified file paths
  report_summary:       string | null     // 1-paragraph AI-authored summary
  identified_risks:     string[]
  tests_passed:         integer | null
  tests_failed:         integer | null
  confidence_score:     decimal | null    // 0.0 – 1.0
}
```

---

## 3. Connector Implementations

### 3.1 ClaudeCodeConnector

The primary connector for Anthropic's Claude Code CLI.

**Invocation method:** Shell command via subprocess within the Docker container.

**Command pattern:**
```
claude \
  --model {model} \
  --max-tokens {max_tokens} \
  --no-interactive \
  --output-format json \
  --workspace {workspace_path} \
  -p "{task_prompt}"
```

**Prompt construction:** The connector builds a structured prompt by combining:
1. Task title and description (from TaskDescriptor)
2. Task type framing ("You are performing a {type} task")
3. Structured context (from task.context)
4. Output format instructions (what to produce: code diff, report, test results)
5. Quality requirements (tests must pass, no breaking changes, follow existing patterns)

**Environment variables injected:**
```
ANTHROPIC_API_KEY       — from aiop_secrets
CLAUDE_CODE_WORKSPACE   — workspace_path
AIOP_TASK_ID            — task_id
AIOP_EXECUTION_ID       — execution_id
```

**Output parsing:**
- Claude Code outputs JSON in `--output-format json` mode
- Connector parses the JSON to extract: summary, modified files, tokens used, confidence
- If JSON parsing fails, falls back to text scraping for key fields

**Version check command:** `claude --version`

**Capabilities declared:**
- `code_generation`
- `bug_fixing`
- `refactoring`
- `test_writing`
- `code_explanation`
- `documentation`
- `security_audit`
- `code_review`

---

### 3.2 GeminiCliConnector

Connector for Google's Gemini CLI code agent.

**Invocation method:** Shell command via subprocess.

**Command pattern:**
```
gemini \
  --model gemini-2.5-pro \
  --task-file {task_file_path} \
  --workspace {workspace_path} \
  --output-format json
```

**Task file:** Because Gemini CLI accepts task prompts as a file (rather than inline argument), the connector writes a task file to the workspace before invocation:
- Path: `{workspace_path}/.aiop/task.md`
- Content: Structured markdown with the task description and context

**Environment variables injected:**
```
GOOGLE_API_KEY          — from aiop_secrets
GEMINI_MODEL            — model override
```

**Capabilities declared:**
- `code_generation`
- `bug_fixing`
- `refactoring`
- `test_writing`
- `code_explanation`

---

### 3.3 StubConnector (Testing)

A mock connector for local development and integration testing.

**Behavior:**
- `isAvailable()` → always true
- `getVersion()` → "0.0.1-stub"
- `run()` → sleeps for 5 seconds, then returns a fake successful ExecutionResult
- Produces a synthetic diff and report without touching any actual files
- Useful for testing the worker daemon, control plane, and UI without AI API calls

---

### 3.4 Custom Connector Template

Organizations building their own agents can implement the `AgentConnector` interface. Required steps:
1. Implement the interface (5 methods)
2. Register in `config/aiop.php`:
   ```
   'connectors' => [
     'claude-code' => ClaudeCodeConnector::class,
     'gemini-cli'  => GeminiCliConnector::class,
     'my-agent'    => \App\Aiop\MyAgentConnector::class,
   ]
   ```
3. Create an `AiopAgent` registry record via the AIOP admin UI or seeder

---

## 4. Connector Registration and Resolution

The Worker daemon resolves the connector at startup:

```
1. Worker reads its configured `agent.type` from config.json
2. Worker requests agent metadata from: GET /api/aiop/agents/{slug}
3. Control plane returns: connector_class, capabilities, configuration_schema
4. Worker instantiates the connector class:
   $connector = new ClaudeCodeConnector($config)
5. Worker calls $connector->isAvailable() — if false, logs error and stays offline
6. Worker calls $connector->getVersion() — logged in heartbeat response
```

---

## 5. Capability Routing (Control Plane Side)

When a task is submitted, the control plane selects a suitable worker using capability matching:

```
Task.required_capabilities = ["code_generation", "test_writing"]

Available Workers:
  Worker A (ClaudeCode): capabilities = ["code_generation", "test_writing", "refactoring"]  ← MATCH
  Worker B (GeminiCli):  capabilities = ["code_generation"]                                  ← PARTIAL MISS
  Worker C (ClaudeCode): capabilities = ["documentation"]                                    ← NO MATCH

Assignment Rules (priority order):
  1. Worker must have ALL required_capabilities (not a subset)
  2. If task has preferred_agent_id → prefer workers running that agent
  3. Among eligible workers → choose the one with the longest idle time
  4. If multiple workers tied → random selection
  5. If no eligible worker → task stays QUEUED, notification sent
```

---

## 6. Connector Error Taxonomy

Connectors must translate raw errors into typed `failure_code` values:

| Condition | failure_code | Worker Action |
|---|---|---|
| CLI not found / not installed | `agent_unavailable` | Mark worker offline |
| API key invalid / rejected | `api_auth_failed` | Fail execution; alert admin |
| API rate limit hit | `rate_limited` | Fail execution; retry after delay |
| Agent exceeds timeout | `timeout` | Kill container; fail execution |
| Out of memory (container OOM) | `out_of_memory` | Kill container; fail execution |
| Agent returns non-zero exit | `agent_crash` | Collect crash log; fail execution |
| Agent output unparseable | `output_parse_error` | Fail execution; attach raw output |
| Git diff computation fails | `diff_generation_failed` | Fail execution |
| Test runner reports failure | `test_failure` | Complete execution; flag in report |

The distinction between `test_failure` (execution complete, tests failed) and `agent_crash` (execution did not complete) is important: `test_failure` results are still uploaded and reviewed; `agent_crash` results may be partial.

---

## 7. Connector Versioning

Connectors are versioned independently of the Worker daemon:

- Connector classes have a `CONNECTOR_VERSION` constant (e.g., `"1.2.0"`)
- The version is reported in heartbeats and stored in execution records
- The connector version is part of the artifact metadata to enable historical comparison
- When a connector is updated (e.g., new prompt engineering), the version increments, allowing before/after analysis in the AIOP reporting UI

---

## 8. Multi-Agent Execution (Future)

Phase 2 consideration: tasks that benefit from multiple agent passes:

```
Task: Implement feature
  Step 1: [Agent A: ClaudeCode] → Generate implementation
  Step 2: [Agent B: GeminiCli]  → Independent code review of Agent A's output
  Step 3: [Agent A: ClaudeCode] → Apply Agent B's review suggestions
```

This is not implemented in Phase 1. It requires the control plane to support step-level agent assignment and artifact passing between steps. Designed for Phase 3 roadmap.
