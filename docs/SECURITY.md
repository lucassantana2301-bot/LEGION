# LEGION Security Architecture

## Security by Design Principles

1. **Host Isolation**: Agents never execute code or shell commands directly on the host application server (`child_process` on host is strictly forbidden). All dynamic workloads execute within isolated containerized sandboxes (E2B).
2. **Server Boundary Enforcement**: The browser client never communicates directly with sandbox SDKs or third-party providers. All interactions route through authenticated server route handlers (`/api/sandbox/*`).
3. **Server-side Command Validation**: Commands are validated against a strict allowlist (`src/lib/sandbox/command-validator.ts`). Shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `>`, `<`) are rejected before execution.
4. **Path Traversal Containment**: All file operations verify path containment via `resolveSandboxPath`, blocking attempts to escape the root workspace (e.g. `../secret`).
5. **Zero Client Secret Exposure & Log Redaction**: API keys and tokens reside exclusively in server-side environment variables (`E2B_API_KEY`, `DATABASE_URL`). Error messages and logs automatically redact sensitive tokens.
6. **Execution Budgets, Output Limits & Circuit Breakers**: Finite execution timeouts (`SANDBOX_TIMEOUT_MS`), output truncation (`MAX_OUTPUT_BYTES`), and iteration limits prevent resource exhaustion and runaway processes.
7. **Human-in-the-Loop Safeguards**: High-risk operations (production database migrations, destructive file modifications, production releases) require explicit human approval via the Approval modal.
