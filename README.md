# LEGION
### Autonomous Software Engineering Platform
**One Mission. Multiple Agents. Working Software.**

---

## What is LEGION?

**LEGION** is a next-generation autonomous software engineering platform. Rather than acting as a conversational chatbot, code snippet generator, or IDE wrapper, LEGION acts as an **AI Software Engineering Organization** that takes a high-level engineering mission and autonomously orchestrates, designs, implements, validates, and refines working software.

---

## The Four Core Agents

LEGION is powered by a synchronized organization of specialized AI agents:

| Agent | Role | Focus Areas |
| :--- | :--- | :--- |
| **COMMANDER** | Strategic Orchestrator | Decomposes mission requirements, formulates dependency graphs, assigns tasks, breaks loops, escalates human approvals. |
| **ARCHITECT** | System Designer & Contract Specifier | Determines application architecture, tech stack boundaries, database schemas (PostgreSQL / Drizzle), and API contracts. |
| **BUILDER** | Code Implementation Engine | Develops frontend interfaces, backend routes, database queries, third-party integrations, and applies bug hotfixes. |
| **SENTINEL** | Quality Assurance & Gatekeeper | Executes automated test suites, scans for regressions, isolates errors, creates structured issues, and validates task quality before release. |

---

## Mission Lifecycle & Failure Recovery Loop

```
USER
  ↓ (Mission Input)
COMMANDER
  ↓ (Mission Plan)
ARCHITECT
  ↓ (System Design & Schema)
COMMANDER
  ↓ (Task Assignment)
BUILDER
  ↓ (Implementation)
SENTINEL
  ↓ (Test Execution & Quality Gate)
  ├─ PASS ──→ COMMANDER ──→ BUILD & RELEASE ──→ MISSION COMPLETE
  └─ FAIL ──→ ISSUE CREATED ──→ BUILDER (HOTFIX) ──→ SENTINEL (RETEST)
```

---

## Architecture & Provider Abstractions

LEGION is engineered with low coupling and modular abstractions to prevent vendor lock-in:

- **LLM Provider**: Decoupled interface supporting OpenAI, Anthropic, Gemini, local Ollama, and deterministic mock providers.
- **Sandbox Provider**: Isolated execution environment contract (Docker, Firecracker, E2B, or sandbox mocks) isolating code execution from the main host.
- **Git Provider**: VCS interface managing branch lifecycles, structured commits, diff tracking, and pull request generation.
- **Deployment Provider**: Deployment interface staging previews and managing production deployments.

---

## Event System

All platform visualizers (Agent Topology Graph, Live Activity Stream, Terminal, Task Kanbans, and Metrics) subscribe to a single source of truth: `LEGION_EVENT_BUS`.

Typed events include:
- `MISSION_*`: `MISSION_STARTED`, `MISSION_PAUSED`, `MISSION_COMPLETED`, etc.
- `AGENT_*`: `AGENT_WORKING`, `AGENT_COMMUNICATION`, `AGENT_COMPLETED`, etc.
- `TASK_*`: `TASK_ASSIGNED`, `TASK_REVIEW`, `TASK_COMPLETED`, etc.
- `TEST_*`: `TEST_STARTED`, `TEST_PASSED`, `TEST_FAILED`.
- `ISSUE_*`: `ISSUE_CREATED`, `ISSUE_ASSIGNED`, `ISSUE_RESOLVED`.
- `APPROVAL_*`: `APPROVAL_REQUIRED`, `APPROVAL_GRANTED`, `APPROVAL_REJECTED`.

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router, Strict TypeScript)
- **Styling**: Tailwind CSS with CSS Variables / Design Tokens
- **Icons & Motion**: Lucide React & Framer Motion
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: Modular Zustand Slices (`mission`, `agents`, `tasks`, `activity`, `terminal`)
- **Validation**: Zod Schemas

---

## Local Development

```bash
# 1. Clone repository & install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the LEGION platform.

---

## Current Status: Phase 01

**Phase 01: Foundation + Deterministic Demo Engine**
- [x] Strict Domain Models and Typed Event System
- [x] Drizzle ORM PostgreSQL Schema & Migrations
- [x] Provider Abstraction Contracts (LLM, Sandbox, Git, Deployment)
- [x] Deterministic `DemoMissionEngine` simulating full Sentinel failure loop & build cycle
- [x] Interactive Mission Control, Agent Network Graph, Live Activity & Terminal
- [x] Human-in-the-loop Approval Modal & Command Palette (`Cmd+K`)
