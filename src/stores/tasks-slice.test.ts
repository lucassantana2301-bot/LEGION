import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { legionEventBus } from "@/lib/events/bus";
import { useTasksSlice } from "./tasks-slice";

// NOTE: initialize() is only called once (beforeAll) because the slice's
// event-bus subscription is guarded by a module-level "already subscribed"
// flag (see tasks-slice.ts) — calling initialize() again after resetting the
// bus would silently no-op and the reducer would stop receiving events. This
// mirrors a real gap flagged in docs/PHASE_01_AUDIT.md (no teardown path).
describe("tasks-slice event reducer", () => {
  beforeAll(() => {
    useTasksSlice.getState().initialize();
  });

  beforeEach(() => {
    useTasksSlice.setState({ issues: [], selectedTaskId: null });
  });

  it("creates an issue from ISSUE_CREATED using only the event payload — no fabricated fields", () => {
    legionEventBus.emit({
      missionId: "mission-001",
      type: "ISSUE_CREATED",
      issueId: "ISSUE-999",
      taskId: "TASK-008",
      title: "Something broke",
      severity: "MEDIUM",
      status: "OPEN",
      reportedByRole: "SENTINEL",
      assignedToRole: "BUILDER",
      message: "SENTINEL logged ISSUE-999.",
    });

    const issue = useTasksSlice.getState().issues.find((i) => i.id === "ISSUE-999");
    expect(issue).toBeDefined();
    expect(issue?.description).toBe("SENTINEL logged ISSUE-999.");
    expect(issue?.stackTrace).toBeUndefined();
    expect(issue?.affectedFile).toBeUndefined();
    expect(issue?.proposedFix).toBeUndefined();
  });

  it("marks an issue RESOLVED on ISSUE_RESOLVED", () => {
    legionEventBus.emit({
      missionId: "mission-001",
      type: "ISSUE_CREATED",
      issueId: "ISSUE-998",
      taskId: "TASK-008",
      title: "Another issue",
      severity: "LOW",
      status: "OPEN",
      reportedByRole: "SENTINEL",
      assignedToRole: "BUILDER",
      message: "logged",
    });

    legionEventBus.emit({
      missionId: "mission-001",
      type: "ISSUE_RESOLVED",
      issueId: "ISSUE-998",
      taskId: "TASK-008",
      title: "Another issue",
      severity: "LOW",
      status: "RESOLVED",
      reportedByRole: "SENTINEL",
      assignedToRole: "BUILDER",
      message: "resolved",
    });

    const issue = useTasksSlice.getState().issues.find((i) => i.id === "ISSUE-998");
    expect(issue?.status).toBe("RESOLVED");
    expect(issue?.resolvedAt).toBeDefined();
  });

  it("updates task status on TASK_COMPLETED", () => {
    legionEventBus.emit({
      missionId: "mission-001",
      type: "TASK_COMPLETED",
      taskId: "TASK-008",
      taskTitle: "Implement authentication",
      assignedRole: "BUILDER",
      status: "COMPLETED",
      priority: "HIGH",
      message: "done",
    });

    const task = useTasksSlice.getState().tasks.find((t) => t.id === "TASK-008");
    expect(task?.status).toBe("COMPLETED");
  });
});
