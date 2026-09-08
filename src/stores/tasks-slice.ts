// Tasks and Issues State Slice

import { create } from "zustand";
import { Issue, Task } from "@/types/domain";
import { LegionEvent } from "@/types/events";
import { legionEventBus } from "@/lib/events/bus";

export interface TasksSliceState {
  tasks: Task[];
  issues: Issue[];
  selectedTaskId: string | null;
  selectTask: (taskId: string | null) => void;
  initialize: () => void;
}

const INITIAL_TASKS: Task[] = [
  {
    id: "TASK-001",
    missionId: "mission-001",
    order: 1,
    title: "Define system topology and technology stack",
    description: "Specify Next.js App Router, PostgreSQL schema, and security boundaries.",
    assignedRole: "ARCHITECT",
    status: "COMPLETED",
    priority: "HIGH",
    dependencies: [],
    attempts: 1,
    maxAttempts: 3,
    acceptanceCriteria: ["Tech stack approved", "Module isolation defined"],
    affectedFiles: ["docs/ARCHITECTURE.md"],
    testIds: [],
    issueIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "TASK-002",
    missionId: "mission-001",
    order: 2,
    title: "Configure PostgreSQL schema & Drizzle ORM relations",
    description: "Draft tables for users, organizations, transactions, and audit logs.",
    assignedRole: "ARCHITECT",
    status: "COMPLETED",
    priority: "HIGH",
    dependencies: ["TASK-001"],
    attempts: 1,
    maxAttempts: 3,
    acceptanceCriteria: ["Foreign keys verified", "Indexes optimized"],
    affectedFiles: ["src/lib/db/schema.ts"],
    testIds: [],
    issueIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "TASK-008",
    missionId: "mission-001",
    order: 3,
    title: "Implement authentication & session management",
    description: "Create OAuth callback handlers, JWT verification, and middleware protections.",
    assignedRole: "BUILDER",
    status: "IN_PROGRESS",
    priority: "HIGH",
    dependencies: ["TASK-002"],
    attempts: 1,
    maxAttempts: 3,
    acceptanceCriteria: [
      "Callback URL preservation",
      "Secure cookie encryption",
      "Session invalidation on logout",
    ],
    affectedFiles: ["src/lib/auth.ts", "src/app/api/auth/route.ts"],
    testIds: ["TEST-008"],
    issueIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "TASK-009",
    missionId: "mission-001",
    order: 4,
    title: "Develop financial transactions dashboard & ledger",
    description: "Build charts, data grids, filter bars, and export helpers.",
    assignedRole: "BUILDER",
    status: "BACKLOG",
    priority: "MEDIUM",
    dependencies: ["TASK-008"],
    attempts: 0,
    maxAttempts: 3,
    acceptanceCriteria: ["Real-time aggregations", "Accessible tables"],
    affectedFiles: ["src/components/dashboard/ledger.tsx"],
    testIds: [],
    issueIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "TASK-010",
    missionId: "mission-001",
    order: 5,
    title: "Run automated integration tests & regression suite",
    description: "Validate authentication edge cases and database concurrency.",
    assignedRole: "SENTINEL",
    status: "BACKLOG",
    priority: "HIGH",
    dependencies: ["TASK-008", "TASK-009"],
    attempts: 0,
    maxAttempts: 3,
    acceptanceCriteria: ["100% core path coverage", "Zero critical regressions"],
    affectedFiles: ["tests/auth.test.ts", "tests/ledger.test.ts"],
    testIds: [],
    issueIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const useTasksSlice = create<TasksSliceState>((set) => {
  let isSubscribed = false;

  const handleEvent = (event: LegionEvent) => {
    const nowIso = new Date().toISOString();

    switch (event.type) {
      case "TASK_ASSIGNED":
      case "TASK_STARTED":
      case "TASK_REVIEW":
      case "TASK_COMPLETED":
      case "TASK_FAILED":
      case "TASK_BLOCKED":
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === event.taskId
              ? { ...t, status: event.status, assignedRole: event.assignedRole, updatedAt: nowIso }
              : t
          ),
        }));
        break;

      case "ISSUE_CREATED":
        set((s) => {
          const newIssue: Issue = {
            id: event.issueId,
            missionId: event.missionId,
            taskId: event.taskId,
            title: event.title,
            description: event.message,
            severity: event.severity,
            status: event.status,
            reportedByRole: event.reportedByRole,
            assignedToRole: event.assignedToRole,
            createdAt: nowIso,
          };
          return {
            issues: [newIssue, ...s.issues.filter((i) => i.id !== event.issueId)],
          };
        });
        break;

      case "ISSUE_ASSIGNED":
      case "ISSUE_RESOLVED":
        set((s) => ({
          issues: s.issues.map((i) =>
            i.id === event.issueId
              ? {
                  ...i,
                  status: event.status,
                  resolvedAt: event.status === "RESOLVED" ? nowIso : undefined,
                }
              : i
          ),
        }));
        break;
    }
  };

  return {
    tasks: INITIAL_TASKS,
    issues: [
      {
        id: "ISSUE-004",
        missionId: "mission-001",
        taskId: "TASK-008",
        title: "Authentication redirect does not preserve callback URL",
        description: "When unauthenticated users visit protected routes, the login redirect forgets their destination query parameter.",
        severity: "HIGH",
        status: "OPEN",
        reportedByRole: "SENTINEL",
        assignedToRole: "BUILDER",
        stackTrace: "AssertionError: expected undefined to equal '/dashboard'\n  at src/lib/auth.ts:42:15",
        affectedFile: "src/lib/auth.ts",
        proposedFix: "Preserve callbackUrl parameter in authorization redirect middleware.",
        createdAt: new Date(Date.now() - 240000).toISOString(),
      },
    ],
    selectedTaskId: null,
    selectTask: (taskId) => set({ selectedTaskId: taskId }),
    initialize: () => {
      if (!isSubscribed) {
        legionEventBus.subscribe("*", handleEvent);
        isSubscribed = true;
      }
    },
  };
});
