// LEGION Phase 08 — Central Multi-Agent Orchestrator with Parallel DAG Execution
// Coordinates COMMANDER planning -> Parallel DAG Worker Slots -> ARCHITECT / BUILDER / SENTINEL execution

import { CommanderAgent, MissionPlan, PlannedTask } from "./commander-agent";
import { BuilderAgent, BuilderRunResult } from "./builder-agent";
import { SentinelAgent, SentinelReview } from "./sentinel-agent";
import { ArchitectAgent, ArchitecturePlan } from "./architect-agent";
import { SandboxProvider, verifyTrustedRealCapability } from "../providers/sandbox";
import {
  MissionMemoryStore,
  InMemoryMissionMemoryStore,
  MissionContextRetriever,
  MissionMemorySnapshot,
} from "../memory";
import {
  CanonicalWorkspace,
  InMemoryCanonicalWorkspace,
  TaskPatch,
  executeIntegratedQA,
  IntegratedQAResult,
} from "../workspace";
import { legionEventBus } from "../events/bus";
import { AgentRole, Severity } from "@/types/domain";
import { sanitizeValue } from "../memory/sanitizer";

export type MissionExecutionStatus =
  | "IDLE"
  | "PLANNING"
  | "DESIGNING"
  | "EXECUTING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type TaskRuntimeStatus =
  | "BACKLOG"
  | "READY"
  | "RUNNING"
  | "VERIFYING"
  | "COMPLETED"
  | "REVISION_REQUIRED"
  | "BLOCKED"
  | "FAILED";

export type FailurePolicy = "FAIL_FAST" | "CONTINUE_INDEPENDENT";

export type IntegratedWorkspaceValidator = (
  workspace: CanonicalWorkspace,
  context?: { sandboxProvider?: SandboxProvider; sandboxId?: string }
) => Promise<{ success: boolean; error?: string; evidence?: unknown }>;

export interface TaskExecutionHistory {
  attempt: number;
  builderResult?: BuilderRunResult;
  sentinelReview?: SentinelReview;
  architecturePlan?: ArchitecturePlan;
  error?: string;
  timestamp: string;
}

