# AGENTS.md — Guidelines for AI Agents Working on LEGION

Welcome to the **LEGION** codebase. As an autonomous or paired engineering agent working on this repository, you must strictly uphold the following design, architectural, and operational rules:

---

## 1. Core Principles

1. **Domain-First Engineering**: Domain models in `src/types/domain.ts` and event definitions in `src/types/events.ts` are the source of truth. Never invent ad-hoc types or use `any`.
2. **Event-Driven Reactivity**: Never tightly couple UI components to business logic. Components must emit or subscribe to typed events via `legionEventBus`.
3. **No Direct Vendor Lock-in**: Never import SDKs directly into UI or orchestration layers. Use the provider abstractions in `src/lib/providers/`.
4. **Security by Design**: Never execute arbitrary shell commands directly on the host server or browser client. All runtime execution must target isolated sandbox contracts.
5. **Human in the Loop**: Always require explicit approvals for schema migrations, destructive file operations, and production deployments.

---

## 2. Coding & Design Conventions

- **Visual Direction**: Dark, precise, technical, minimal, developer-tool styling (like Linear, Raycast, Vercel). No excessive neon, cyberpunk scanlines, or decorative particle effects.
- **Design Tokens**: Use CSS variables and semantic classes (`bg-surface`, `bg-surfaceRaised`, `border-border`, `text-accent`, etc.) defined in `src/app/globals.css`.
- **State Slices**: Keep state modular. Avoid monolithic stores. Separate mission runtime, agents, tasks/issues, activity feed, and terminal state.
- **Type Safety**: Maintain strict TypeScript compliance with zero compiler warnings (`npx tsc --noEmit`).

---

## 3. Agent Roles in LEGION

- **COMMANDER**: Coordinates execution, formulates task graphs, breaks infinite loops.
- **ARCHITECT**: Specifier of systems, schemas, and API contracts.
- **BUILDER**: Full-stack implementer and bug fixer.
- **SENTINEL**: Gatekeeper, test executor, regression detector, and quality protector.
