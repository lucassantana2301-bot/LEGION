# LEGION Security Architecture

## Security by Design Principles

1. **Host Isolation**: Agents never execute code or shell commands on the host application server. All dynamic workloads execute within isolated containerized sandboxes (Docker / Firecracker / E2B).
2. **Zero Client Secret Exposure**: API keys and database credentials reside exclusively in server-side environment variables and are never bundled into client-side JavaScript.
3. **Strict Input Validation**: All external payloads and user instructions are strictly validated with Zod schemas.
4. **Human-in-the-Loop Safeguards**: High-risk operations (production database migrations, branch deletions, production releases) require explicit human approval via the Approval modal.
5. **Execution Budgets & Circuit Breakers**: Finite token limits, max iteration constraints, and loop detection algorithms prevent runaway recursive agent execution.
