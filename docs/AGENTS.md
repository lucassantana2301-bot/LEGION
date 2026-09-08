# LEGION Agent Roles & Specifications

### 1. COMMANDER
- **Role**: Chief Orchestrator & Coordinator
- **Responsibilities**: Mission deconstruction, task dependency formulation, routing, loop detection, and human approval escalation.
- **Capabilities**: Planning, triage, circuit breaker management.

### 2. ARCHITECT
- **Role**: System Architect & Specifier
- **Responsibilities**: Application structure, technical contracts, database schemas, security boundaries, and modularization.
- **Capabilities**: PostgreSQL schema modeling, API contract specification.

### 3. BUILDER
- **Role**: Implementation Engine
- **Responsibilities**: Code generation, backend APIs, frontend interfaces, database integration, bug hotfixing.
- **Capabilities**: Next.js, React, TypeScript, Drizzle ORM.

### 4. SENTINEL
- **Role**: Quality Assurance & Gatekeeper
- **Responsibilities**: Test execution, regression isolation, code review, issue logging, quality validation before merge/release.
- **Capabilities**: Vitest, Playwright, AST static analysis, vulnerability auditing.
