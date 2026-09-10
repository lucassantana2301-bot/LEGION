# LEGION Development Roadmap

### Phase 01: Foundation & Deterministic Demo Engine (Completed)
- [x] Domain modeling, PostgreSQL + Drizzle ORM schema
- [x] Provider abstractions (LLM, Sandbox, Git, Deployment)
- [x] Strongly typed Event Bus
- [x] Deterministic `DemoMissionEngine` simulating full agent loop & failure recovery
- [x] Flagship Mission Control UI, Agent Graph, Terminal, Tasks, Issues, and Command Palette

### Phase 02A: Runtime Hardening & Test Foundation (Completed)
- [x] Formal MissionEngine lifecycle
- [x] Hardened monotonic Event Bus
- [x] Path traversal protection
- [x] Modular Zustand selectors
- [x] Vitest test suite

### Phase 02B: Real Sandbox Execution & Live Telemetry (Completed)
- [x] E2B Sandbox Provider implementation (`@e2b/code-interpreter`) with Mock fallback
- [x] Server boundary route handlers (`/api/sandbox/diagnostic`, `/api/sandbox/execute`)
- [x] Server-side command validation and metacharacter protection
- [x] Real stdout/stderr streaming into `LegionTerminal` & `LiveActivityFeed`
- [x] Sandbox file operations (write, read, list) & path traversal containment
- [x] Cancellation via AbortSignal & timeout enforcement

### Phase 02C: First Real LLM Agent — Builder (Completed)
- [x] Vendor-agnostic LLM provider abstraction (`AnthropicLLMProvider`, `OpenAILLMProvider`, `MockLLMProvider`)
- [x] Autonomous Builder agent state machine (`IDLE`, `THINKING`, `PLANNING`, `EXECUTING_TOOL`, `OBSERVING`, `COMPLETED`, `FAILED`)
- [x] Restricted tool layer (`writeFile`, `readFile`, `listFiles`, `executeSafeCommand`)
- [x] Self-healing loop (compilation/runtime failure -> error observation -> code fix -> verification)
- [x] Prompt injection defenses and untrusted data boundary
- [x] NDJSON streaming API `/api/agent/builder` and Mission Control `RealBuilderCard`
- [x] Token, cost, and duration telemetry tracking

### Phase 03: Multi-Agent Orchestration — Commander & Sentinel
- [ ] Real Commander planning & task graph decomposition with structured schema outputs
- [ ] Real Sentinel QA gatekeeper, automated test verification & regression analysis
- [ ] Agent-to-agent structured messaging and coordination

### Phase 04: VCS Integration & Multi-agent Scaling
- [ ] GitHub App integration (branch creation, PR comments, commit verification)
- [ ] Dynamic agent scaling (adding Security Specialist, Performance Auditor, DevOps agents)
- [ ] Self-improving codebase memory & vector indexing
