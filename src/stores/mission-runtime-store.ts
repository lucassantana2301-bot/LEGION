// LEGION Phase 05 — Unified Mission Runtime Zustand Store
// Drives real-time Mission Control UI via streamMission() client and NDJSON events

import { create } from "zustand";
import { streamMission } from "@/lib/client/mission-stream";
import { MissionStreamEventEnvelope } from "@/types/stream";
import { OrchestratorResult } from "@/lib/agent/orchestrator";
import { legionEventBus } from "@/lib/events/bus";
import { AgentRole, Severity } from "@/types/domain";

export type MissionStatusType =
  | "IDLE"
  | "PLANNING"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TaskStatusType =
  | "BACKLOG"
  | "READY"
  | "RUNNING"
  | "VERIFYING"
  | "COMPLETED"
  | "REVISION_REQUIRED"
  | "FAILED";

export interface LiveTaskView {
  id: string;
  order: number;
  title: string;
  description: string;
  assignedRole: AgentRole;
  priority: Severity;
  status: TaskStatusType;
  dependencies: string[];
  requiredCapabilities: string[];
  successCriteria: string[];
  attempts: number;
  maxAttempts: number;
  sentinelDecision?: "APPROVED" | "REVISION_REQUIRED" | "FAILED";
  sentinelSummary?: string;
  sentinelIssues?: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    proposedFix?: string;
  }>;
  sentinelRecommendations?: string[];
  error?: string;
}

export interface LiveStreamEvent extends MissionStreamEventEnvelope {
  formattedTime: string;
}

export interface MissionRuntimeState {
  status: MissionStatusType;
  missionId: string;
  missionPrompt: string;
  activeAgent: "COMMANDER" | "BUILDER" | "SENTINEL" | "ORCHESTRATOR" | null;
  activeAgentStatus: string;
  activeTaskId: string | null;
  activeTaskIds: string[];
  concurrencyLimit: number;
  tasks: LiveTaskView[];
  events: LiveStreamEvent[];
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  totalTokens: { prompt: number; completion: number; total: number } | null;
  totalCostUsd: number | null;
  error: string | null;
  finalResult: OrchestratorResult | null;
  abortController: AbortController | null;
  memoryEntriesCount: number;
  memorySnapshot: any | null;

  // Actions
  setMissionPrompt: (prompt: string) => void;
  startMission: (prompt?: string) => Promise<void>;
  cancelMission: () => void;
  resetMission: () => void;
  handleEvent: (event: MissionStreamEventEnvelope) => void;
}

function formatTime(isoString?: string): string {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toTimeString().split(" ")[0] || "00:00:00";
}

