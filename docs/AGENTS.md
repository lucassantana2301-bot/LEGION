# LEGION Agent Roles & Specifications

### 1. COMMANDER
- **Role**: Chief Orchestrator & Coordinator
- **Responsibilities**: Mission deconstruction, task dependency formulation, routing, loop detection, and human approval escalation.
- **Capabilities**: Planning, triage, circuit breaker management.

### 2. ARCHITECT
- **Role**: System Architect & Specifier
- **Responsibilities**: Application structure, technical contracts, database schemas, security boundaries, and modularization.
- **Capabilities**: PostgreSQL schema modeling, API contract specification.

### 3. BUILDER (Phase 02C Real LLM Agent)
- **Role**: Implementation Engine & Code Problem Solver
- **Implementation Status**: **REAL** (Autonomous tool loop + E2B isolated sandbox execution).
- **Responsibilities**: Code generation, file manipulation, sandbox execution, syntax error self-correction, bug hotfixing.
- **State Machine**: `IDLE` -> `THINKING` -> `PLANNING` -> `EXECUTING_TOOL` -> `OBSERVING` -> `COMPLETED` / `FAILED` / `CANCELLED`.
- **Allowed Tools**: `writeFile`, `readFile`, `listFiles`, `executeSafeCommand`.
- **Capabilities**: Node.js, TypeScript, Next.js, automated self-healing execution loop.

### 4. SENTINEL
- **Role**: Quality Assurance & Gatekeeper
- **Responsibilities**: Test execution, regression isolation, code review, issue logging, quality validation before merge/release.
- **Capabilities**: Vitest, Playwright, AST static analysis, vulnerability auditing.
