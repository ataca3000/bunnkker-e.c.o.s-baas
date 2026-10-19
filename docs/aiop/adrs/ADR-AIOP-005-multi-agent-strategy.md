# ADR-AIOP-005: Multi-Agent Strategy
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  

---

## Context

AIOP must support multiple AI agents simultaneously. Today: Claude Code. Near-term: Gemini CLI, Codex. Long-term: custom agents, domain-specific agents, test-only agents, architecture-review agents.

Each agent has different:
- CLI invocation syntax
- Output formats
- Capability sets (some agents write code, others only review)
- Rate limits and cost profiles
- Reliability characteristics

We need an architecture that supports routing tasks to the right agent without hard-coding agent-specific logic into the orchestration layer.

---

## Decision

### Multi-Agent Strategy: Capability-Based Routing via Connector Abstraction

#### Agent Registry
Each AI agent is registered in the `aiop_agents` table with:
- Unique identifier and human-readable name
- Connector class name (the implementation)
- Supported capabilities (a set of capability tags)
- Configuration schema (CLI path, API key reference, model version)

#### Capability Tags
Tasks declare one or more required capabilities. Agents are matched by capability intersection.

```
Capability Tags:
  code_generation       Can write new code
  code_review          Can review existing code
  test_generation      Can write unit/integration tests
  refactoring          Can refactor existing code
  documentation        Can write/update documentation
  architecture_review  Can evaluate architecture decisions
  security_audit       Can identify security vulnerabilities
  bug_fix              Can diagnose and fix bugs
  migration_writing    Can write database migrations
```

#### Connector Interface
Each AI provider implements the `AgentConnector` interface:
```
interface AgentConnector {
  getName(): string
  getCapabilities(): string[]
  buildInvocation(task: AiopTask, workspace: string): ProcessInvocation
  parseOutput(stdout: string, stderr: string): AgentOutput
  handleTimeout(): void
  handleError(error: Error): FailureReason
}
```

#### Task-to-Agent Routing

When a task enters the queue, the Assignment Service:
1. Reads the task's required capabilities
2. Queries available workers with a capable registered agent
3. Applies routing rules (load balance, preferred agent, cost ceiling)
4. Assigns the task to the winning worker

#### Assignment Rules (in priority order)
1. **Pinned Agent:** If the task specifies a required agent, only that agent is eligible
2. **Capability Match:** Task capabilities ⊆ Agent capabilities
3. **Workspace Scope:** Worker must be registered to the task's workspace
4. **Load Balance:** Prefer the worker with the fewest active executions
5. **Cost Ceiling:** If a task has a maximum cost budget, exclude agents above it

---

## Connector Implementations (Phase 1)

### Claude Code Connector
- Invokes: `claude --print --allowedTools "Bash,Edit,Write,Read,Glob,Grep" --model claude-sonnet-5`
- Context: Task description + repository context injected as initial prompt
- Output: Parses Claude Code's structured output (tool use, result, final message)
- Timeout: 30 minutes default (configurable per task)

### Gemini CLI Connector
- Invokes: `gemini --prompt-file {task_file} --output json`
- Context: Task description in a temporary prompt file
- Output: Parses Gemini's JSON output format
- Timeout: 20 minutes default

### Stub Connector (Testing)
- Simulates a successful execution with a pre-defined artifact
- Used for integration testing of the AIOP platform itself

---

## Agent Versioning

Each connector records the AI agent version used for each execution:
- `claude_version`: reported by `claude --version`
- `model_version`: the model identifier (e.g., `claude-sonnet-5`)
- `connector_version`: the ECOS connector implementation version

This enables rollback analysis — if a model version consistently produces poor results, executions can be filtered and re-run with a different version.

---

## Future Connectors

### Domain-Specific Agents
- Security Audit Agent: specialized for vulnerability scanning
- Database Migration Agent: specialized for schema evolution
- Test Generation Agent: specialized for test suite expansion

### Team-Specific Agents
- Organizations can register custom agents (e.g., an internal fine-tuned model) by implementing the connector interface

---

## Consequences

### Positive
- New AI providers require only a new connector class — zero changes to orchestration
- Capability-based routing enables intelligent task-agent matching
- Version tracking enables retrospective analysis of agent performance

### Negative
- Connector interface must be stable; breaking changes require all connectors to update
- Capability tags require consensus — teams must agree on what each tag means
