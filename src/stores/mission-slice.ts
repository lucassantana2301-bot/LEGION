// Mission Runtime State Slice

import { create } from "zustand";
import { Mission, Approval } from "@/types/domain";
import { LegionEvent } from "@/types/events";
import { legionEventBus } from "@/lib/events/bus";
import { DemoMissionEngine } from "@/lib/engine/demo-engine";

export interface MissionSliceState {
  mission: Mission;
  elapsedSeconds: number;
  demoEngine: DemoMissionEngine | null;
  isDemoMode: boolean;
  approvals: Approval[];

  // Actions
  initialize: () => void;
  startMission: () => void;
  pauseMission: () => void;
  resumeMission: () => void;
  stopMission: () => void;
  sendUserCommand: (commandText: string) => void;
  respondToApproval: (approvalId: string, approved: boolean, note?: string) => void;
}

const INITIAL_MISSION: Mission = {
  id: "mission-001",
  projectId: "proj-001",
  workspaceId: "ws-001",
  title: "Build a financial SaaS with authentication, PostgreSQL and dashboard",
  prompt: "Create a financial SaaS for small businesses with authentication, PostgreSQL and dashboard.",
  brief: {
    requirements: [
      "Next.js App Router with TypeScript strict mode",
      "PostgreSQL relational schema with Drizzle ORM",
      "Secure session & OAuth callback preservation",
      "Financial dashboard with metrics and transaction audit logs",
      "Automated test coverage with Sentinel validation",
    ],
    constraints: [
      "Zero unhandled type errors",
      "Isolated sandboxed execution",
      "Human approval required for migrations",
    ],
    context: "Initial MVP production release for commercial fintech operations.",
  },
  plan: [
    { id: "p1", step: 1, title: "Define architecture & schema", description: "Architect specifications", assignedAgent: "ARCHITECT", status: "COMPLETED" },
    { id: "p2", step: 2, title: "Implement authentication", description: "Builder session logic", assignedAgent: "BUILDER", status: "IN_PROGRESS" },
    { id: "p3", step: 3, title: "Build financial dashboard", description: "Builder dashboard UI", assignedAgent: "BUILDER", status: "PENDING" },
    { id: "p4", step: 4, title: "Sentinel test & validation", description: "Sentinel verification", assignedAgent: "SENTINEL", status: "PENDING" },
    { id: "p5", step: 5, title: "Production build validation", description: "Zero error bundle check", assignedAgent: "COMMANDER", status: "PENDING" },
  ],
  status: "RUNNING",
  progressPercent: 63,
  totalTasks: 19,
  completedTasks: 12,
  failedTasks: 1,
  openIssuesCount: 1,
  tokensUsed: 52140,
  estimatedCostUsd: 0.42,
  maxIterations: 50,
  maxCostUsd: 10.0,
  startedAt: new Date(Date.now() - 761000).toISOString(),
  createdAt: new Date().toISOString(),
};

export const useMissionSlice = create<MissionSliceState>((set, get) => {
  let isSubscribed = false;
  let timerInterval: NodeJS.Timeout | null = null;

  const handleEvent = (event: LegionEvent) => {
    switch (event.type) {
      case "MISSION_STARTED":
        set((s) => ({ mission: { ...s.mission, status: "RUNNING" } }));
        break;
      case "MISSION_PAUSED":
        set((s) => ({ mission: { ...s.mission, status: "PAUSED" } }));
        break;
      case "MISSION_RESUMED":
        set((s) => ({ mission: { ...s.mission, status: "RUNNING" } }));
        break;
      case "MISSION_COMPLETED":
        set((s) => ({
          mission: { ...s.mission, status: "COMPLETED", progressPercent: 100 },
        }));
        break;
      case "MISSION_FAILED":
        set((s) => ({ mission: { ...s.mission, status: "FAILED" } }));
        break;
    }
  };

  return {
    mission: INITIAL_MISSION,
    elapsedSeconds: 761,
    demoEngine: null,
    isDemoMode: true,
    approvals: [
      {
        id: "APP-001",
        missionId: "mission-001",
        requestedByRole: "COMMANDER",
        actionTitle: "Run production database migration",
        description: "Apply Drizzle ORM schema migration for financial accounts & transactions tables.",
        risk: "HIGH",
        reason: "Schema changes detected in production environment boundary.",
        status: "PENDING",
        requestedAt: new Date(Date.now() - 120000).toISOString(),
      },
    ],

    initialize: () => {
      if (!isSubscribed) {
        legionEventBus.subscribe("*", handleEvent);
        isSubscribed = true;
      }

      if (!timerInterval) {
        timerInterval = setInterval(() => {
          const { mission } = get();
          if (mission.status === "RUNNING") {
            set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 }));
          }
        }, 1000);
      }

      if (!get().demoEngine) {
        set({ demoEngine: new DemoMissionEngine("mission-001") });
      }
    },

    startMission: () => {
      let engine = get().demoEngine;
      if (!engine) {
        engine = new DemoMissionEngine("mission-001");
        set({ demoEngine: engine });
      }
      set((s) => ({
        mission: { ...s.mission, status: "RUNNING" },
      }));
      engine.start();
    },

    pauseMission: () => {
      get().demoEngine?.pause();
      set((s) => ({ mission: { ...s.mission, status: "PAUSED" } }));
    },

    resumeMission: () => {
      get().demoEngine?.resume();
      set((s) => ({ mission: { ...s.mission, status: "RUNNING" } }));
    },

    stopMission: () => {
      get().demoEngine?.stop();
      set((s) => ({ mission: { ...s.mission, status: "CANCELLED" } }));
    },

    sendUserCommand: (commandText: string) => {
      const now = new Date().toISOString();
      legionEventBus.emit({
        id: `usr_${Date.now()}`,
        missionId: get().mission.id,
        timestamp: now,
        type: "TERMINAL_OUTPUT",
        stream: "COMMAND",
        text: `> user@legion: ${commandText}`,
      });

      // Dispatched command instruction event to orchestrator
      legionEventBus.emit({
        id: `cmd_resp_${Date.now()}`,
        missionId: get().mission.id,
        timestamp: new Date().toISOString(),
        type: "AGENT_WORKING",
        role: "COMMANDER",
        status: "WORKING",
        currentTaskTitle: `Processing instruction: "${commandText.slice(0, 30)}..."`,
        message: `COMMANDER acknowledged command: "${commandText}". Updating priority queue.`,
      });
    },

    respondToApproval: (approvalId: string, approved: boolean, note?: string) => {
      const now = new Date().toISOString();
      const approval = get().approvals.find((a) => a.id === approvalId);

      set((s) => ({
        approvals: s.approvals.map((a) =>
          a.id === approvalId
            ? {
                ...a,
                status: approved ? "APPROVED" : "REJECTED",
                respondedAt: now,
                responseNote: note,
              }
            : a
        ),
      }));

      legionEventBus.emit({
        id: `app_evt_${Date.now()}`,
        missionId: get().mission.id,
        timestamp: now,
        type: approved ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
        approvalId,
        actionTitle: approval?.actionTitle ?? "Unknown action",
        risk: approval?.risk ?? "MEDIUM",
        reason: note || (approved ? "Human approved action." : "Human rejected action."),
        message: approved
          ? `Human granted approval for "${approval?.actionTitle ?? approvalId}".`
          : `Human rejected "${approval?.actionTitle ?? approvalId}".`,
      });
    },
  };
});
