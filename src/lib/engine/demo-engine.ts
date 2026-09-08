// LEGION Demo Mission Engine
// Deterministic multi-agent execution simulation for Phase 01

import { legionEventBus } from "@/lib/events/bus";
import { getExecutionLimits } from "@/lib/config/limits";
import { MissionEngine, MissionEngineStatus } from "@/lib/engine/mission-engine";

export interface DemoStep {
  delayMs: number;
  action: () => void;
}

export class DemoMissionEngine implements MissionEngine {
  private missionId: string;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentStepIndex: number = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(missionId: string = "mission-001") {
    this.missionId = missionId;
  }

  public getStatus(): MissionEngineStatus {
    return {
      missionId: this.missionId,
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      stepIndex: this.currentStepIndex,
    };
  }

  public start() {
    if (this.isRunning && !this.isPaused) return;
    this.isRunning = true;
    this.isPaused = false;
    this.executeNextStep();
  }

  public pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    legionEventBus.emit({
      missionId: this.missionId,
      type: "MISSION_PAUSED",
      title: "Mission Paused",
      message: "Orchestration paused by user.",
    });
  }

  public resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    legionEventBus.emit({
      missionId: this.missionId,
      type: "MISSION_RESUMED",
      title: "Mission Resumed",
      message: "Orchestration resumed.",
    });
    this.executeNextStep();
  }

  public stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentStepIndex = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private getSteps(): DemoStep[] {
    const mId = this.missionId;

    return [
      // STEP 0: Mission start
      {
        delayMs: 300,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "MISSION_STARTED",
            title: "Mission Initialized",
            progressPercent: 5,
            message: "COMMANDER initiated mission workflow.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "SYSTEM",
            text: "[LEGION ORCHESTRATOR] Mission initialized: Financial SaaS with Auth, PostgreSQL & Analytics.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_WORKING",
            role: "COMMANDER",
            status: "WORKING",
            currentTaskTitle: "Decomposing requirements & planning graph",
            message: "Analyzing scope and task dependency graph...",
          });
        },
      },
      // STEP 1: Commander passes to Architect
      {
        delayMs: 1400,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_COMMUNICATION",
            role: "COMMANDER",
            targetRole: "ARCHITECT",
            status: "WORKING",
            message: "COMMANDER → ARCHITECT: Formulate database schema, tech stack & API contract.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_WORKING",
            role: "ARCHITECT",
            status: "WORKING",
            currentTaskTitle: "Designing system architecture & Drizzle schema",
            message: "Synthesizing schema definitions and security boundaries...",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "COMMAND",
            text: "> legion architect generate --spec=financial-saas --db=postgresql",
          });
        },
      },
      // STEP 2: Architect creates schema files & finishes
      {
        delayMs: 1800,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "FILE_CREATED",
            path: "src/lib/db/schema.ts",
            agentRole: "ARCHITECT",
            linesCount: 142,
            message: "ARCHITECT created database schema definitions (Drizzle ORM).",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_COMPLETED",
            role: "ARCHITECT",
            status: "IDLE",
            currentTaskTitle: "Architecture spec completed",
            message: "System architecture ready and locked.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "SUCCESS",
            text: "✓ Architecture verified: PostgreSQL + Drizzle ORM + Next.js App Router.",
          });
        },
      },
      // STEP 3: Commander assigns Task #008 to Builder
      {
        delayMs: 1200,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "TASK_ASSIGNED",
            taskId: "TASK-008",
            taskTitle: "Implement authentication & session management",
            assignedRole: "BUILDER",
            status: "IN_PROGRESS",
            priority: "HIGH",
            message: "COMMANDER assigned TASK-008 to BUILDER.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_WORKING",
            role: "BUILDER",
            status: "WORKING",
            currentTaskTitle: "TASK-008: Implement authentication",
            message: "Writing JWT/Session handlers & OAuth callback flow...",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "COMMAND",
            text: "> legion builder exec --task=TASK-008",
          });
        },
      },
      // STEP 4: Builder creates auth files
      {
        delayMs: 1600,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "FILE_CREATED",
            path: "src/lib/auth.ts",
            agentRole: "BUILDER",
            linesCount: 88,
            message: "BUILDER created session token verification and middleware handler.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "FILE_CREATED",
            path: "src/app/api/auth/route.ts",
            agentRole: "BUILDER",
            linesCount: 64,
            message: "BUILDER created auth endpoints.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "STDOUT",
            text: "src/lib/auth.ts generated [88 lines]\nsrc/app/api/auth/route.ts generated [64 lines]",
          });
        },
      },
      // STEP 5: Builder finishes, Commander dispatches to Sentinel for testing
      {
        delayMs: 1400,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "TASK_REVIEW",
            taskId: "TASK-008",
            taskTitle: "Implement authentication",
            assignedRole: "SENTINEL",
            status: "REVIEW",
            priority: "HIGH",
            message: "BUILDER → SENTINEL: Task ready for test suite validation.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_WORKING",
            role: "SENTINEL",
            status: "WORKING",
            currentTaskTitle: "Running validation on TASK-008",
            message: "Executing authentication integration test suite...",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "COMMAND",
            text: "> npx vitest run tests/auth.test.ts",
          });
        },
      },
      // STEP 6: SENTINEL ENCOUNTERS TEST FAILURE (Failure Loop trigger!)
      {
        delayMs: 2000,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "TEST_FAILED",
            taskId: "TASK-008",
            suiteName: "tests/auth.test.ts",
            agentRole: "SENTINEL",
            passedCount: 8,
            failedCount: 1,
            errorSnippet: "AssertionError: callbackUrl param was not preserved during redirect",
            message: "SENTINEL: Test failed — Authentication redirect does not preserve callback URL.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "ISSUE_CREATED",
            issueId: "ISSUE-004",
            taskId: "TASK-008",
            title: "Authentication redirect does not preserve callback URL",
            severity: "HIGH",
            status: "OPEN",
            reportedByRole: "SENTINEL",
            assignedToRole: "BUILDER",
            message: "ISSUE-004 logged by SENTINEL with HIGH severity.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "STDERR",
            text: "✕ FAIL tests/auth.test.ts > Auth Flow > preserves redirect callbackUrl\nAssertionError: expected undefined to equal '/dashboard'\n  at src/lib/auth.ts:42:15",
          });
        },
      },
      // STEP 7: Commander re-assigns Issue #004 to Builder for hotfix
      {
        delayMs: 1500,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "ISSUE_ASSIGNED",
            issueId: "ISSUE-004",
            taskId: "TASK-008",
            title: "Authentication redirect does not preserve callback URL",
            severity: "HIGH",
            status: "FIXING",
            reportedByRole: "SENTINEL",
            assignedToRole: "BUILDER",
            message: "COMMANDER: Issue #004 reassigned to BUILDER for resolution.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_WORKING",
            role: "BUILDER",
            status: "WORKING",
            currentTaskTitle: "Hotfixing ISSUE-004 in src/lib/auth.ts",
            message: "Refactoring redirect searchParams propagation...",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "SYSTEM",
            text: "[LOOP TRIAGE] Commander intercepted failure. Dispatched hotfix instructions to Builder.",
          });
        },
      },
      // STEP 8: Builder applies fix and modifies file
      {
        delayMs: 1800,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "FILE_MODIFIED",
            path: "src/lib/auth.ts",
            agentRole: "BUILDER",
            linesCount: 94,
            message: "BUILDER modified src/lib/auth.ts — Preserved callbackUrl search query.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "STDOUT",
            text: "src/lib/auth.ts updated (+6 lines, -2 lines). Fix applied.",
          });
        },
      },
      // STEP 9: Sentinel Retests
      {
        delayMs: 1400,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_WORKING",
            role: "SENTINEL",
            status: "WORKING",
            currentTaskTitle: "Retesting ISSUE-004 & TASK-008",
            message: "Running full regression suite...",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "COMMAND",
            text: "> npx vitest run tests/auth.test.ts --reporter=verbose",
          });
        },
      },
      // STEP 10: Sentinel PASSES the test! Issue Resolved
      {
        delayMs: 1700,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "TEST_PASSED",
            taskId: "TASK-008",
            suiteName: "tests/auth.test.ts",
            agentRole: "SENTINEL",
            passedCount: 10,
            failedCount: 0,
            message: "SENTINEL: All 10 test cases passed successfully.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "ISSUE_RESOLVED",
            issueId: "ISSUE-004",
            taskId: "TASK-008",
            title: "Authentication redirect does not preserve callback URL",
            severity: "HIGH",
            status: "RESOLVED",
            reportedByRole: "SENTINEL",
            assignedToRole: "BUILDER",
            message: "ISSUE-004 marked as RESOLVED by SENTINEL.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TASK_COMPLETED",
            taskId: "TASK-008",
            taskTitle: "Implement authentication",
            assignedRole: "BUILDER",
            status: "COMPLETED",
            priority: "HIGH",
            message: "TASK-008 marked COMPLETED.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "SUCCESS",
            text: "✓ tests/auth.test.ts (10 tests passed, 0 failures, 142ms)",
          });
        },
      },
      // STEP 11: Production Build Execution
      {
        delayMs: 1400,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "BUILD_STARTED",
            environment: "production",
            message: "Building production bundle...",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "COMMAND",
            text: "> npm run build",
          });
        },
      },
      // STEP 12: Build Completes Successfully
      {
        delayMs: 1800,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "BUILD_COMPLETED",
            environment: "production",
            durationMs: 1850,
            message: "Production build verified with zero errors.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "SUCCESS",
            text: "✓ Compiled successfully\n✓ Type checking: 0 errors\n✓ Static pages generated (14/14)\nBUILD SUCCESSFUL",
          });
        },
      },
      // STEP 13: Mission Complete
      {
        delayMs: 1200,
        action: () => {
          legionEventBus.emit({
            missionId: mId,
            type: "MISSION_COMPLETED",
            title: "Mission Completed Successfully",
            progressPercent: 100,
            message: "All tasks verified and ready for deployment.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "AGENT_COMPLETED",
            role: "COMMANDER",
            status: "IDLE",
            message: "COMMANDER completed mission orchestration.",
          });
          legionEventBus.emit({
            missionId: mId,
            type: "TERMINAL_OUTPUT",
            stream: "SUCCESS",
            text: "==================================================\n[LEGION] MISSION COMPLETE: 12/12 Tasks Verified\n==================================================",
          });
          this.isRunning = false;
        },
      },
    ];
  }

  private executeNextStep() {
    if (!this.isRunning || this.isPaused) return;

    const { maxMissionIterations } = getExecutionLimits();
    if (this.currentStepIndex >= maxMissionIterations) {
      this.isRunning = false;
      this.isPaused = false;
      legionEventBus.emit({
        missionId: this.missionId,
        type: "MISSION_FAILED",
        title: "Mission Failed",
        message: `Mission stopped: exceeded MAX_MISSION_ITERATIONS (${maxMissionIterations}).`,
      });
      return;
    }

    const steps = this.getSteps();

    if (this.currentStepIndex >= steps.length) {
      this.isRunning = false;
      return;
    }

    const currentStep = steps[this.currentStepIndex];
    this.timer = setTimeout(() => {
      if (!this.isRunning || this.isPaused) return;
      currentStep.action();
      this.currentStepIndex++;
      this.executeNextStep();
    }, currentStep.delayMs);
  }
}
