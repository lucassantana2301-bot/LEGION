# LEGION Architecture Documentation

## System Architecture Overview

```
[ LEGION UI / CLIENT ]
   │
   ├─► Event Bus Subscriptions (`legionEventBus`)
   ├─► Command Dispatches & Diagnostic Triggers
   │
[ SERVER BOUNDARY // Next.js App Router ]
   ├─► /api/agent/builder (NDJSON streaming LLM agent execution)
   ├─► /api/sandbox/diagnostic (NDJSON streaming telemetry)
   ├─► /api/sandbox/execute (Safe command runner)
   │
[ ORCHESTRATION & AGENT LAYER ]
   ├─► BuilderAgent (`src/lib/agent/builder-agent.ts`)
   ├─► Tool Layer (`src/lib/agent/tools.ts`)
   ├─► Modular State Slices (Zustand: mission, agents, tasks, activity, terminal)
   ├─► Demo Engine (`DemoMissionEngine`)
   └─► Sandbox Service (`SandboxService`)
        │
[ PROVIDER ABSTRACTION LAYER ]
   ├─► LLMProvider (AnthropicLLMProvider, OpenAILLMProvider, MockLLMProvider)
   ├─► SandboxProvider (E2BSandboxProvider, MockSandboxProvider)
   ├─► GitProvider (GitHub, GitLab, Mock)
   └─► DeploymentProvider (Vercel, AWS, Mock)
        │
[ ISOLATED EXECUTION ENVIRONMENT ]
   └─► E2B Container Sandbox (Ephemeral, Path-contained, Time-budgeted)
        │
[ STORAGE & PERSISTENCE ]
   └─► PostgreSQL + Drizzle ORM
```

## Modular Directory Layout
- `src/app`: Next.js App Router (pages, layouts, and `/api/agent`, `/api/sandbox` route handlers)
- `src/components`: Domain-specific components (`legion`, `missions`, `agents`, `graph`, `activity`, `terminal`, `tasks`, `approvals`)
- `src/lib/agent`: Real agent engines and tool definitions (`builder-agent.ts`, `tools.ts`)
- `src/lib/providers`: Decoupled provider contracts (`sandbox.ts`, `e2b-sandbox.ts`, `llm.ts`, `git.ts`, `deployment.ts`)
- `src/lib/sandbox`: Command validator, error taxonomy, and `SandboxService`
- `src/lib/events`: Type-safe Event Bus and event emitters
- `src/lib/db`: Drizzle ORM schema, migrations, and seeds
- `src/stores`: Modular Zustand state slices
- `src/types`: Domain models and event contracts
