# LEGION // PHASE 02B: Real Sandbox Execution & Live Telemetry

## Overview
Phase 02B introduces LEGION's first **real execution capability**, deploying an isolated execution pipeline that runs verified commands within a secure containerized sandbox environment rather than on the host application server.

---

## 1. Architecture & Execution Flow

```
[ LEGION UI // Mission Control ]
      │
      ├─► Trigger: "RUN DIAGNOSTIC" or command dispatch
      │
[ SERVER BOUNDARY // Route Handler: /api/sandbox/diagnostic ]
      │
      ├─► Command & Path Validation (`assertValidCommand`, `resolveSandboxPath`)
      ├─► Sandbox Service (`src/lib/sandbox/sandbox-service.ts`)
      │
[ PROVIDER ABSTRACTION LAYER ]
      │
      ├─► E2BSandboxProvider (`@e2b/code-interpreter`) / MockSandboxProvider fallback
      │
[ ISOLATED SANDBOX ENVIRONMENT ]
      │
      ├─► Command Execution: `node --version`, `npm --version`, `echo`
      ├─► File Operations: `writeFile`, `readFile`, `listFiles`
      ├─► Security Barrier: Path traversal containment check
      │
[ LIVE TELEMETRY // NDJSON Streaming ]
      │
      ├─► Typed Events: `SANDBOX_CREATED`, `EXECUTION_OUTPUT`, `FILE_CREATED`, etc.
      ▼
[ CLIENT EVENT BUS (`legionEventBus`) ]
      │
      ├─► LegionTerminal (Live stdout/stderr stream)
      └─► LiveActivityFeed (Event audit trail)
```

---

## 2. Sandbox Provider & Lifecycle

- **Chosen Provider**: E2B Sandbox (`@e2b/code-interpreter`) with `MockSandboxProvider` fallback.
- **Contract Interface**: `src/lib/providers/sandbox.ts`
- **Lifecycle States**:
  1. `CREATE`: Allocates isolated ephemeral container.
  2. `READY`: Verifies environment readiness.
  3. `EXECUTE`: Runs validated command with streaming stdout/stderr callbacks.
  4. `READ/WRITE FILES`: Operates within designated workspace root (`/workspace` or `/home/user`).
  5. `DESTROY`: Guaranteed teardown and resource release in `finally` block.

---

## 3. Security Boundaries & Guardrails

1. **Host Isolation**: Zero direct `child_process.exec`, `spawn`, or `execSync` calls on the Next.js host server.
2. **Command Validation Allowlist**: Strict server-side validation (`src/lib/sandbox/command-validator.ts`) rejects forbidden shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `>`, `<`).
3. **Path Traversal Containment**: `resolveSandboxPath` prevents escape from sandbox root (e.g. `../secret` throws `SandboxPathError`).
4. **Execution Timeout**: Enforced via `SANDBOX_TIMEOUT_MS` (default 30,000ms).
5. **Output Truncation**: Enforced via `MAX_OUTPUT_BYTES` (64KB) and `MAX_TERMINAL_LINES` (500).
6. **Zero Secret Leakage**: Sanitizer strips `E2B_API_KEY` from logs, terminal outputs, and error traces.

---

## 4. What is Real vs What is Demo

| Component | Status in Phase 02B | Description |
| :--- | :--- | :--- |
| **Sandbox Execution** | **REAL** | Runs real isolated containers via E2B Sandbox (or mock provider when awaiting credentials). |
| **Command Telemetry** | **REAL** | Real stdout/stderr streaming from sandbox to `LegionTerminal`. |
| **File Verification** | **REAL** | Real filesystem operations inside sandbox environment. |
| **Demo Mission Engine** | **DEMO** | Preserved for full-lifecycle deterministic demonstration without API cost. |
| **LLM Reasoning** | *Future Phase* | Planned for Phase 02C (Claude / GPT-4o autonomous tool routing). |

---

## 5. Known Limitations

- In Phase 02B, execution is restricted to safe diagnostic and allowlisted inspection commands to prove the pipeline before giving autonomous multi-agent tool access in Phase 02C.
