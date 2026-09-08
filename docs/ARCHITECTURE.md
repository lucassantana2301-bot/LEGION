# LEGION Architecture Documentation

## System Architecture Overview

```
[ LEGION UI / CLIENT ]
   │
   ├─► Event Bus Subscriptions (`legionEventBus`)
   └─► Command Dispatches
        │
[ ORCHESTRATION LAYER ]
   │
   ├─► Commander Engine (Decomposition, Routing, Circuit Breakers)
   ├─► Modular State Slices (Zustand)
   └─► Demo & Real Execution Engines
        │
[ PROVIDER ABSTRACTION LAYER ]
   ├─► LLMProvider (OpenAI, Anthropic, Gemini, Mock)
   ├─► SandboxProvider (Docker, Firecracker, E2B, Mock)
   ├─► GitProvider (GitHub, GitLab, Mock)
   └─► DeploymentProvider (Vercel, AWS, Mock)
        │
[ STORAGE & PERSISTENCE ]
   └─► PostgreSQL + Drizzle ORM
```

## Modular Directory Layout
- `src/app`: Next.js App Router (pages and layouts)
- `src/components`: Domain-specific components (`legion`, `missions`, `agents`, `graph`, `activity`, `terminal`, `tasks`, `approvals`)
- `src/lib/providers`: Decoupled provider contracts and mocks
- `src/lib/events`: Type-safe Event Bus and event emitters
- `src/lib/db`: Drizzle ORM schema, migrations, and seeds
- `src/stores`: Modular Zustand state slices
- `src/types`: Domain models and event contracts
