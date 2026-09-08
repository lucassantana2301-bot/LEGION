# LEGION Architecture Documentation

## System Architecture Overview

```
[ LEGION UI / CLIENT ]
   │
   ├─► Event Bus Subscriptions (`legionEventBus`)
   ├─► Command Dispatches & Diagnostic Triggers
   │
[ SERVER BOUNDARY // Next.js App Router ]
   ├─► /api/sandbox/diagnostic (NDJSON streaming telemetry)
   ├─► /api/sandbox/execute (Safe command runner)
   │
[ ORCHESTRATION LAYER ]
   ├─► Commander Engine (Decomposition, Routing, Circuit Breakers)
   ├─► Modular State Slices (Zustand: mission, agents, tasks, activity, terminal)
   ├─► Demo Engine (`DemoMissionEngine`)
   └─► Sandbox Service (`SandboxService`)
        │
[ PROVIDER ABSTRACTION LAYER ]
   ├─► LLMProvider (OpenAI, Anthropic, Gemini, Mock)
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
- `src/app`: Next.js App Router (pages, layouts, and `/api/sandbox` route handlers)
- `src/components`: Domain-specific components (`legion`, `missions`, `agents`, `graph`, `activity`, `terminal`, `tasks`, `approvals`)
- `src/lib/providers`: Decoupled provider contracts (`sandbox.ts`, `e2b-sandbox.ts`, `llm.ts`, `git.ts`, `deployment.ts`)
- `src/lib/sandbox`: Command validator, error taxonomy, and `SandboxService`
- `src/lib/events`: Type-safe Event Bus and event emitters
- `src/lib/db`: Drizzle ORM schema, migrations, and seeds
- `src/stores`: Modular Zustand state slices
- `src/types`: Domain models and event contracts
