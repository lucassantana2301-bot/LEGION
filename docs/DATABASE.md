# LEGION Database Architecture

## Technology
- **Engine**: PostgreSQL 16+
- **ORM**: Drizzle ORM (`drizzle-orm`, `drizzle-kit`)

## Schema Entity Relationship
- `users`: Platform operators and developers
- `workspaces`: Multi-tenant organization containers
- `projects`: High-level software products (contains multiple Missions)
- `missions`: Scoped engineering missions with briefs and execution plans
- `agents`: Registered agent definitions, capabilities, and token metrics
- `agent_runs`: Historical execution traces for each agent invocation
- `tasks`: Decomposed engineering tasks with dependency chains
- `task_dependencies`: Directed acyclic graph (DAG) links between tasks
- `activity_events`: Real-time audit events emitted during mission execution
- `issues`: Quality defects logged by Sentinel and routed to Builder
- `test_runs`: Structured outputs from test executions
- `artifacts`: Sandbox file entries created and modified by agents
- `approvals`: Human-in-the-loop escalation requests
