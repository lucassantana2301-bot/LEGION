import { Agent } from "@/types/domain";

export const INITIAL_AGENTS: Agent[] = [
  {
    id: "commander",
    role: "COMMANDER",
    name: "COMMANDER",
    tagline: "Strategic Orchestrator & Coordinator",
    description:
      "Deconstructs high-level missions, analyzes requirements, formulates actionable plans, assigns tasks, enforces loop detection, and coordinates agent workflows.",
    status: "IDLE",
    capabilities: [
      "Mission analysis & breakdown",
      "Dynamic task graph planning",
      "Agent orchestration & routing",
      "Loop detection & circuit breaking",
      "Human-in-the-loop approval escalation",
    ],
    metrics: {
      completedTasks: 48,
      failedValidations: 2,
      averageRuntimeMs: 1450,
      issuesDiscovered: 0,
      tokensConsumed: 184500,
    },
    limits: {
      maxRetries: 3,
      tokenBudget: 500000,
      maxIterations: 50,
    },
  },
  {
    id: "architect",
    role: "ARCHITECT",
    name: "ARCHITECT",
    tagline: "System Architecture & Contract Specifier",
    description:
      "Designs domain architecture, chooses technology stacks, crafts database schemas, defines API contracts, and validates architectural integrity.",
    status: "IDLE",
    capabilities: [
      "System topology & tech stack design",
      "Database schema & migration specs",
      "REST & GraphQL contract modeling",
      "Security & auth boundary specification",
      "Component modularization",
    ],
    metrics: {
      completedTasks: 36,
      failedValidations: 0,
      averageRuntimeMs: 2300,
      issuesDiscovered: 1,
      tokensConsumed: 242000,
    },
    limits: {
      maxRetries: 3,
      tokenBudget: 500000,
      maxIterations: 40,
    },
  },
  {
    id: "builder",
    role: "BUILDER",
    name: "BUILDER",
    tagline: "Code Implementation & Bug Fix Engine",
    description:
      "Constructs frontend components, backend endpoints, database queries, API handlers, integrates third-party services, and implements bug fixes.",
    status: "IDLE",
    capabilities: [
      "Full-stack Next.js & React development",
      "TypeScript strict implementation",
      "PostgreSQL & Drizzle ORM integration",
      "RESTful API & Server Actions",
      "Automated bug triage and hotfixing",
    ],
    metrics: {
      completedTasks: 112,
      failedValidations: 14,
      averageRuntimeMs: 3800,
      issuesDiscovered: 4,
      tokensConsumed: 890000,
    },
    limits: {
      maxRetries: 5,
      tokenBudget: 1000000,
      maxIterations: 100,
    },
  },
  {
    id: "sentinel",
    role: "SENTINEL",
    name: "SENTINEL",
    tagline: "Quality Assurance & Gatekeeper",
    description:
      "Enforces software quality, executes unit and integration test suites, performs strict code review, identifies regressions, creates issues, and blocks defect progression.",
    status: "IDLE",
    capabilities: [
      "Automated test runner & coverage audit",
      "Security vulnerability scanner",
      "Type safety & lint verification",
      "Issue extraction & reproduction logging",
      "Quality gatekeeper & release validation",
    ],
    metrics: {
      completedTasks: 94,
      failedValidations: 18,
      averageRuntimeMs: 1900,
      issuesDiscovered: 23,
      tokensConsumed: 320000,
    },
    limits: {
      maxRetries: 3,
      tokenBudget: 400000,
      maxIterations: 60,
    },
  },
];