export const useMissionRuntimeStore = create<MissionRuntimeState>((set, get) => ({
  status: "IDLE",
  missionId: "",
  missionPrompt: "Create a TypeScript utility that calculates fibonacci numbers and verify it with automated tests.",
  activeAgent: null,
  activeAgentStatus: "IDLE",
  activeTaskId: null,
  activeTaskIds: [],
  concurrencyLimit: 2,
  tasks: [],
  events: [],
  startedAt: null,
  completedAt: null,
  durationMs: null,
  totalTokens: null,
  totalCostUsd: null,
  error: null,
  finalResult: null,
  abortController: null,
  memoryEntriesCount: 0,
  memorySnapshot: null,

  setMissionPrompt: (prompt: string) => {
    set({ missionPrompt: prompt });
  },

  handleEvent: (event: MissionStreamEventEnvelope) => {
    const formattedEvent: LiveStreamEvent = {
      ...event,
      formattedTime: formatTime(event.timestamp),
    };

    // Forward to client legionEventBus so other UI slices (terminal/graph) update
    try {
      legionEventBus.emit(event as any);
    } catch {
      // Ignored
    }

    set((state) => {
      const nextEvents = [...state.events, formattedEvent];
      let nextStatus = state.status;
      let nextActiveAgent = state.activeAgent;
      let nextAgentStatus = state.activeAgentStatus;
      let nextActiveTaskId = state.activeTaskId;
      let nextTasks = [...state.tasks];
      let nextMemoryEntriesCount = state.memoryEntriesCount;
      let nextMemorySnapshot = state.memorySnapshot;
      let nextError = state.error;
      let nextResult = state.finalResult;

      switch (event.type) {
        case "SANDBOX_CREATED":
        case "SANDBOX_READY":
          nextActiveAgent = "ORCHESTRATOR";
          nextAgentStatus = "ALLOCATING SANDBOX";
          break;

        case "MISSION_PLANNING":
          nextStatus = "PLANNING";
          nextActiveAgent = "COMMANDER";
          nextAgentStatus = "ANALYZING & DECOMPOSING";
          break;

        case "MISSION_STARTED":
          nextStatus = "EXECUTING";
          nextActiveAgent = "ORCHESTRATOR";
          nextAgentStatus = "COORDINATING";
          break;

        case "PLAN_READY":
          if (event.data && Array.isArray((event.data as any).tasks)) {
            const rawTasks = (event.data as any).tasks;
            nextTasks = rawTasks.map((t: any, i: number) => ({
              id: t.id || `task-${i + 1}`,
              order: t.order || i + 1,
              title: t.title || "Task",
              description: t.description || "",
              assignedRole: t.assignedRole || "BUILDER",
              priority: t.priority || "MEDIUM",
              status: t.dependencies?.length ? "BACKLOG" : "READY",
              dependencies: t.dependencies || [],
              requiredCapabilities: t.requiredCapabilities || [],
              successCriteria: t.successCriteria || [],
              attempts: 0,
              maxAttempts: 3,
            }));
          }
          break;

        case "TASK_STARTED":
          nextStatus = "EXECUTING";
          nextActiveAgent = (event.agentRole as any) || "BUILDER";
          nextActiveTaskId = event.taskId || null;
          nextAgentStatus = `EXECUTING ${event.taskId || "TASK"}`;

          nextTasks = nextTasks.map((t) => {
            if (t.id === event.taskId) {
              return {
                ...t,
                status: "RUNNING" as TaskStatusType,
                attempts: t.attempts + 1,
              };
            }
            return t;
          });
          break;

        case "TASK_REVIEW":
          const verdictData = (event.data as any)?.verdict;
          const isRev = verdictData?.decision === "REVISION_REQUIRED";
          nextStatus = "VERIFYING";
          nextActiveAgent = "SENTINEL";
          nextActiveTaskId = event.taskId || null;
          nextAgentStatus = isRev ? `REVISION REQUIRED // ${event.taskId || "TASK"}` : `VERIFYING ${event.taskId || "TASK"}`;

          nextTasks = nextTasks.map((t) => {
            if (t.id === event.taskId) {
              return {
                ...t,
                status: (isRev ? "REVISION_REQUIRED" : "VERIFYING") as TaskStatusType,
                sentinelDecision: verdictData?.decision,
                sentinelSummary: verdictData?.summary,
                sentinelIssues: verdictData?.issues,
                sentinelRecommendations: verdictData?.recommendations,
              };
            }
            return t;
          });
          break;

        case "TASK_COMPLETED":
          nextTasks = nextTasks.map((t) => {
            if (t.id === event.taskId) {
              return {
                ...t,
                status: "COMPLETED" as TaskStatusType,
                sentinelDecision: "APPROVED",
              };
            }
            return t;
          });
          break;

        case "TASK_FAILED":
          nextTasks = nextTasks.map((t) => {
            if (t.id === event.taskId) {
              return {
                ...t,
                status: "FAILED" as TaskStatusType,
                error: event.message,
              };
            }
            return t;
          });
          break;

        case "TEST_PASSED":
        case "TEST_FAILED":
          if (event.taskId) {
            nextTasks = nextTasks.map((t) => {
              if (t.id === event.taskId) {
                return {
                  ...t,
                  sentinelDecision: event.type === "TEST_PASSED" ? "APPROVED" : "REVISION_REQUIRED",
                };
              }
              return t;
            });
          }
          break;

        case "MEMORY_ENTRY_ADDED":
          nextMemoryEntriesCount =
            typeof (event.data as any)?.entryCount === "number"
              ? (event.data as any).entryCount
              : nextMemoryEntriesCount + 1;
          break;

        case "MEMORY_SNAPSHOT_CREATED":
          if (event.data) {
            nextMemorySnapshot = event.data;
          }
          break;

        case "MISSION_COMPLETED":
          nextStatus = "COMPLETED";
          nextActiveAgent = "ORCHESTRATOR";
          nextAgentStatus = "MISSION COMPLETED";
          if (event.result) {
            nextResult = event.result;
            if (event.result.memorySnapshot) {
              nextMemorySnapshot = event.result.memorySnapshot;
              nextMemoryEntriesCount = event.result.memorySnapshot.totalEntries;
            }
          }
          break;

        case "MISSION_FAILED":
          nextStatus = "FAILED";
          nextActiveAgent = "ORCHESTRATOR";
          nextAgentStatus = "FAILED";
          nextError = event.error || event.message || "Mission execution failed.";
          if (event.result?.memorySnapshot) {
            nextMemorySnapshot = event.result.memorySnapshot;
            nextMemoryEntriesCount = event.result.memorySnapshot.totalEntries;
          }
          break;

        case "MISSION_CANCELLED":
          nextStatus = "CANCELLED";
          nextActiveAgent = null;
          nextAgentStatus = "CANCELLED";
          break;

        case "STREAM_END":
          if (event.result) {
            nextResult = event.result;
            if (event.result.memorySnapshot) {
              nextMemorySnapshot = event.result.memorySnapshot;
              nextMemoryEntriesCount = event.result.memorySnapshot.totalEntries;
            }
            if (event.result.status === "COMPLETED") {
              nextStatus = "COMPLETED";
            } else if (event.result.status === "FAILED") {
              nextStatus = "FAILED";
              nextError = event.result.error || "Mission failed.";
            } else if (event.result.status === "CANCELLED") {
              nextStatus = "CANCELLED";
            }
          }
          break;
      }

      // If event.result was attached (e.g. from orchestrator final output)
      if (event.result?.taskResults) {
        const tr = event.result.taskResults;
        nextTasks = Object.values(tr).map((runtimeSt: any) => ({
          id: runtimeSt.task.id,
          order: runtimeSt.task.order,
          title: runtimeSt.task.title,
          description: runtimeSt.task.description,
          assignedRole: runtimeSt.task.assignedRole,
          priority: runtimeSt.task.priority,
          status: runtimeSt.status as TaskStatusType,
          dependencies: runtimeSt.task.dependencies,
          requiredCapabilities: runtimeSt.task.requiredCapabilities,
          successCriteria: runtimeSt.task.successCriteria,
          attempts: runtimeSt.attempts,
          maxAttempts: runtimeSt.maxAttempts,
          sentinelDecision: runtimeSt.lastSentinelReview?.decision,
          sentinelSummary: runtimeSt.lastSentinelReview?.summary,
          sentinelIssues: runtimeSt.lastSentinelReview?.issues,
          sentinelRecommendations: runtimeSt.lastSentinelReview?.recommendations,
          error: runtimeSt.error,
        }));
      }

      const activeRunningTasks = nextTasks.filter(
        (t) => t.status === "RUNNING" || t.status === "VERIFYING"
      );
      const computedActiveTaskIds = activeRunningTasks.map((t) => t.id);
      const computedActiveTaskId = computedActiveTaskIds[0] || nextActiveTaskId;
      const concurrencyLimit =
        typeof event.concurrencyLimit === "number"
          ? event.concurrencyLimit
          : state.concurrencyLimit;

      return {
        events: nextEvents,
        status: nextStatus,
        activeAgent: nextActiveAgent,
        activeAgentStatus: nextAgentStatus,
        activeTaskId: computedActiveTaskId,
        activeTaskIds: computedActiveTaskIds,
        concurrencyLimit,
        tasks: nextTasks,
        error: nextError,
        finalResult: nextResult,
        memoryEntriesCount: nextMemoryEntriesCount,
        memorySnapshot: nextMemorySnapshot,
      };
    });
  },

  startMission: async (promptOverride?: string) => {
    const { status } = get();
    if (status === "PLANNING" || status === "EXECUTING" || status === "VERIFYING") {
      return; // Prevent duplicate run
    }

    const prompt = (promptOverride || get().missionPrompt).trim();
    if (!prompt) {
      set({ error: "Mission prompt cannot be empty." });
      return;
    }

    const missionId = `mission-${Date.now()}`;
    const abortController = new AbortController();

    set({
      status: "PLANNING",
      missionId,
      missionPrompt: prompt,
      activeAgent: "COMMANDER",
      activeAgentStatus: "INITIALIZING",
      activeTaskId: null,
      tasks: [],
      events: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationMs: null,
      totalTokens: null,
      totalCostUsd: null,
      error: null,
      finalResult: null,
      abortController,
    });

    try {
      const finalResult = await streamMission(
        {
          missionId,
          mission: prompt,
        },
        {
          signal: abortController.signal,
          onEvent: (event) => {
            get().handleEvent(event);
          },
        }
      );

      if (finalResult) {
        set({
          finalResult,
          status: finalResult.status === "COMPLETED" ? "COMPLETED" : finalResult.status === "FAILED" ? "FAILED" : "CANCELLED",
          completedAt: finalResult.completedAt || new Date().toISOString(),
          totalTokens: finalResult.totalTokens,
          totalCostUsd: finalResult.totalCostUsd,
          error: finalResult.error || null,
        });
      }
    } catch (err: unknown) {
      if (abortController.signal.aborted) {
        set({
          status: "CANCELLED",
          activeAgent: null,
          activeAgentStatus: "CANCELLED",
          completedAt: new Date().toISOString(),
        });
      } else {
        const errorMsg = err instanceof Error ? err.message : String(err);
        set({
          status: "FAILED",
          activeAgent: null,
          activeAgentStatus: "ERROR",
          error: errorMsg,
          completedAt: new Date().toISOString(),
        });
      }
    } finally {
      set({ abortController: null });
    }
  },

  cancelMission: () => {
    const { abortController, status } = get();
    if (abortController) {
      abortController.abort();
    }
    if (status === "PLANNING" || status === "EXECUTING" || status === "VERIFYING") {
      set({
        status: "CANCELLED",
        activeAgent: null,
        activeAgentStatus: "CANCELLED",
        completedAt: new Date().toISOString(),
        abortController: null,
      });
    }
  },

  resetMission: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      status: "IDLE",
      missionId: "",
      activeAgent: null,
      activeAgentStatus: "IDLE",
      activeTaskId: null,
      tasks: [],
      events: [],
      startedAt: null,
      completedAt: null,
      durationMs: null,
      totalTokens: null,
      totalCostUsd: null,
      error: null,
      finalResult: null,
      abortController: null,
    });
  },
}));
