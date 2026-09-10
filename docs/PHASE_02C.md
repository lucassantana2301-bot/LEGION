# LEGION // PHASE 02C — FIRST REAL LLM AGENT (BUILDER)

## Overview
Phase 02C activates LEGION's first real autonomous engineering agent: the **BUILDER**.
The Builder connects an isolated LLM provider abstraction directly to the secure E2B sandbox micro-VM environment through typed, restricted tool contracts.

---

## 1. Architecture Flow

```
[User Task in Mission Control]
          │
          ▼
[API Route /api/agent/builder (NDJSON Stream)]
          │
          ▼
[BuilderAgent Loop] ──(Emits Events)──► [legionEventBus] ──► [Live Telemetry Stream]
    │       ▲
    │       │ (Tool Results / Stderr)
    ▼       │
[LLM Provider (Anthropic / OpenAI / Mock)]
    │
    ▼ (Structured Tool Call)
[Tool Dispatcher (writeFile, readFile, listFiles, executeSafeCommand)]
    │
    ▼
[CommandValidator + Path Containment]
    │
    ▼
[E2BSandboxProvider (Isolated Micro-VM)]
```

---

## 2. Builder Capabilities & State Machine

### Supported States
- `IDLE`: Awaiting user task input.
- `THINKING`: Prompting LLM and formulating step.
- `PLANNING`: Analyzing multi-step architecture.
- `EXECUTING_TOOL`: Dispatching safe tool execution in sandbox.
- `OBSERVING`: Evaluating stdout/stderr and verifying test criteria.
- `COMPLETED`: Declared victory after verified output.
- `FAILED`: Aborted due to limit or fatal error.
- `CANCELLED`: Interrupted cleanly by user abort signal.

### Tool Contracts
1. `writeFile(path, content)`: Creates/updates workspace source files.
2. `readFile(path)`: Reads workspace files.
3. `listFiles(directoryPath?)`: Lists workspace structure.
4. `executeSafeCommand(command, timeoutMs?)`: Executes allowlisted commands (`node`, `npm`, `npx tsx`, `npx tsc`).

---

## 3. Security Boundaries & Guardrails

- **Zero Host Execution**: All commands execute strictly inside isolated E2B micro-VMs.
- **Prompt Injection Defense**: Workspace files and tool outputs (stdout/stderr) are labeled strictly as untrusted data in system prompts.
- **Iteration Budget**: Capped at max 10 iterations per run to prevent infinite runaway loops.
- **Cost & Token Tracking**: Accumulates prompt/completion tokens and estimated USD costs in real time.
- **Sandbox Lifecycle**: Sandboxes are guaranteed to be destroyed in `finally` blocks upon completion, failure, or cancellation.

---

## 4. Real vs Demo Capabilities

| Capability | Phase 02C Status | Implementation |
| :--- | :--- | :--- |
| **Builder LLM Agent** | **REAL** | Vendor-agnostic LLM provider with native tool calling |
| **Sandbox Environment** | **REAL** | E2B isolated Linux micro-VM container |
| **Self-Healing Loop** | **REAL** | Retries and fixes code upon compilation / runtime errors |
| **Commander / Sentinel Agents** | Demo / Contract | Ready for Phase 03 multi-agent orchestration |
| **GitHub Write Access** | Contract Only | Mock provider (Phase 04) |
| **Cloud Deployments** | Contract Only | Mock provider (Phase 05) |
