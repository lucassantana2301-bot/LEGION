# LEGION Development Roadmap

### Phase 01: Foundation & Deterministic Demo Engine (Current)
- [x] Domain modeling, PostgreSQL + Drizzle ORM schema
- [x] Provider abstractions (LLM, Sandbox, Git, Deployment)
- [x] Strongly typed Event Bus
- [x] Deterministic `DemoMissionEngine` simulating full agent loop & failure recovery
- [x] Flagship Mission Control UI, Agent Graph, Terminal, Tasks, Issues, and Command Palette

### Phase 02: Real Agent Orchestration & Sandboxing
- [ ] Connect live LLM providers (Anthropic Claude 3.5 Sonnet / OpenAI GPT-4o)
- [ ] Implement live isolated container sandboxes (E2B / Docker)
- [ ] Live streaming telemetry via WebSockets / Server-Sent Events (SSE)
- [ ] Multi-turn autonomous tool use and automated AST refactoring

### Phase 03: VCS Integration & Multi-agent Scaling
- [ ] GitHub App integration (branch creation, PR comments, commit verification)
- [ ] Dynamic agent scaling (adding Security Specialist, Performance Auditor, DevOps agents)
- [ ] Self-improving codebase memory & vector indexing
