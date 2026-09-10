import { describe, it, expect, vi, beforeEach } from "vitest";
import { useMissionRuntimeStore } from "./mission-runtime-store";
import * as missionStreamModule from "@/lib/client/mission-stream";

describe("useMissionRuntimeStore (Mission Control Live State)", () => {
  beforeEach(() => {
    useMissionRuntimeStore.getState().resetMission();
    vi.restoreAllMocks();
  });

  it("initializes with default idle state", () => {
    const state = useMissionRuntimeStore.getState();
    expect(state.status).toBe("IDLE");
    expect(state.activeAgent).toBeNull();
    expect(state.tasks).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.error).toBeNull();
  });

  it("updates mission prompt via setMissionPrompt", () => {
    useMissionRuntimeStore.getState().setMissionPrompt("Custom prompt");
    expect(useMissionRuntimeStore.getState().missionPrompt).toBe("Custom prompt");
  });

  it("processes stream events and updates activeAgent, tasks, and status", () => {
    const store = useMissionRuntimeStore.getState();

    // 1. Mission Planning
    store.handleEvent({
      type: "MISSION_PLANNING",
      missionId: "m-100",
      seq: 1,
      timestamp: "2026-09-09T10:00:00Z",
      message: "Commander planning",
    });

    let state = useMissionRuntimeStore.getState();
    expect(state.status).toBe("PLANNING");
    expect(state.activeAgent).toBe("COMMANDER");
    expect(state.events).toHaveLength(1);

    // 2. Plan Ready with 2 tasks
    store.handleEvent({
      type: "PLAN_READY",
      missionId: "m-100",
      seq: 2,
      timestamp: "2026-09-09T10:00:01Z",
      data: {
        tasks: [
          { id: "task-1", title: "Task 1", dependencies: [], priority: "HIGH" },
          { id: "task-2", title: "Task 2", dependencies: ["task-1"], priority: "MEDIUM" },
        ],
      },
    });

    state = useMissionRuntimeStore.getState();
    expect(state.tasks).toHaveLength(2);
    expect(state.tasks[0].id).toBe("task-1");
    expect(state.tasks[0].status).toBe("READY");
    expect(state.tasks[1].status).toBe("BACKLOG");

    // 3. Task 1 Started by Builder
    store.handleEvent({
      type: "TASK_STARTED",
      missionId: "m-100",
      taskId: "task-1",
      agentRole: "BUILDER",
      seq: 3,
      timestamp: "2026-09-09T10:00:02Z",
      message: "Builder starting task 1",
    });

    state = useMissionRuntimeStore.getState();
    expect(state.activeAgent).toBe("BUILDER");
    expect(state.activeTaskId).toBe("task-1");
    expect(state.tasks[0].status).toBe("RUNNING");
    expect(state.tasks[0].attempts).toBe(1);

    // 4. Task 1 Sent to Sentinel Review
    store.handleEvent({
      type: "TASK_REVIEW",
      missionId: "m-100",
      taskId: "task-1",
      agentRole: "SENTINEL",
      seq: 4,
      timestamp: "2026-09-09T10:00:03Z",
      message: "Sentinel verifying task 1",
    });

    state = useMissionRuntimeStore.getState();
    expect(state.activeAgent).toBe("SENTINEL");
    expect(state.tasks[0].status).toBe("VERIFYING");

    // 5. Task 1 Completed & Approved
    store.handleEvent({
      type: "TASK_COMPLETED",
      missionId: "m-100",
      taskId: "task-1",
      seq: 5,
      timestamp: "2026-09-09T10:00:04Z",
      message: "Task 1 approved",
    });

    state = useMissionRuntimeStore.getState();
    expect(state.tasks[0].status).toBe("COMPLETED");
    expect(state.tasks[0].sentinelDecision).toBe("APPROVED");

    // 6. Mission Completed
    store.handleEvent({
      type: "MISSION_COMPLETED",
      missionId: "m-100",
      seq: 6,
      timestamp: "2026-09-09T10:00:05Z",
      message: "Mission finished successfully",
      result: {
        missionId: "m-100",
        status: "COMPLETED",
        taskResults: {},
        totalAttempts: 1,
        totalTokens: { prompt: 200, completion: 100, total: 300 },
        totalCostUsd: 0.0005,
        summary: "Done",
        startedAt: "2026-09-09T10:00:00Z",
        completedAt: "2026-09-09T10:00:05Z",
      },
    });

    state = useMissionRuntimeStore.getState();
    expect(state.status).toBe("COMPLETED");
    expect(state.finalResult).toBeDefined();
    expect(state.finalResult?.status).toBe("COMPLETED");
  });

  it("handles REVISION_REQUIRED verdict and updates task decision", () => {
    const store = useMissionRuntimeStore.getState();

    store.handleEvent({
      type: "PLAN_READY",
      missionId: "m-101",
      seq: 1,
      timestamp: "2026-09-09T10:00:00Z",
      data: {
        tasks: [{ id: "task-1", title: "Task 1", dependencies: [] }],
      },
    });

    store.handleEvent({
      type: "TEST_FAILED",
      missionId: "m-101",
      taskId: "task-1",
      seq: 2,
      timestamp: "2026-09-09T10:00:01Z",
    });

    const state = useMissionRuntimeStore.getState();
    expect(state.tasks[0].sentinelDecision).toBe("REVISION_REQUIRED");
  });

  it("handles MISSION_FAILED event and updates error state", () => {
    const store = useMissionRuntimeStore.getState();

    store.handleEvent({
      type: "MISSION_FAILED",
      missionId: "m-102",
      seq: 1,
      timestamp: "2026-09-09T10:00:00Z",
      message: "Deadlock detected in graph",
      error: "DEADLOCK_DETECTED",
    });

    const state = useMissionRuntimeStore.getState();
    expect(state.status).toBe("FAILED");
    expect(state.error).toBe("DEADLOCK_DETECTED");
  });

  it("handles unknown event types gracefully without crashing", () => {
    const store = useMissionRuntimeStore.getState();

    store.handleEvent({
      type: "UNKNOWN_CUSTOM_TELEMETRY" as any,
      missionId: "m-103",
      seq: 1,
      timestamp: "2026-09-09T10:00:00Z",
      message: "Some unknown debug message",
    });

    const state = useMissionRuntimeStore.getState();
    expect(state.events).toHaveLength(1);
    expect(state.events[0].type).toBe("UNKNOWN_CUSTOM_TELEMETRY");
  });

  it("cancels execution cleanly via cancelMission()", () => {
    const store = useMissionRuntimeStore.getState();

    store.handleEvent({
      type: "MISSION_PLANNING",
      missionId: "m-104",
      seq: 1,
      timestamp: "2026-09-09T10:00:00Z",
    });

    expect(useMissionRuntimeStore.getState().status).toBe("PLANNING");

    store.cancelMission();

    const state = useMissionRuntimeStore.getState();
    expect(state.status).toBe("CANCELLED");
  });

  it("resets state back to IDLE via resetMission()", () => {
    const store = useMissionRuntimeStore.getState();

    store.handleEvent({
      type: "MISSION_COMPLETED",
      missionId: "m-105",
      seq: 1,
      timestamp: "2026-09-09T10:00:00Z",
    });

    store.resetMission();

    const state = useMissionRuntimeStore.getState();
    expect(state.status).toBe("IDLE");
    expect(state.events).toEqual([]);
    expect(state.tasks).toEqual([]);
    expect(state.finalResult).toBeNull();
  });

  it("prevents duplicate execution if mission is already running", async () => {
    const spy = vi.spyOn(missionStreamModule, "streamMission").mockResolvedValue(null);

    useMissionRuntimeStore.setState({ status: "EXECUTING" });

    await useMissionRuntimeStore.getState().startMission("Another prompt");

    // streamMission should NOT be called because mission was already executing
    expect(spy).not.toHaveBeenCalled();
  });

  it("updates task and Sentinel review when TASK_REVIEW and SENTINEL verdict occurs", () => {
    const store = useMissionRuntimeStore.getState();

    store.handleEvent({
      type: "PLAN_READY",
      missionId: "m-sentinel",
      seq: 1,
      timestamp: "2026-09-09T10:00:00Z",
      data: {
        tasks: [{ id: "task-sentinel-1", title: "Task 1", dependencies: [], priority: "HIGH" }],
      },
    });

    store.handleEvent({
      type: "TASK_REVIEW",
      missionId: "m-sentinel",
      seq: 2,
      timestamp: "2026-09-09T10:00:02Z",
      taskId: "task-sentinel-1",
      data: {
        verdict: {
          taskId: "task-sentinel-1",
          decision: "REVISION_REQUIRED",
          summary: "Missing authorization check on route",
          confidence: 0.95,
          criteriaResults: [{ criterion: "Auth check", status: "FAIL" }],
          issues: [{ id: "iss-1", title: "Unprotected endpoint", severity: "HIGH", description: "Route allows unauthenticated access" }],
          recommendations: ["Add auth middleware before handler"],
        },
      },
    });

    const state = useMissionRuntimeStore.getState();
    expect(state.tasks[0].status).toBe("REVISION_REQUIRED");
    expect(state.tasks[0].sentinelDecision).toBe("REVISION_REQUIRED");
    expect(state.tasks[0].sentinelSummary).toBe("Missing authorization check on route");
    expect(state.tasks[0].sentinelIssues).toHaveLength(1);
  });
});