export interface TaskRuntimeState {
  task: PlannedTask;
  status: TaskRuntimeStatus;
  attempts: number;
  maxAttempts: number;
  lastBuilderResult?: BuilderRunResult;
  lastSentinelReview?: SentinelReview;
  lastArchitecturePlan?: ArchitecturePlan;
  history: TaskExecutionHistory[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
  slotId?: number;
}

export interface OrchestratorOptions {
  commander: CommanderAgent;
  builder: BuilderAgent;
  sentinel: SentinelAgent;
  architect?: ArchitectAgent;
  sandboxProvider?: SandboxProvider;
  memoryStore?: MissionMemoryStore;
  canonicalWorkspace?: CanonicalWorkspace;
  integratedValidator?: IntegratedWorkspaceValidator;
  maxAttemptsPerTask?: number;
  maxConcurrentTasks?: number;
  failurePolicy?: FailurePolicy;
  defaultTimeoutMs?: number;
}

export interface OrchestratorRunOptions {
  missionId?: string;
  missionPrompt: string;
  sandboxId: string;
  projectContext?: string;
  maxAttemptsPerTask?: number;
  maxConcurrentTasks?: number;
  failurePolicy?: FailurePolicy;
  timeoutMs?: number;
  requireRealExecution?: boolean;
  signal?: AbortSignal;
  onEvent?: (event: Parameters<typeof legionEventBus.emit>[0]) => void;
  onStatusChange?: (status: MissionExecutionStatus) => void;
}

export interface OrchestratorResult {
  missionId: string;
  status: MissionExecutionStatus;
  plan?: MissionPlan;
  taskResults: Record<string, TaskRuntimeState>;
  architecturePlans?: Record<string, ArchitecturePlan>;
  memorySnapshot?: MissionMemorySnapshot;
  workspace?: CanonicalWorkspace;
  integratedQA?: IntegratedQAResult;
  totalAttempts: number;
  totalTokens: { prompt: number; completion: number; total: number };
  totalCostUsd: number;
  summary: string;
  startedAt: string;
  completedAt: string;
  error?: string;
}

interface WorkerSlot {
  slotId: number;
  taskId: string;
  role: AgentRole;
  promise: Promise<void>;
}

const PRIORITY_WEIGHTS: Record<Severity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export class LegionOrchestrator {
  private commander: CommanderAgent;
  private builder: BuilderAgent;
  private sentinel: SentinelAgent;
  private architect?: ArchitectAgent;
  private sandboxProvider?: SandboxProvider;
  private memoryStore: MissionMemoryStore;
  private contextRetriever: MissionContextRetriever;
  private canonicalWorkspace: CanonicalWorkspace;
  private integratedValidator?: IntegratedWorkspaceValidator;
  private defaultMaxAttemptsPerTask: number;
  private defaultMaxConcurrentTasks: number;
  private defaultFailurePolicy: FailurePolicy;
  private defaultTimeoutMs: number;
  private isRunning: boolean = false;

  constructor(options: OrchestratorOptions) {
    this.commander = options.commander;
    this.builder = options.builder;
    this.sentinel = options.sentinel;
    this.architect = options.architect;
    this.sandboxProvider = options.sandboxProvider;
    this.memoryStore = options.memoryStore || new InMemoryMissionMemoryStore();
    this.contextRetriever = new MissionContextRetriever(this.memoryStore);
    this.canonicalWorkspace = options.canonicalWorkspace || new InMemoryCanonicalWorkspace();
    this.integratedValidator = options.integratedValidator;
    this.defaultMaxAttemptsPerTask = options.maxAttemptsPerTask ?? 3;
    this.defaultMaxConcurrentTasks = Math.max(1, options.maxConcurrentTasks ?? 2);
    this.defaultFailurePolicy = options.failurePolicy ?? "FAIL_FAST";
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 300_000;
  }

  public getMemoryStore(): MissionMemoryStore {
    return this.memoryStore;
  }

  public getContextRetriever(): MissionContextRetriever {
    return this.contextRetriever;
  }

  public getCanonicalWorkspace(): CanonicalWorkspace {
    return this.canonicalWorkspace;
  }

  private emit(
    payload: Parameters<typeof legionEventBus.emit>[0],
    callback?: (event: Parameters<typeof legionEventBus.emit>[0]) => void,
    meta?: { seq?: number; slotId?: number; activeTaskCount?: number; concurrencyLimit?: number }
  ) {
    const rawEnriched = {
      ...payload,
      seq: meta?.seq ?? 0,
      slotId: meta?.slotId ?? (payload as { slotId?: number }).slotId,
      activeTaskCount: meta?.activeTaskCount ?? (payload as { activeTaskCount?: number }).activeTaskCount,
      concurrencyLimit: meta?.concurrencyLimit ?? (payload as { concurrencyLimit?: number }).concurrencyLimit,
    };

    const enriched = sanitizeValue(rawEnriched);

    legionEventBus.emit(enriched as any);
    if (callback) {
      try {
        callback(enriched as any);
      } catch (err) {
        console.error("[LegionOrchestrator] Error in event callback:", err);
      }
    }
  }

  /**
   * Updates task statuses according to completed dependencies in DAG.
   * If failurePolicy is CONTINUE_INDEPENDENT, marks tasks with failed dependencies as BLOCKED.
   */
  private updateReadyTasks(
    taskStates: Map<string, TaskRuntimeState>,
    failurePolicy: FailurePolicy
  ) {
    for (const [, state] of taskStates) {
      if (state.status === "BACKLOG" || state.status === "REVISION_REQUIRED") {
        if (state.task.dependencies.length === 0) {
          state.status = "READY";
          continue;
        }

        // Check if any dependency is FAILED or BLOCKED in CONTINUE_INDEPENDENT
        const hasFailedDep = state.task.dependencies.some((depId) => {
          const depState = taskStates.get(depId);
          return depState && (depState.status === "FAILED" || depState.status === "BLOCKED");
        });

        if (hasFailedDep && failurePolicy === "CONTINUE_INDEPENDENT") {
          state.status = "BLOCKED";
          continue;
        }

        // Check if all dependencies are COMPLETED
        const allDepsSatisfied = state.task.dependencies.every((depId) => {
          const depState = taskStates.get(depId);
          return depState && depState.status === "COMPLETED";
        });

        if (allDepsSatisfied) {
          state.status = "READY";
        }
      }
    }
  }

  /**
   * Selects up to `maxCount` highest priority, earliest ordered READY tasks deterministically
   */
  private selectReadyTasks(
    taskStates: Map<string, TaskRuntimeState>,
    maxCount: number,
    failurePolicy: FailurePolicy
  ): TaskRuntimeState[] {
    this.updateReadyTasks(taskStates, failurePolicy);

    const readyTasks: TaskRuntimeState[] = [];
    for (const [, state] of taskStates) {
      if (state.status === "READY") {
        readyTasks.push(state);
      }
    }

    if (readyTasks.length === 0) {
      return [];
    }

    // Sort by: 1. Priority (highest first), 2. Order (lowest first), 3. ID (alphabetical)
    readyTasks.sort((a, b) => {
      const weightA = PRIORITY_WEIGHTS[a.task.priority] ?? 2;
      const weightB = PRIORITY_WEIGHTS[b.task.priority] ?? 2;

      if (weightA !== weightB) {
        return weightB - weightA; // higher priority first
      }

      if (a.task.order !== b.task.order) {
        return a.task.order - b.task.order; // lower order first
      }

      return a.task.id.localeCompare(b.task.id);
    });

    return readyTasks.slice(0, maxCount);
  }

  /**
   * Detects if unresolved tasks cannot make progress.
   * Only deadlocked if no tasks are RUNNING and no tasks are READY to start.
   */
  private isDeadlocked(
    taskStates: Map<string, TaskRuntimeState>,
    activeWorkersCount: number
  ): boolean {
    if (activeWorkersCount > 0) {
      return false; // Workers are currently running and may resolve dependencies upon completion
    }

    let hasUnfinished = false;
    let hasReady = false;

    for (const [, state] of taskStates) {
      if (
        state.status !== "COMPLETED" &&
        state.status !== "FAILED" &&
        state.status !== "BLOCKED"
      ) {
        hasUnfinished = true;
      }
      if (state.status === "READY") {
        hasReady = true;
      }
    }

    return hasUnfinished && !hasReady;
  }  /**
   * Builds the prompt sent to the Builder agent, including architecture context, QA feedback, and shared memory context
   */
  private buildBuilderPrompt(
    state: TaskRuntimeState,
    plan: MissionPlan,
    projectContext?: string,
    archPlans?: ArchitecturePlan[],
    sharedMemoryContext?: string
  ): string {
    const task = state.task;
    let prompt = `MISSION OBJECTIVE: ${plan.title}\n`;
    if (projectContext) {
      prompt += `PROJECT CONTEXT: ${projectContext}\n`;
    }

    if (sharedMemoryContext && sharedMemoryContext.trim().length > 0) {
      prompt += `\n${sharedMemoryContext.trim()}\n`;
    }

    prompt += `\nTASK TO EXECUTE:\n`;
    prompt += `Task ID: ${task.id}\n`;
    prompt += `Title: ${task.title}\n`;
    prompt += `Description: ${task.description}\n`;
    prompt += `Priority: ${task.priority}\n`;

    if (task.requiredCapabilities.length > 0) {
      prompt += `Required Capabilities: ${task.requiredCapabilities.join(", ")}\n`;
    }

    if (task.successCriteria.length > 0) {
      prompt += `\nACCEPTANCE CRITERIA (Strictly Verified by SENTINEL QA Gatekeeper):\n`;
      task.successCriteria.forEach((sc, i) => {
        prompt += `${i + 1}. ${sc}\n`;
      });
    }

    // Include ARCHITECTURE CONTEXT when available
    if (archPlans && archPlans.length > 0) {
      prompt += `\nARCHITECTURE CONTEXT & DESIGN SPECIFICATIONS:\n`;
      archPlans.forEach((ap) => {
        prompt += `--- Architecture Blueprint (${ap.taskId}) ---\n`;
        prompt += `Summary: ${ap.summary}\n`;
        prompt += `Approach: ${ap.approach}\n`;

        if (ap.components && ap.components.length > 0) {
          prompt += `Components:\n`;
          ap.components.forEach((c) => {
            prompt += `- ${c.name}: ${c.purpose} (Files: ${c.files?.join(", ") || "n/a"})\n`;
            if (c.responsibilities.length > 0) {
              prompt += `  Responsibilities: ${c.responsibilities.join("; ")}\n`;
            }
          });
        }

        if (ap.interfaces && ap.interfaces.length > 0) {
          prompt += `Interfaces & Contracts:\n`;
          ap.interfaces.forEach((inf) => {
            prompt += `- ${inf.name} (${inf.description}):\n\`\`\`typescript\n${inf.definition}\n\`\`\`\n`;
          });
        }

        if (ap.dependencies && ap.dependencies.length > 0) {
          prompt += `Dependencies:\n`;
          ap.dependencies.forEach((d) => {
            prompt += `- [${d.type}] ${d.name}: ${d.purpose}${d.versionOrConstraint ? ` (${d.versionOrConstraint})` : ""}\n`;
          });
        }

        if (ap.constraints && ap.constraints.length > 0) {
          prompt += `Constraints:\n`;
          ap.constraints.forEach((c) => {
            prompt += `* ${c}\n`;
          });
        }

        if (ap.implementationSteps && ap.implementationSteps.length > 0) {
          prompt += `Implementation Steps for Builder:\n`;
          ap.implementationSteps.forEach((st, i) => {
            prompt += `  ${i + 1}. ${st}\n`;
          });
        }

        if (ap.validationStrategy) {
          prompt += `Validation Strategy: ${ap.validationStrategy}\n`;
        }
      });
    }

    if (state.lastSentinelReview) {
      const rev = state.lastSentinelReview;
      prompt += `\n⚠️ PREVIOUS ATTEMPT (${state.attempts}/${state.maxAttempts}) WAS REJECTED BY SENTINEL (${rev.decision}):\n`;
      prompt += `QA Summary: ${rev.summary}\n`;

      if (rev.issues.length > 0) {
        prompt += `\nDEFECTS & ISSUES TO RESOLVE:\n`;
        rev.issues.forEach((iss) => {
          prompt += `- [${iss.severity}] ${iss.title}: ${iss.description}\n`;
          if (iss.affectedFile) prompt += `  File: ${iss.affectedFile}\n`;
          if (iss.proposedFix) prompt += `  Fix: ${iss.proposedFix}\n`;
        });
      }

      if (rev.recommendations.length > 0) {
        prompt += `\nQA RECOMMENDATIONS:\n`;
        rev.recommendations.forEach((r) => {
          prompt += `- ${r}\n`;
        });
      }
      prompt += `\nPlease correct all issues above and ensure all acceptance criteria pass.`;
    }

    return prompt;
  }

  /**
   * Executes full mission loop with controlled parallel DAG execution and shared mission memory
   */
  async run(options: OrchestratorRunOptions): Promise<OrchestratorResult> {
    if (this.isRunning) {
      throw new Error("RUN_ALREADY_ACTIVE: Orchestrator instance is currently executing another mission.");
    }
    this.isRunning = true;

    try {
      return await this.executeRun(options);
    } finally {
      this.isRunning = false;
    }
  }

  private async executeRun(options: OrchestratorRunOptions): Promise<OrchestratorResult> {
    const startedAt = new Date().toISOString();
    let missionId = options.missionId || (this.canonicalWorkspace.getMissionId() !== "default" ? this.canonicalWorkspace.getMissionId() : `mission-${Date.now()}`);
    if (this.canonicalWorkspace.getMissionId() === "default" && this.canonicalWorkspace.getCurrentRevision() === 0 && !this.canonicalWorkspace.isFrozen()) {
      (this.canonicalWorkspace as any).missionId = missionId;
    }
    const maxAttemptsPerTask = options.maxAttemptsPerTask ?? this.defaultMaxAttemptsPerTask;
    const maxConcurrentTasks = Math.max(
      1,
      options.maxConcurrentTasks ?? this.defaultMaxConcurrentTasks
    );
    const failurePolicy = options.failurePolicy ?? this.defaultFailurePolicy;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const signal = options.signal;
    const callback = options.onEvent;
    const onStatusChange = options.onStatusChange;

    const missionStartedAt = Date.now();
    const missionDeadlineAt = timeoutMs > 0 && timeoutMs < Infinity ? missionStartedAt + timeoutMs : Infinity;
    const remainingTimeMs = () => Math.max(0, missionDeadlineAt - Date.now());

    let eventSeq = 0;
    const getNextSeq = () => ++eventSeq;

    let currentStatus: MissionExecutionStatus = "IDLE";
    const updateStatus = (newStatus: MissionExecutionStatus) => {
      currentStatus = newStatus;
      onStatusChange?.(newStatus);
    };

    const taskStates = new Map<string, TaskRuntimeState>();
    const architecturePlans = new Map<string, ArchitecturePlan>();
    const totalTokens = { prompt: 0, completion: 0, total: 0 };
    let totalCostUsd = 0;
    let totalAttemptsCount = 0;

    const startTimestamp = Date.now();

    // 1. Initial Planning Phase with COMMANDER
    updateStatus("PLANNING");
    this.emit(
      {
        missionId,
        type: "MISSION_PLANNING",
        title: "Mission Orchestration",
        message: `ORCHESTRATOR started planning mission with parallel DAG limit ${maxConcurrentTasks}: "${options.missionPrompt.slice(0, 100)}"`,
      },
      callback,
      { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
    );

    if (signal?.aborted || Date.now() >= missionDeadlineAt) {
      updateStatus("CANCELLED");
      const memorySnapshot = await this.memoryStore.snapshot(missionId);
      return {
        missionId,
        status: "CANCELLED",
        taskResults: {},
        architecturePlans: {},
        memorySnapshot,
        workspace: this.canonicalWorkspace,
        totalAttempts: 0,
        totalTokens,
        totalCostUsd,
        summary: "Mission cancelled during initial planning.",
        startedAt,
        completedAt: new Date().toISOString(),
        error: "EXECUTION_CANCELLED",
      };
    }

    const commanderResult = await this.commander.plan({
      missionId,
      missionPrompt: options.missionPrompt,
      projectContext: options.projectContext,
      signal,
      timeoutMs: Math.min(60_000, remainingTimeMs()),
      onEvent: callback,
    });

    if (commanderResult.totalTokens) {
      totalTokens.prompt += commanderResult.totalTokens.prompt ?? 0;
      totalTokens.completion += commanderResult.totalTokens.completion ?? 0;
      totalTokens.total += commanderResult.totalTokens.total ?? 0;
    }
    totalCostUsd += commanderResult.totalCostUsd ?? 0;

    if (commanderResult.status !== "SUCCESS" || !commanderResult.plan) {
      updateStatus(commanderResult.status === "CANCELLED" ? "CANCELLED" : "FAILED");
      const errorMsg =
        commanderResult.error || "Commander failed to produce a valid mission plan.";
      this.emit(
        {
          missionId,
          type: "MISSION_FAILED",
          title: "Planning Failed",
          message: `ORCHESTRATOR planning failed: ${errorMsg}`,
        },
        callback,
        { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
      );

      const memorySnapshot = await this.memoryStore.snapshot(missionId);
      return {
        missionId,
        status: commanderResult.status === "CANCELLED" ? "CANCELLED" : "FAILED",
        taskResults: {},
        architecturePlans: {},
        memorySnapshot,
        workspace: this.canonicalWorkspace,
        totalAttempts: 0,
        totalTokens,
        totalCostUsd,
        summary: "Planning failed.",
        startedAt,
        completedAt: new Date().toISOString(),
        error: errorMsg,
      };
    }

    const plan = commanderResult.plan;
    if (!options.missionId && plan.missionId && plan.missionId !== missionId) {
      missionId = plan.missionId;
      if (this.canonicalWorkspace.getCurrentRevision() === 0 && !this.canonicalWorkspace.isFrozen()) {
        (this.canonicalWorkspace as any).missionId = missionId;
      }
    }

    // Record COMMANDER mission requirements & plan in shared memory
    await this.memoryStore.append({
      missionId,
      agentRole: "COMMANDER",
      type: "MISSION_REQUIREMENT",
      title: `Mission Objective: ${plan.title}`,
      content: `Objective: ${plan.title}\nSummary: ${plan.summary || ""}\nEstimated Total Tasks: ${plan.tasks.length}`,
      tags: ["requirement", "commander", "objective"],
      importance: "CRITICAL",
    });

    await this.memoryStore.append({
      missionId,
      agentRole: "COMMANDER",
      type: "COMMANDER_DECISION",
      title: `Execution Plan for "${plan.title}"`,
      content: `Strategy: Formulated ${plan.tasks.length} tasks across DAG. Estimated complexity: ${plan.estimatedComplexity || "MEDIUM"}.\nTasks:\n${plan.tasks.map((t) => `- ${t.id}: ${t.title} [${t.assignedRole}] (Deps: ${t.dependencies.join(", ") || "none"})`).join("\n")}`,
      tags: ["planning", "strategy", "dag"],
      importance: "HIGH",
    });

    // Initialize runtime task states
    plan.tasks.forEach((t) => {
      taskStates.set(t.id, {
        task: t,
        status: t.dependencies.length === 0 ? "READY" : "BACKLOG",
        attempts: 0,
        maxAttempts: maxAttemptsPerTask,
        history: [],
      });
    });

    this.emit(
      {
        missionId,
        type: "MISSION_STARTED",
        title: plan.title,
        message: `ORCHESTRATOR DAG plan ready with ${plan.tasks.length} tasks. Concurrency limit: ${maxConcurrentTasks}. Starting execution.`,
      },
      callback,
      { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
    );

    // 2. Parallel DAG Execution Engine Setup
    // Initialize available worker slot IDs [0, 1, ..., maxConcurrentTasks - 1]
    const availableSlots: number[] = Array.from(
      { length: maxConcurrentTasks },
      (_, i) => i
    );
    const activeWorkers = new Map<string, WorkerSlot>();

    let fatalError: string | null = null;
    let isDraining = false;
    let lastIntegratedQA: IntegratedQAResult | undefined;
    const internalAbortController = new AbortController();

    if (signal) {
      signal.addEventListener("abort", () => internalAbortController.abort());
    }

    let deadlineTimer: NodeJS.Timeout | null = null;
    let isDeadlineExpired = false;

    if (timeoutMs > 0 && timeoutMs < Infinity) {
      deadlineTimer = setTimeout(() => {
        isDeadlineExpired = true;
        internalAbortController.abort();
      }, remainingTimeMs());
    }

    const drainAllWorkers = async () => {
      isDraining = true;
      internalAbortController.abort();
      if (activeWorkers.size > 0) {
        await Promise.allSettled(
          Array.from(activeWorkers.values()).map((w) => w.promise)
        );
      }
    };

    /**
     * Executes a single task in an assigned worker slot
     */
    const executeTaskInSlot = async (
      taskState: TaskRuntimeState,
      slotId: number
    ): Promise<void> => {
      try {
        if (internalAbortController.signal.aborted || isDraining) {
          taskState.status = "FAILED";
          taskState.error = "EXECUTION_CANCELLED";
          return;
        }

        const task = taskState.task;
        taskState.attempts++;
        totalAttemptsCount++;
        taskState.startedAt = taskState.startedAt || new Date().toISOString();
        taskState.status = "RUNNING";
        taskState.slotId = slotId;

      this.emit(
        {
          missionId,
          type: "TASK_STARTED",
          taskId: task.id,
          taskTitle: task.title,
          assignedRole: task.assignedRole,
          status: "IN_PROGRESS",
          priority: task.priority,
          message: `ORCHESTRATOR dispatched task "${task.id}" (${task.assignedRole}) on [Slot ${slotId + 1}] [Attempt ${taskState.attempts}/${taskState.maxAttempts}]`,
        },
        callback,
        {
          seq: getNextSeq(),
          slotId,
          activeTaskCount: activeWorkers.size,
          concurrencyLimit: maxConcurrentTasks,
        }
      );

      // Retrieve relevant shared context for this task
      const retrievedContext = await this.contextRetriever.getRelevantContext({
        missionId,
        taskId: task.id,
        dependencies: task.dependencies,
        assignedRole: task.assignedRole,
        taskTitle: task.title,
        taskDescription: task.description,
        tags: task.requiredCapabilities,
      });
      const sharedContext = retrievedContext.formattedContext;

      // A) Handle ARCHITECT Role
      if (task.assignedRole === "ARCHITECT") {
        if (!this.architect) {
          const unavailMsg = `ARCHITECT_UNAVAILABLE: Task "${task.id}" is assigned to ARCHITECT but no ArchitectAgent was provided to the Orchestrator.`;
          taskState.status = "FAILED";
          taskState.error = unavailMsg;
          this.emit(
            {
              missionId,
              type: "TASK_FAILED",
              taskId: task.id,
              taskTitle: task.title,
              assignedRole: "ARCHITECT",
              status: "FAILED",
              priority: task.priority,
              message: unavailMsg,
            },
            callback,
            { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
          );

          if (failurePolicy === "FAIL_FAST") {
            fatalError = unavailMsg;
            internalAbortController.abort();
          }
          return;
        }

        const combinedProjectContext = [
          options.projectContext,
          sharedContext ? `\n--- RELEVANT SHARED MEMORY CONTEXT ---\n${sharedContext}` : "",
        ]
          .filter(Boolean)
          .join("\n");

        const archResult = await this.architect.design({
          missionId,
          taskId: task.id,
          task,
          missionPrompt: options.missionPrompt,
          projectContext: combinedProjectContext,
          technicalRequirements: task.successCriteria,
          signal: internalAbortController.signal,
          onEvent: callback,
        });

        totalTokens.prompt += archResult.totalTokens.prompt;
        totalTokens.completion += archResult.totalTokens.completion;
        totalTokens.total += archResult.totalTokens.total;
        totalCostUsd += archResult.totalCostUsd;

        if (archResult.status === "CANCELLED" || internalAbortController.signal.aborted || isDraining) {
          taskState.status = "FAILED";
          taskState.error = "EXECUTION_CANCELLED";
          return;
        }

        if (archResult.status === "FAILED" || !archResult.plan) {
          const failMsg = archResult.error || "Architect failed to produce architecture blueprint.";
          taskState.status = "FAILED";
          taskState.error = failMsg;
          taskState.history.push({
            attempt: taskState.attempts,
            error: failMsg,
            timestamp: new Date().toISOString(),
          });

          this.emit(
            {
              missionId,
              type: "TASK_FAILED",
              taskId: task.id,
              taskTitle: task.title,
              assignedRole: "ARCHITECT",
              status: "FAILED",
              priority: task.priority,
              message: `Architect task "${task.id}" failed: ${failMsg}`,
            },
            callback,
            { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
          );

          if (failurePolicy === "FAIL_FAST") {
            fatalError = failMsg;
            internalAbortController.abort();
          }
          return;
        }

        // Architecture plan succeeded!
        const archPlan = archResult.plan;
        architecturePlans.set(task.id, archPlan);
        taskState.status = "COMPLETED";
        taskState.completedAt = new Date().toISOString();
        taskState.lastArchitecturePlan = archPlan;
        taskState.history.push({
          attempt: taskState.attempts,
          architecturePlan: archPlan,
          timestamp: new Date().toISOString(),
        });

        // Record ARCHITECT decisions into shared memory
        await this.memoryStore.append({
          missionId,
          taskId: task.id,
          agentRole: "ARCHITECT",
          type: "ARCHITECTURE_DECISION",
          title: `Architecture Blueprint: ${task.title}`,
          content: `Summary: ${archPlan.summary}\nApproach: ${archPlan.approach}\nValidation Strategy: ${archPlan.validationStrategy || "n/a"}\nComponents: ${archPlan.components?.map((c) => c.name).join(", ") || "none"}`,
          tags: ["architecture", "design", ...(task.requiredCapabilities || [])],
          importance: "CRITICAL",
        });

        if (archPlan.interfaces && archPlan.interfaces.length > 0) {
          await this.memoryStore.append({
            missionId,
            taskId: task.id,
            agentRole: "ARCHITECT",
            type: "INTERFACE_CONTRACT",
            title: `Interface Contracts: ${task.title}`,
            content: archPlan.interfaces
              .map(
                (inf) =>
                  `${inf.name} (${inf.description}):\n\`\`\`typescript\n${inf.definition}\n\`\`\``
              )
              .join("\n\n"),
            tags: ["interface", "contract", "typescript"],
            importance: "CRITICAL",
          });
        }

        this.emit(
          {
            missionId,
            type: "TASK_COMPLETED",
            taskId: task.id,
            taskTitle: task.title,
            assignedRole: "ARCHITECT",
            status: "COMPLETED",
            priority: task.priority,
            message: `ARCHITECT completed task "${task.id}": "${archPlan.summary}"`,
          },
          callback,
          { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
        );
        return;
      }

      // B) Handle Unsupported Roles
      if (task.assignedRole !== "BUILDER") {
        const unsupportedMsg = `UNSUPPORTED_ROLE: Direct task execution for role "${task.assignedRole}" is not supported.`;
        taskState.status = "FAILED";
        taskState.error = unsupportedMsg;

        this.emit(
          {
            missionId,
            type: "TASK_FAILED",
            taskId: task.id,
            taskTitle: task.title,
            assignedRole: task.assignedRole,
            status: "FAILED",
            priority: task.priority,
            message: unsupportedMsg,
          },
          callback,
          { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
        );

        if (failurePolicy === "FAIL_FAST") {
          fatalError = unsupportedMsg;
          internalAbortController.abort();
        }
        return;
      }

      // C) Handle BUILDER Role with Sandbox Isolation Strategy
      let dedicatedSandboxId = options.sandboxId;
      let dedicatedSandboxCreated = false;

      if (this.sandboxProvider && maxConcurrentTasks > 1) {
        try {
          const createdInstance = await this.sandboxProvider.create();
          dedicatedSandboxId = createdInstance.id;
          dedicatedSandboxCreated = true;
        } catch (createErr) {
          const errMsg = `SANDBOX_CREATE_FAILED: Failed to create isolated sandbox for parallel task ${task.id}: ${createErr instanceof Error ? createErr.message : String(createErr)}`;
          taskState.status = "FAILED";
          taskState.error = errMsg;
          taskState.history.push({
            attempt: taskState.attempts,
            error: errMsg,
            timestamp: new Date().toISOString(),
          });

          this.emit(
            {
              missionId,
              type: "SANDBOX_ERROR",
              sandboxId: "unknown",
              provider: this.sandboxProvider?.name || "none",
              message: errMsg,
              error: errMsg,
            },
            callback,
            { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
          );

          this.emit(
            {
              missionId,
              type: "TASK_FAILED",
              taskId: task.id,
              taskTitle: task.title,
              assignedRole: "BUILDER",
              status: "FAILED",
              priority: task.priority,
              message: errMsg,
            },
            callback,
            { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
          );

          if (failurePolicy === "FAIL_FAST") {
            fatalError = errMsg;
            internalAbortController.abort();
          }
          return;
        }
      }

      try {
        if (internalAbortController.signal.aborted || isDraining) {
          taskState.status = "FAILED";
          taskState.error = "EXECUTION_CANCELLED";
          return;
        }

        // Create baseline snapshot from canonical workspace before Builder runs
        const baselineSnapshot = this.canonicalWorkspace.createSnapshot(task.id);

        // Collect relevant architecture plans for Builder
        const relevantArchPlans: ArchitecturePlan[] = [];
        task.dependencies.forEach((depId) => {
          const ap = architecturePlans.get(depId);
          if (ap) relevantArchPlans.push(ap);
        });
        if (relevantArchPlans.length === 0 && architecturePlans.size > 0) {
          for (const ap of architecturePlans.values()) {
            relevantArchPlans.push(ap);
          }
        }

        const builderPrompt = this.buildBuilderPrompt(
          taskState,
          plan,
          options.projectContext,
          relevantArchPlans,
          sharedContext
        );

        const builderResult = await this.builder.run({
          missionId,
          taskId: task.id,
          taskPrompt: builderPrompt,
          sandboxId: dedicatedSandboxId,
          baselineSnapshot,
          signal: internalAbortController.signal,
          onEvent: callback,
        });

        totalTokens.prompt += builderResult.totalTokens.prompt;
        totalTokens.completion += builderResult.totalTokens.completion;
        totalTokens.total += builderResult.totalTokens.total;
        totalCostUsd += builderResult.totalCostUsd;
        taskState.lastBuilderResult = builderResult;

        if (builderResult.status === "CANCELLED" || internalAbortController.signal.aborted || isDraining) {
          taskState.status = "FAILED";
          taskState.error = "EXECUTION_CANCELLED";
          return;
        }

        // Extract modified files & commands from steps if any
        const modifiedFiles: string[] = builderResult.patch?.files.map((c) => c.path) || [];
        const commandsRun: string[] = builderResult.evidence?.commands.map((c) => c.command) || [];

        // Record BUILDER implementation change in shared memory
        await this.memoryStore.append({
          missionId,
          taskId: task.id,
          agentRole: "BUILDER",
          type: "IMPLEMENTATION_CHANGE",
          title: `Implementation: ${task.title} (Attempt ${taskState.attempts})`,
          content: `Status: ${builderResult.status}\nFiles Modified: ${modifiedFiles.length > 0 ? modifiedFiles.join(", ") : "none"}\nSummary: ${builderResult.finalResponse || "No summary provided"}\nCommands Run: ${commandsRun.length}`,
          tags: ["implementation", "builder", ...modifiedFiles],
          importance: builderResult.status === "SUCCESS" ? "HIGH" : "MEDIUM",
        });

        if (builderResult.finalResponse) {
          await this.memoryStore.append({
            missionId,
            taskId: task.id,
            agentRole: "BUILDER",
            type: "TASK_RESULT",
            title: `Builder Output for Task ${task.id}`,
            content: builderResult.finalResponse.slice(0, 1500),
            tags: ["task_result", "builder"],
            importance: "MEDIUM",
          });
        }

        if (builderResult.status === "FAILED") {
          if (taskState.attempts >= taskState.maxAttempts) {
            taskState.status = "FAILED";
            taskState.error = builderResult.error || "Builder execution failed.";

            this.emit(
              {
                missionId,
                type: "TASK_FAILED",
                taskId: task.id,
                taskTitle: task.title,
                assignedRole: task.assignedRole,
                status: "FAILED",
                priority: task.priority,
                message: `Task "${task.id}" failed after reaching maximum attempts (${taskState.maxAttempts}).`,
              },
              callback,
              { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
            );

            if (failurePolicy === "FAIL_FAST") {
              fatalError = taskState.error;
              internalAbortController.abort();
            }
          } else {
            // Re-queue for Builder retry
            taskState.status = "REVISION_REQUIRED";
          }
          return;
        }

        // D) Verification with SENTINEL (Evaluates Real Execution Evidence)
        taskState.status = "VERIFYING";
        this.emit(
          {
            missionId,
            type: "TASK_REVIEW",
            taskId: task.id,
            taskTitle: task.title,
            assignedRole: "SENTINEL",
            status: "REVIEW",
            priority: task.priority,
            message: `ORCHESTRATOR sent task "${task.id}" on [Slot ${slotId + 1}] to SENTINEL for QA verification.`,
          },
          callback,
          { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
        );

        const sentinelResult = await this.sentinel.review({
          missionId,
          task,
          builderResult,
          signal: internalAbortController.signal,
          onEvent: callback,
        });

        if (sentinelResult.totalTokens) {
          totalTokens.prompt += sentinelResult.totalTokens.prompt ?? 0;
          totalTokens.completion += sentinelResult.totalTokens.completion ?? 0;
          totalTokens.total += sentinelResult.totalTokens.total ?? 0;
        }
        totalCostUsd += sentinelResult.totalCostUsd ?? 0;

        if (sentinelResult.status === "CANCELLED" || internalAbortController.signal.aborted || isDraining) {
          taskState.status = "FAILED";
          taskState.error = "EXECUTION_CANCELLED";
          return;
        }

        const review = sentinelResult.review;
        taskState.lastSentinelReview = review;
        taskState.history.push({
          attempt: taskState.attempts,
          builderResult,
          sentinelReview: review,
          timestamp: new Date().toISOString(),
        });

        if (review) {
          // Record SENTINEL finding in shared memory
          await this.memoryStore.append({
            missionId,
            taskId: task.id,
            agentRole: "SENTINEL",
            type: "SENTINEL_FINDING",
            title: `QA Review: ${task.title} - ${review.decision}`,
            content: `Decision: ${review.decision}\nConfidence: ${review.confidence}\nSummary: ${review.summary}\nPassed Criteria: ${review.criteriaResults?.filter((c) => c.status === "PASS").map((c) => c.criterion).join("; ") || "none"}\nFailed Criteria: ${review.criteriaResults?.filter((c) => c.status !== "PASS").map((c) => `${c.criterion} (${c.reason || ""})`).join("; ") || "none"}`,
            tags: ["qa", "sentinel", review.decision],
            importance: review.decision === "APPROVED" ? "HIGH" : "CRITICAL",
          });

          if (review.issues && review.issues.length > 0) {
            for (const issue of review.issues) {
              await this.memoryStore.append({
                missionId,
                taskId: task.id,
                agentRole: "SENTINEL",
                type: "ISSUE",
                title: `Defect: ${issue.title}`,
                content: `Severity: ${issue.severity}\nDescription: ${issue.description}\nAffected File: ${issue.affectedFile || "n/a"}\nProposed Fix: ${issue.proposedFix || "n/a"}`,
                tags: ["issue", "defect", issue.severity.toLowerCase()],
                importance: issue.severity === "CRITICAL" ? "CRITICAL" : issue.severity === "HIGH" ? "HIGH" : "MEDIUM",
              });
            }
          }

          if (review.recommendations && review.recommendations.length > 0) {
            await this.memoryStore.append({
              missionId,
              taskId: task.id,
              agentRole: "SENTINEL",
              type: "LESSON",
              title: `Sentinel Lessons for ${task.title}`,
              content: review.recommendations.join("\n"),
              tags: ["lesson", "qa_recommendation"],
              importance: "MEDIUM",
            });
          }
        }

        if (review && review.decision === "APPROVED") {
          // Check if abort occurred before integrating patch
          if (internalAbortController.signal.aborted || isDraining) {
            taskState.status = "FAILED";
            taskState.error = "EXECUTION_CANCELLED";
            return;
          }

          // E) ATOMIC INTEGRATION TO CANONICAL WORKSPACE & CONFLICT DETECTION
          const patchToIntegrate: TaskPatch = builderResult.patch || {
            id: `patch-${task.id}-${Date.now()}`,
            taskId: task.id,
            missionId,
            baseRevision: baselineSnapshot.baseRevision,
            files: [],
            createdAt: new Date().toISOString(),
            authorRole: "BUILDER",
            summary: builderResult.finalResponse || "No patch changes produced",
          };

          const integrationResult = this.canonicalWorkspace.integratePatch(patchToIntegrate);

          if (!integrationResult.success) {
            // Integration failed due to conflict / stale base revision
            const conflictDetails = (integrationResult.conflicts || [])
              .map((c) => `${c.path} (${c.type}: ${c.details})`)
              .join("; ");
            const conflictError = `INTEGRATION_CONFLICT: Task "${task.id}" approved by Sentinel but failed canonical workspace integration: ${conflictDetails}`;

            taskState.status = "FAILED";
            taskState.error = conflictError;
            taskState.history.push({
              attempt: taskState.attempts,
              error: conflictError,
              timestamp: new Date().toISOString(),
            });

            this.emit(
              {
                missionId,
                type: "TASK_FAILED",
                taskId: task.id,
                taskTitle: task.title,
                assignedRole: task.assignedRole,
                status: "FAILED",
                priority: task.priority,
                message: conflictError,
              },
              callback,
              { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
            );

            if (failurePolicy === "FAIL_FAST") {
              fatalError = conflictError;
              internalAbortController.abort();
            }
            return;
          }

          // Atomic integration succeeded!
          taskState.status = "COMPLETED";
          taskState.completedAt = new Date().toISOString();

          this.emit(
            {
              missionId,
              type: "TASK_COMPLETED",
              taskId: task.id,
              taskTitle: task.title,
              assignedRole: task.assignedRole,
              status: "COMPLETED",
              priority: task.priority,
              message: `ORCHESTRATOR: Task "${task.id}" APPROVED by SENTINEL and INTEGRATED into canonical workspace (Rev ${integrationResult.revision}, +${integrationResult.filesChanged.length} files).`,
            },
            callback,
            { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
          );
        } else {
          const isFatal = review?.decision === "FAILED";
          const reachedLimit = taskState.attempts >= taskState.maxAttempts;

          if (reachedLimit || isFatal) {
            taskState.status = "FAILED";
            taskState.error =
              review?.summary ||
              `Task rejected by Sentinel after ${taskState.attempts} attempts.`;

            this.emit(
              {
                missionId,
                type: "TASK_FAILED",
                taskId: task.id,
                taskTitle: task.title,
                assignedRole: task.assignedRole,
                status: "FAILED",
                priority: task.priority,
                message: `ORCHESTRATOR: Task "${task.id}" FAILED (${taskState.error}).`,
              },
              callback,
              { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
            );

            if (failurePolicy === "FAIL_FAST") {
              fatalError = taskState.error;
              internalAbortController.abort();
            }
          } else {
            // Re-queue for retry without blocking other parallel workers
            taskState.status = "REVISION_REQUIRED";
            this.emit(
              {
                missionId,
                type: "TASK_REVIEW",
                taskId: task.id,
                taskTitle: task.title,
                assignedRole: "BUILDER",
                status: "IN_PROGRESS",
                priority: task.priority,
                message: `ORCHESTRATOR: Task "${task.id}" requires revision. Re-queuing to BUILDER with QA feedback.`,
              },
              callback,
              { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
            );
          }
        }
      } finally {
        if (dedicatedSandboxCreated && this.sandboxProvider) {
          try {
            await this.sandboxProvider.destroy(dedicatedSandboxId);
          } catch (destroyErr) {
            const destroyErrMsg = `SANDBOX_DESTROY_FAILED: Sandbox container "${dedicatedSandboxId}" cleanup failed: ${destroyErr instanceof Error ? destroyErr.message : String(destroyErr)}`;
            this.emit(
              {
                missionId,
                type: "SANDBOX_ERROR",
                sandboxId: dedicatedSandboxId,
                provider: this.sandboxProvider?.name || "none",
                message: destroyErrMsg,
                error: destroyErrMsg,
              },
              callback,
              { seq: getNextSeq(), slotId, activeTaskCount: activeWorkers.size, concurrencyLimit: maxConcurrentTasks }
            );
          }
        }
      }
    } catch (workerEx: unknown) {
      const exMsg = workerEx instanceof Error ? workerEx.message : String(workerEx);
      taskState.status = "FAILED";
      taskState.error = exMsg;
      fatalError = exMsg;
      internalAbortController.abort();
    }
  };

  // 3. Central Concurrency Loop with Structured Concurrency & Real Deadline
  try {
    while (true) {
      // Check if fatal error occurred in FAIL_FAST
      if (fatalError && failurePolicy === "FAIL_FAST") {
        await drainAllWorkers();
        updateStatus("FAILED");
        this.emit(
          {
            missionId,
            type: "MISSION_FAILED",
            title: plan.title,
            message: `Mission failed (FAIL_FAST): ${fatalError}`,
          },
          callback,
          { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
        );

        const memorySnapshot = await this.memoryStore.snapshot(missionId);
        return {
          missionId,
          status: "FAILED",
          plan,
          taskResults: Object.fromEntries(taskStates),
          architecturePlans: Object.fromEntries(architecturePlans),
          memorySnapshot,
          workspace: this.canonicalWorkspace,
          integratedQA: lastIntegratedQA,
          totalAttempts: totalAttemptsCount,
          totalTokens,
          totalCostUsd,
          summary: `Mission failed: ${fatalError}`,
          startedAt,
          completedAt: new Date().toISOString(),
          error: fatalError,
        };
      }

      if (signal?.aborted) {
        await drainAllWorkers();
        updateStatus("CANCELLED");
        const memorySnapshot = await this.memoryStore.snapshot(missionId);
        return {
          missionId,
          status: "CANCELLED",
          plan,
          taskResults: Object.fromEntries(taskStates),
          architecturePlans: Object.fromEntries(architecturePlans),
          memorySnapshot,
          workspace: this.canonicalWorkspace,
          integratedQA: lastIntegratedQA,
          totalAttempts: totalAttemptsCount,
          totalTokens,
          totalCostUsd,
          summary: "Mission execution cancelled.",
          startedAt,
          completedAt: new Date().toISOString(),
          error: "EXECUTION_CANCELLED",
        };
      }

      if (isDeadlineExpired || Date.now() - startTimestamp > timeoutMs) {
        await drainAllWorkers();
        updateStatus("FAILED");
        const timeoutError = `Mission execution timed out after ${timeoutMs}ms.`;
        this.emit(
          {
            missionId,
            type: "MISSION_FAILED",
            title: plan.title,
            message: timeoutError,
          },
          callback,
          { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
        );

        const memorySnapshot = await this.memoryStore.snapshot(missionId);
        return {
          missionId,
          status: "FAILED",
          plan,
          taskResults: Object.fromEntries(taskStates),
          architecturePlans: Object.fromEntries(architecturePlans),
          memorySnapshot,
          workspace: this.canonicalWorkspace,
          integratedQA: lastIntegratedQA,
          totalAttempts: totalAttemptsCount,
          totalTokens,
          totalCostUsd,
          summary: "Mission failed due to overall timeout.",
          startedAt,
          completedAt: new Date().toISOString(),
          error: timeoutError,
        };
      }

      // Check if all tasks have reached a terminal state
      const allDone = Array.from(taskStates.values()).every(
        (st) =>
          st.status === "COMPLETED" ||
          st.status === "FAILED" ||
          st.status === "BLOCKED"
      );

      if (allDone && activeWorkers.size === 0) {
        const hasFailures = Array.from(taskStates.values()).some(
          (st) => st.status === "FAILED" || st.status === "BLOCKED"
        );

        if (hasFailures) {
          await drainAllWorkers();
          updateStatus("FAILED");
          const failSummary = "Mission finished with failed or blocked tasks.";
          this.emit(
            {
              missionId,
              type: "MISSION_FAILED",
              title: plan.title,
              message: failSummary,
            },
            callback,
            { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
          );

          const memorySnapshot = await this.memoryStore.snapshot(missionId);
          return {
            missionId,
            status: "FAILED",
            plan,
            taskResults: Object.fromEntries(taskStates),
            architecturePlans: Object.fromEntries(architecturePlans),
            memorySnapshot,
            workspace: this.canonicalWorkspace,
            integratedQA: lastIntegratedQA,
            totalAttempts: totalAttemptsCount,
            totalTokens,
            totalCostUsd,
            summary: failSummary,
            startedAt,
            completedAt: new Date().toISOString(),
            error: "TASKS_FAILED",
          };
        } else {
          // P0-01: REAL INTEGRATED QA GATE
          updateStatus("VERIFYING");
          this.emit(
            {
              missionId,
              type: "AGENT_WORKING",
              role: "SENTINEL",
              status: "WORKING",
              message: "ORCHESTRATOR initiating Real Integrated QA Gate across combined CanonicalWorkspace...",
            },
            callback,
            { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
          );

          const revisionBeforeQA = this.canonicalWorkspace.getCurrentRevision();
          const generationBeforeQA = this.canonicalWorkspace.getGenerationId();
          const digestBeforeQA = this.canonicalWorkspace.getWorkspaceDigest();

          let integratedSuccess = true;
          let integratedError: string | undefined;

          // P0-02: In production mode (requireRealExecution === true), Integrated QA MUST pass the official pipeline
          if (options.requireRealExecution) {
            if (!this.sandboxProvider || !verifyTrustedRealCapability(this.sandboxProvider)) {
              integratedSuccess = false;
              integratedError = "NO_REAL_PROVIDER: Production QA requires authentic trusted real sandbox provider.";
            } else if (Object.keys(this.canonicalWorkspace.getAllFiles()).length === 0) {
              integratedSuccess = false;
              integratedError = "EMPTY_WORKSPACE: Canonical workspace is empty, no files to validate.";
            } else {
              let verificationSandboxId = options.sandboxId;
              let createdVerificationSandbox = false;

              try {
                if (!verificationSandboxId) {
                  const created = await this.sandboxProvider.create();
                  verificationSandboxId = created.id;
                  createdVerificationSandbox = true;
                }

                const qaResult = await executeIntegratedQA({
                  workspace: this.canonicalWorkspace,
                  sandboxProvider: this.sandboxProvider,
                  sandboxId: verificationSandboxId,
                  timeoutMs: Math.min(options.timeoutMs || 60_000, remainingTimeMs()),
                  requireRealExecution: true,
                  signal: internalAbortController.signal,
                });

                lastIntegratedQA = qaResult;

                if (!qaResult.success) {
                  integratedSuccess = false;
                  integratedError = qaResult.error || "Integrated QA verification failed.";
                } else if (this.integratedValidator) {
                  // Custom validator runs strictly as an additional secondary check AFTER real pipeline
                  const valResult = await this.integratedValidator(this.canonicalWorkspace, {
                    sandboxProvider: this.sandboxProvider,
                    sandboxId: verificationSandboxId,
                  });
                  if (!valResult.success) {
                    integratedSuccess = false;
                    integratedError = valResult.error || "Custom integrated validator check failed after real QA.";
                  }
                }
              } catch (verifyErr) {
                integratedSuccess = false;
                integratedError = `Verification execution error: ${verifyErr instanceof Error ? verifyErr.message : String(verifyErr)}`;
              } finally {
                if (createdVerificationSandbox && this.sandboxProvider) {
                  try {
                    await this.sandboxProvider.destroy(verificationSandboxId);
                  } catch (destroyErr) {
                    const destroyErrMsg = `SANDBOX_DESTROY_FAILED: Verification sandbox cleanup failed: ${destroyErr instanceof Error ? destroyErr.message : String(destroyErr)}`;
                    this.emit(
                      {
                        missionId,
                        type: "SANDBOX_ERROR",
                        sandboxId: verificationSandboxId,
                        provider: this.sandboxProvider?.name || "none",
                        message: destroyErrMsg,
                        error: destroyErrMsg,
                      },
                      callback,
                      { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
                    );
                  }
                }
              }
            }
          } else {
            // Non-production mode allows custom validator or fallback
            if (this.integratedValidator) {
              try {
                const valResult = await this.integratedValidator(this.canonicalWorkspace, {
                  sandboxProvider: this.sandboxProvider,
                  sandboxId: options.sandboxId,
                });
                if (!valResult.success) {
                  integratedSuccess = false;
                  integratedError = valResult.error || "Integrated workspace validation failed.";
                }
              } catch (valErr) {
                integratedSuccess = false;
                integratedError = `Integrated validator error: ${valErr instanceof Error ? valErr.message : String(valErr)}`;
              }
            } else if (this.sandboxProvider && Object.keys(this.canonicalWorkspace.getAllFiles()).length > 0) {
              let verificationSandboxId = options.sandboxId;
              let createdVerificationSandbox = false;

              try {
                if (!verificationSandboxId) {
                  const created = await this.sandboxProvider.create();
                  verificationSandboxId = created.id;
                  createdVerificationSandbox = true;
                }

                const qaResult = await executeIntegratedQA({
                  workspace: this.canonicalWorkspace,
                  sandboxProvider: this.sandboxProvider,
                  sandboxId: verificationSandboxId,
                  timeoutMs: Math.min(options.timeoutMs || 60_000, remainingTimeMs()),
                  requireRealExecution: false,
                  signal: internalAbortController.signal,
                });

                lastIntegratedQA = qaResult;

                if (!qaResult.success) {
                  integratedSuccess = false;
                  integratedError = qaResult.error || "Integrated QA verification failed.";
                }
              } catch (verifyErr) {
                integratedSuccess = false;
                integratedError = `Verification execution error: ${verifyErr instanceof Error ? verifyErr.message : String(verifyErr)}`;
              } finally {
                if (createdVerificationSandbox && this.sandboxProvider) {
                  try {
                    await this.sandboxProvider.destroy(verificationSandboxId);
                  } catch (destroyErr) {
                    // ignore
                  }
                }
              }
            } else {
              integratedSuccess = true;
            }
          }

          // Abort & Cancellation check
          if (internalAbortController.signal.aborted || signal?.aborted || Date.now() >= missionDeadlineAt) {
            integratedSuccess = false;
            integratedError = "QA_ABORTED: Mission execution was cancelled or timed out during verification.";
          }

          // CANONICAL REVISION, GENERATION & DIGEST LOCK: Prove that revision, generation, and digest did not mutate during Integrated QA
          if (integratedSuccess) {
            if (this.canonicalWorkspace.getCurrentRevision() !== revisionBeforeQA) {
              integratedSuccess = false;
              integratedError = `STALE_REVISION: Canonical workspace revision changed from ${revisionBeforeQA} to ${this.canonicalWorkspace.getCurrentRevision()} during integrated QA validation.`;
            } else if (this.canonicalWorkspace.getGenerationId() !== generationBeforeQA) {
              integratedSuccess = false;
              integratedError = `STALE_GENERATION: Canonical workspace generation identity changed during integrated QA validation.`;
            } else if (this.canonicalWorkspace.getWorkspaceDigest() !== digestBeforeQA) {
              integratedSuccess = false;
              integratedError = `DIGEST_MISMATCH: Canonical workspace digest changed during integrated QA validation.`;
            }
          }

          // ATOMIC FREEZE: Lock canonical workspace so no late workers can modify it
          if (integratedSuccess) {
            this.canonicalWorkspace.freeze();
            if (
              this.canonicalWorkspace.getCurrentRevision() !== revisionBeforeQA ||
              this.canonicalWorkspace.getWorkspaceDigest() !== digestBeforeQA ||
              !this.canonicalWorkspace.isFrozen()
            ) {
              integratedSuccess = false;
              integratedError = "POST_FREEZE_MUTATION_DETECTED: Workspace mutated after freeze lock.";
            }
          }

          // Record QA Verification Result in Shared Memory BEFORE capturing final memory snapshot
          await this.memoryStore.append({
            missionId,
            agentRole: "SENTINEL",
            type: "SENTINEL_FINDING",
            title: integratedSuccess
              ? "Integrated QA Verification Passed"
              : "Integrated QA Verification Failed",
            content: JSON.stringify({
              validatedRevision: lastIntegratedQA?.validatedRevision ?? revisionBeforeQA,
              validatedGeneration: lastIntegratedQA?.validatedGeneration ?? generationBeforeQA,
              workspaceDigest: lastIntegratedQA?.workspaceDigest ?? digestBeforeQA,
              executionMode: lastIntegratedQA?.executionMode ?? (this.sandboxProvider?.executionMode || "REAL"),
              success: integratedSuccess,
              error: integratedError,
              validationPlan: lastIntegratedQA?.validationPlan,
              materialization: lastIntegratedQA?.materialization,
              commandsCount: lastIntegratedQA?.evidence.commands.length || 0,
            }),
            tags: ["qa", "integrated_qa", integratedSuccess ? "pass" : "fail"],
            importance: "CRITICAL",
          });

          // Final memory snapshot captured strictly after QA finding is persisted
          const finalMemorySnapshot = await this.memoryStore.snapshot(missionId);

          // P0-03 & P0-05: FINAL_COMMIT_GUARD
          // Re-verify all invariants atomically before committing COMPLETED status and MISSION_COMPLETED event
          if (integratedSuccess) {
            let guardFailure: string | null = null;
            if (signal?.aborted || internalAbortController.signal.aborted || isDraining) {
              guardFailure = "FINAL_COMMIT_GUARD_FAILED: Execution was cancelled or aborted before final commit.";
            } else if (Date.now() >= missionDeadlineAt) {
              guardFailure = "FINAL_COMMIT_GUARD_FAILED: Mission deadline expired before final commit.";
            } else if (!this.canonicalWorkspace.isFrozen()) {
              guardFailure = "FINAL_COMMIT_GUARD_FAILED: Canonical workspace is not frozen at final commit.";
            } else if (this.canonicalWorkspace.getCurrentRevision() !== revisionBeforeQA) {
              guardFailure = `FINAL_COMMIT_GUARD_FAILED: Canonical workspace revision mutated after QA (${revisionBeforeQA} -> ${this.canonicalWorkspace.getCurrentRevision()}).`;
            } else if (this.canonicalWorkspace.getGenerationId() !== generationBeforeQA) {
              guardFailure = "FINAL_COMMIT_GUARD_FAILED: Canonical workspace generation mutated after QA.";
            } else if (this.canonicalWorkspace.getWorkspaceDigest() !== digestBeforeQA) {
              guardFailure = "FINAL_COMMIT_GUARD_FAILED: Canonical workspace digest mutated after QA.";
            } else if (activeWorkers.size > 0) {
              guardFailure = "FINAL_COMMIT_GUARD_FAILED: Active worker tasks detected at final commit.";
            }

            if (guardFailure) {
              integratedSuccess = false;
              integratedError = guardFailure;
            }
          }

          if (!integratedSuccess) {
            const isAborted = signal?.aborted || internalAbortController.signal.aborted || Date.now() >= missionDeadlineAt;
            const finalStatus = isAborted ? "CANCELLED" : "FAILED";
            updateStatus(finalStatus);
            const failSummary = `INTEGRATED_VERIFICATION_FAILED: Combined canonical workspace failed QA validation: ${integratedError}`;

            this.emit(
              {
                missionId,
                type: finalStatus === "CANCELLED" ? "MISSION_CANCELLED" as any : "MISSION_FAILED",
                title: "Integrated QA Failed",
                message: failSummary,
              },
              callback,
              { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
            );

            return {
              missionId,
              status: finalStatus,
              plan,
              taskResults: Object.fromEntries(taskStates),
              architecturePlans: Object.fromEntries(architecturePlans),
              memorySnapshot: finalMemorySnapshot,
              workspace: this.canonicalWorkspace,
              integratedQA: lastIntegratedQA,
              totalAttempts: totalAttemptsCount,
              totalTokens,
              totalCostUsd,
              summary: failSummary,
              startedAt,
              completedAt: new Date().toISOString(),
              error: `INTEGRATED_VERIFICATION_FAILED: ${integratedError}`,
            };
          }

          // Combined workspace PASSED integrated QA gate and FINAL_COMMIT_GUARD!
          updateStatus("COMPLETED");
          this.emit(
            {
              missionId,
              type: "MISSION_COMPLETED",
              title: plan.title,
              message: `ORCHESTRATOR completed all ${plan.tasks.length} tasks and PASSED Real Integrated QA Gate across combined CanonicalWorkspace.`,
            },
            callback,
            { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
          );

          return {
            missionId,
            status: "COMPLETED",
            plan,
            taskResults: Object.fromEntries(taskStates),
            architecturePlans: Object.fromEntries(architecturePlans),
            memorySnapshot: finalMemorySnapshot,
            workspace: this.canonicalWorkspace,
            integratedQA: lastIntegratedQA,
            totalAttempts: totalAttemptsCount,
            totalTokens,
            totalCostUsd,
            summary: `Successfully completed mission "${plan.title}" across ${plan.tasks.length} tasks and verified combined canonical workspace.`,
            startedAt,
            completedAt: new Date().toISOString(),
          };
        }
      }

      // Dispatch up to availableSlots.length tasks
      if (availableSlots.length > 0 && !isDraining && !internalAbortController.signal.aborted) {
        const readyTasks = this.selectReadyTasks(
          taskStates,
          availableSlots.length,
          failurePolicy
        );

        for (const readyState of readyTasks) {
          const slotId = availableSlots.shift()!;
          const taskId = readyState.task.id;

          updateStatus("EXECUTING");

          // Create wrapper promise that frees slot upon completion
          const workerPromise = (async () => {
            try {
              await executeTaskInSlot(readyState, slotId);
            } finally {
              availableSlots.push(slotId);
              availableSlots.sort((a, b) => a - b);
              activeWorkers.delete(taskId);
            }
          })();

          activeWorkers.set(taskId, {
            slotId,
            taskId,
            role: readyState.task.assignedRole,
            promise: workerPromise,
          });
        }
      }

      // Check Deadlock
      if (this.isDeadlocked(taskStates, activeWorkers.size)) {
        await drainAllWorkers();
        updateStatus("FAILED");
        const deadlockMsg =
          "DEADLOCK_DETECTED: Remaining tasks cannot be satisfied by current dependency graph.";
        this.emit(
          {
            missionId,
            type: "MISSION_FAILED",
            title: plan.title,
            message: deadlockMsg,
          },
          callback,
          { seq: getNextSeq(), activeTaskCount: 0, concurrencyLimit: maxConcurrentTasks }
        );

        const memorySnapshot = await this.memoryStore.snapshot(missionId);
        return {
          missionId,
          status: "FAILED",
          plan,
          taskResults: Object.fromEntries(taskStates),
          architecturePlans: Object.fromEntries(architecturePlans),
          memorySnapshot,
          workspace: this.canonicalWorkspace,
          integratedQA: lastIntegratedQA,
          totalAttempts: totalAttemptsCount,
          totalTokens,
          totalCostUsd,
          summary: "Mission deadlocked: unsatisfied dependencies.",
          startedAt,
          completedAt: new Date().toISOString(),
          error: deadlockMsg,
        };
      }

      // Wait for any active worker to complete if workers are running
      if (activeWorkers.size > 0) {
        await Promise.race(
          Array.from(activeWorkers.values()).map((w) => w.promise)
        );
      } else {
        // Yield execution tick to avoid spinning
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }
  } finally {
    if (deadlineTimer) {
      clearTimeout(deadlineTimer);
    }
    await drainAllWorkers();
  }
  }
}

