// Comprehensive Unit & Integration Tests for LEGION Phase 08 — Parallel DAG Execution
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LegionOrchestrator, MissionExecutionStatus } from "./orchestrator";
import { CommanderAgent, MissionPlan, PlannedTask } from "./commander-agent";
import { BuilderAgent } from "./builder-agent";
import { SentinelAgent } from "./sentinel-agent";
import { ArchitectAgent } from "./architect-agent";
import { MockLLMProvider } from "../providers/llm";
import { MockSandboxProvider } from "../providers/sandbox";

describe("LegionOrchestrator (Phase 08 — Parallel DAG Execution & Concurrency)", () => {
  let mockSandbox: MockSandboxProvider;
  let mockCommanderLLM: MockLLMProvider;
  let mockArchitectLLM: MockLLMProvider;
  let mockBuilderLLM: MockLLMProvider;
  let mockSentinelLLM: MockLLMProvider;

  let commander: CommanderAgent;
  let architect: ArchitectAgent;
  let builder: BuilderAgent;
  let sentinel: SentinelAgent;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockSandbox = new MockSandboxProvider();
    mockCommanderLLM = new MockLLMProvider();
    mockArchitectLLM = new MockLLMProvider();
    mockBuilderLLM = new MockLLMProvider();
    mockSentinelLLM = new MockLLMProvider();

    commander = new CommanderAgent({ llm: mockCommanderLLM });
    architect = new ArchitectAgent({ llm: mockArchitectLLM });
    builder = new BuilderAgent({ sandbox: mockSandbox, llm: mockBuilderLLM });
    sentinel = new SentinelAgent({ llm: mockSentinelLLM });
  });

  function makeMockPlan(tasks: PlannedTask[]): MissionPlan {
    return {
      missionId: "mission-parallel-test",
      title: "Parallel Test Mission",
      summary: "Mission for parallel DAG tests",
      requirements: ["Requirement 1"],
      constraints: [],
      estimatedComplexity: "MEDIUM",
      tasks,
      createdAt: new Date().toISOString(),
    };
  }

  // Helper to setup mock approvals
  function setupStandardMocks(plan: MissionPlan) {
    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    vi.spyOn(architect, "design").mockImplementation(async (opts) => ({
      missionId: plan.missionId,
      taskId: opts.taskId || "task-arch",
      status: "SUCCESS",
      plan: {
        taskId: opts.taskId || "task-arch",
        summary: `Blueprint for ${opts.taskId}`,
        approach: "Modular design",
        components: [{ name: "Comp", purpose: "Test", responsibilities: ["Test"] }],
        interfaces: [{ name: "IComp", description: "Interface", definition: "interface IComp {}" }],
        dependencies: [],
        risks: [],
        constraints: [],
        implementationSteps: ["Step 1"],
        validationStrategy: "Unit test",
        createdAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 20, completion: 20, total: 40 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    }));

    vi.spyOn(builder, "run").mockImplementation(async (opts) => ({
      missionId: plan.missionId,
      taskId: opts.taskId,
      status: "SUCCESS",
      finalResponse: `Task ${opts.taskId} complete`,
      iterations: 1,
      totalTokens: { prompt: 30, completion: 30, total: 60 },
      totalCostUsd: 0.0001,
      durationMs: 15,
      steps: [],
      evidence: {
        commands: [{ command: "node test.js", stdout: "PASS", stderr: "", exitCode: 0, durationMs: 5, timestamp: new Date().toISOString() }],
        stdout: "PASS",
        stderr: "",
        exitCode: 0,
        testResults: [{ name: "test", passed: true }],
        modifiedFiles: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED" }],
        patch: undefined,
        sandboxId: opts.sandboxId,
        timestamps: { startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
      },
      patch: {
        id: `patch-${opts.taskId || "task"}`,
        taskId: opts.taskId || "task-1",
        missionId: plan.missionId,
        baseRevision: opts.baselineSnapshot?.baseRevision ?? 0,
        files: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED", content: "// code" }],
        createdAt: new Date().toISOString(),
        authorRole: "BUILDER",
        summary: `Implemented ${opts.taskId}`,
      },
    }));

    vi.spyOn(sentinel, "review").mockImplementation(async (opts) => ({
      missionId: plan.missionId,
      status: "SUCCESS",
      review: {
        taskId: opts.task.id,
        decision: "APPROVED",
        summary: `Task ${opts.task.id} verified`,
        criteriaResults: [{ criterion: "OK", status: "PASS", evidence: "Logs", reason: "Passed" }],
        issues: [],
        recommendations: [],
        confidence: 1.0,
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 20, completion: 20, total: 40 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    }));
  }

  // 1. maxConcurrentTasks = 1 mantém comportamento sequencial
  it("maintains sequential execution when maxConcurrentTasks = 1", async () => {
    const plan = makeMockPlan([
      {
        id: "task-1",
        order: 1,
        title: "Task 1",
        description: "Task 1",
        assignedRole: "BUILDER",
        priority: "HIGH",
        status: "READY",
        dependencies: [],
        requiredCapabilities: [],
        successCriteria: ["OK"],
      },
      {
        id: "task-2",
        order: 2,
        title: "Task 2",
        description: "Task 2",
        assignedRole: "BUILDER",
        priority: "HIGH",
        status: "READY",
        dependencies: [],
        requiredCapabilities: [],
        successCriteria: ["OK"],
      },
    ]);

    setupStandardMocks(plan);

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      maxConcurrentTasks: 1,
    });

    const executionLog: string[] = [];
    const result = await orchestrator.run({
      missionPrompt: "Sequential test",
      sandboxId: "sbx-1",
      maxConcurrentTasks: 1,
      onEvent: (e) => {
        if (e.type === "TASK_STARTED" || e.type === "TASK_COMPLETED") {
          executionLog.push(`${e.type}:${(e as any).taskId}`);
        }
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(executionLog).toEqual([
      "TASK_STARTED:task-1",
      "TASK_COMPLETED:task-1",
      "TASK_STARTED:task-2",
      "TASK_COMPLETED:task-2",
    ]);
  });

  // 2. Duas tasks independentes executam simultaneamente
  it("executes two independent tasks concurrently when slots are available", async () => {
    const plan = makeMockPlan([
      {
        id: "task-a",
        order: 1,
        title: "Task A",
        description: "Independent A",
        assignedRole: "BUILDER",
        priority: "HIGH",
        status: "READY",
        dependencies: [],
        requiredCapabilities: [],
        successCriteria: ["A ok"],
      },
      {
        id: "task-b",
        order: 2,
        title: "Task B",
        description: "Independent B",
        assignedRole: "BUILDER",
        priority: "HIGH",
        status: "READY",
        dependencies: [],
        requiredCapabilities: [],
        successCriteria: ["B ok"],
      },
    ]);

    setupStandardMocks(plan);

    const runningAtOnce: number[] = [];
    let currentRunning = 0;

    vi.spyOn(builder, "run").mockImplementation(async (opts) => {
      currentRunning++;
      runningAtOnce.push(currentRunning);
      await new Promise((r) => setTimeout(r, 20));
      currentRunning--;
      return {
        missionId: plan.missionId,
        taskId: opts.taskId,
        status: "SUCCESS",
        finalResponse: "done",
        iterations: 1,
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.0001,
        durationMs: 20,
        steps: [],
        evidence: {
          commands: [{ command: "node test.js", stdout: "PASS", stderr: "", exitCode: 0, durationMs: 5, timestamp: new Date().toISOString() }],
          stdout: "PASS",
          stderr: "",
          exitCode: 0,
          testResults: [{ name: "test", passed: true }],
          modifiedFiles: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED" }],
          patch: undefined,
          sandboxId: opts.sandboxId,
          timestamps: { startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
        },
        patch: {
          id: `patch-${opts.taskId || "task"}`,
          taskId: opts.taskId || "task-1",
          missionId: plan.missionId,
          baseRevision: opts.baselineSnapshot?.baseRevision ?? 0,
          files: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED", content: "// code" }],
          createdAt: new Date().toISOString(),
          authorRole: "BUILDER",
          summary: `Implemented ${opts.taskId}`,
        },
      };
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      maxConcurrentTasks: 2,
    });

    const result = await orchestrator.run({
      missionPrompt: "Parallel test",
      sandboxId: "sbx-1",
      maxConcurrentTasks: 2,
    });

    expect(result.status).toBe("COMPLETED");
    expect(Math.max(...runningAtOnce)).toBe(2);
  });

  // 3. Dependência impede execução prematura
  it("enforces DAG dependency order so dependent tasks wait for dependencies to complete", async () => {
    const plan = makeMockPlan([
      {
        id: "task-1",
        order: 1,
        title: "Base Task",
        description: "Must run first",
        assignedRole: "BUILDER",
        priority: "HIGH",
        status: "READY",
        dependencies: [],
        requiredCapabilities: [],
        successCriteria: ["1 ok"],
      },
      {
        id: "task-2",
        order: 2,
        title: "Dependent Task",
        description: "Must run after task 1",
        assignedRole: "BUILDER",
        priority: "HIGH",
        status: "BACKLOG",
        dependencies: ["task-1"],
        requiredCapabilities: [],
        successCriteria: ["2 ok"],
      },
    ]);

    setupStandardMocks(plan);

    const startedOrder: string[] = [];
    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      maxConcurrentTasks: 2,
    });

    const result = await orchestrator.run({
      missionPrompt: "Dependency test",
      sandboxId: "sbx-1",
      onEvent: (e) => {
        if (e.type === "TASK_STARTED") {
          startedOrder.push((e as any).taskId);
        }
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(startedOrder).toEqual(["task-1", "task-2"]);
  });

  // 4. Três READY com limite 2
  it("throttles 3 READY tasks to concurrency limit 2 and starts the 3rd as a slot frees", async () => {
    const plan = makeMockPlan([
      { id: "t1", order: 1, title: "T1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "t2", order: 2, title: "T2", description: "T2", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "t3", order: 3, title: "T3", description: "T3", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    let maxSimultaneous = 0;
    let currentActive = 0;

    vi.spyOn(builder, "run").mockImplementation(async (opts) => {
      currentActive++;
      maxSimultaneous = Math.max(maxSimultaneous, currentActive);
      await new Promise((r) => setTimeout(r, 15));
      currentActive--;
      return {
        missionId: plan.missionId,
        taskId: opts.taskId,
        status: "SUCCESS",
        finalResponse: "done",
        iterations: 1,
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.0001,
        durationMs: 15,
        steps: [],
        evidence: {
          commands: [{ command: "node test.js", stdout: "PASS", stderr: "", exitCode: 0, durationMs: 5, timestamp: new Date().toISOString() }],
          stdout: "PASS",
          stderr: "",
          exitCode: 0,
          testResults: [{ name: "test", passed: true }],
          modifiedFiles: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED" }],
          patch: undefined,
          sandboxId: opts.sandboxId,
          timestamps: { startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
        },
        patch: {
          id: `patch-${opts.taskId || "task"}`,
          taskId: opts.taskId || "task-1",
          missionId: plan.missionId,
          baseRevision: opts.baselineSnapshot?.baseRevision ?? 0,
          files: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED", content: "// code" }],
          createdAt: new Date().toISOString(),
          authorRole: "BUILDER",
          summary: `Implemented ${opts.taskId}`,
        },
      };
    });

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({ missionPrompt: "Throttle test", sandboxId: "sbx-1", maxConcurrentTasks: 2 });

    expect(result.status).toBe("COMPLETED");
    expect(maxSimultaneous).toBe(2);
    expect(Object.keys(result.taskResults)).toHaveLength(3);
  });

  // 5. Prioridade respeitada na seleção dos slots
  it("prioritizes CRITICAL and HIGH priority tasks before MEDIUM or LOW", async () => {
    const plan = makeMockPlan([
      { id: "low-task", order: 1, title: "Low", description: "L", assignedRole: "BUILDER", priority: "LOW", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "crit-task", order: 2, title: "Crit", description: "C", assignedRole: "BUILDER", priority: "CRITICAL", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const started: string[] = [];
    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 1 });

    const result = await orchestrator.run({
      missionPrompt: "Priority test",
      sandboxId: "sbx-1",
      maxConcurrentTasks: 1,
      onEvent: (e) => {
        if (e.type === "TASK_STARTED") started.push((e as any).taskId);
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(started[0]).toBe("crit-task");
    expect(started[1]).toBe("low-task");
  });

  // 6. Architect + Builder em paralelo
  it("executes ARCHITECT and BUILDER tasks concurrently when they have no dependencies", async () => {
    const plan = makeMockPlan([
      { id: "arch-1", order: 1, title: "Arch", description: "A", assignedRole: "ARCHITECT", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "build-1", order: 2, title: "Build", description: "B", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const orchestrator = new LegionOrchestrator({ commander, architect, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({ missionPrompt: "Arch + Build parallel", sandboxId: "sbx-1" });

    expect(result.status).toBe("COMPLETED");
    expect(result.taskResults["arch-1"].status).toBe("COMPLETED");
    expect(result.taskResults["build-1"].status).toBe("COMPLETED");
  });

  // 7. Duas Builders independentes com isolamento seguro
  it("manages sandbox lifecycle per concurrent builder task when sandboxProvider is provided", async () => {
    const plan = makeMockPlan([
      { id: "b1", order: 1, title: "B1", description: "B1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "b2", order: 2, title: "B2", description: "B2", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const createdSandboxes: string[] = [];
    const destroyedSandboxes: string[] = [];

    vi.spyOn(mockSandbox, "create").mockImplementation(async () => {
      const id = `sbx-dyn-${Math.random()}`;
      createdSandboxes.push(id);
      return { id, status: "RUNNING", createdAt: new Date().toISOString(), provider: "mock" };
    });

    vi.spyOn(mockSandbox, "destroy").mockImplementation(async (id) => {
      destroyedSandboxes.push(id);
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider: mockSandbox,
      maxConcurrentTasks: 2,
    });

    const result = await orchestrator.run({ missionPrompt: "Isolation test", sandboxId: "sbx-root", maxConcurrentTasks: 2 });

    expect(result.status).toBe("COMPLETED");
    expect(createdSandboxes.length).toBe(2);
    expect(destroyedSandboxes.length).toBe(2);
  });

  // 8. Sentinel reviews concorrentes
  it("correlates concurrent Sentinel reviews strictly by taskId", async () => {
    const plan = makeMockPlan([
      { id: "task-x", order: 1, title: "TX", description: "X", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "task-y", order: 2, title: "TY", description: "Y", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const reviewedTasks: string[] = [];
    vi.spyOn(sentinel, "review").mockImplementation(async (opts) => {
      reviewedTasks.push(opts.task.id);
      return {
        missionId: plan.missionId,
        status: "SUCCESS",
        review: {
          taskId: opts.task.id,
          decision: "APPROVED",
          summary: `Verified ${opts.task.id}`,
          criteriaResults: [],
          issues: [],
          recommendations: [],
          confidence: 1.0,
          reviewedAt: new Date().toISOString(),
        },
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.0001,
        durationMs: 10,
      };
    });

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({ missionPrompt: "Sentinel parallel", sandboxId: "sbx-1" });

    expect(result.status).toBe("COMPLETED");
    expect(reviewedTasks).toContain("task-x");
    expect(reviewedTasks).toContain("task-y");
  });

  // 9. Retry de uma task não bloqueia task independente
  it("re-queues REVISION_REQUIRED task without blocking independent tasks", async () => {
    const plan = makeMockPlan([
      { id: "retry-task", order: 1, title: "Retry Task", description: "Will fail once", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "indep-task", order: 2, title: "Independent Task", description: "Runs freely", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    let retryAttempts = 0;
    vi.spyOn(sentinel, "review").mockImplementation(async (opts) => {
      if (opts.task.id === "retry-task" && retryAttempts === 0) {
        retryAttempts++;
        return {
          missionId: plan.missionId,
          status: "SUCCESS",
          review: {
            taskId: "retry-task",
            decision: "REVISION_REQUIRED",
            summary: "Please fix bug",
            criteriaResults: [],
            issues: [{ id: "iss-1", title: "Bug", description: "Bug", severity: "HIGH" }],
            recommendations: ["Fix it"],
            confidence: 0.8,
            reviewedAt: new Date().toISOString(),
          },
          totalTokens: { prompt: 10, completion: 10, total: 20 },
          totalCostUsd: 0.0001,
          durationMs: 10,
        };
      }

      return {
        missionId: plan.missionId,
        status: "SUCCESS",
        review: {
          taskId: opts.task.id,
          decision: "APPROVED",
          summary: "Approved",
          criteriaResults: [],
          issues: [],
          recommendations: [],
          confidence: 1.0,
          reviewedAt: new Date().toISOString(),
        },
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.0001,
        durationMs: 10,
      };
    });

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({ missionPrompt: "Retry non-blocking", sandboxId: "sbx-1" });

    expect(result.status).toBe("COMPLETED");
    expect(result.taskResults["retry-task"].status).toBe("COMPLETED");
    expect(result.taskResults["retry-task"].attempts).toBe(2);
    expect(result.taskResults["indep-task"].status).toBe("COMPLETED");
  });

  // 10. FAIL_FAST Policy
  it("stops execution immediately and fails mission when FAIL_FAST is enabled and a task fails", async () => {
    const plan = makeMockPlan([
      { id: "fail-task", order: 1, title: "Fail", description: "Fails fatal", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "other-task", order: 2, title: "Other", description: "Should be aborted", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    vi.spyOn(sentinel, "review").mockImplementation(async (opts) => {
      if (opts.task.id === "fail-task") {
        return {
          missionId: plan.missionId,
          status: "SUCCESS",
          review: {
            taskId: "fail-task",
            decision: "FAILED",
            summary: "Fatal QA defect",
            criteriaResults: [],
            issues: [],
            recommendations: [],
            confidence: 1.0,
            reviewedAt: new Date().toISOString(),
          },
          totalTokens: { prompt: 10, completion: 10, total: 20 },
          totalCostUsd: 0.0001,
          durationMs: 10,
        };
      }
      return {
        missionId: plan.missionId,
        status: "SUCCESS",
        review: {
          taskId: opts.task.id,
          decision: "APPROVED",
          summary: "OK",
          criteriaResults: [],
          issues: [],
          recommendations: [],
          confidence: 1.0,
          reviewedAt: new Date().toISOString(),
        },
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.0001,
        durationMs: 10,
      };
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      maxConcurrentTasks: 2,
      failurePolicy: "FAIL_FAST",
    });

    const result = await orchestrator.run({
      missionPrompt: "Fail fast test",
      sandboxId: "sbx-1",
      failurePolicy: "FAIL_FAST",
    });

    expect(result.status).toBe("FAILED");
    expect(result.taskResults["fail-task"].status).toBe("FAILED");
  });

  // 11. CONTINUE_INDEPENDENT Policy
  it("allows independent tasks to finish and marks dependent tasks BLOCKED under CONTINUE_INDEPENDENT", async () => {
    const plan = makeMockPlan([
      { id: "fail-node", order: 1, title: "Failing Node", description: "Fails", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "dep-node", order: 2, title: "Dependent Node", description: "Depends on fail-node", assignedRole: "BUILDER", priority: "HIGH", status: "BACKLOG", dependencies: ["fail-node"], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "indep-node", order: 3, title: "Independent Node", description: "Runs to completion", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    vi.spyOn(sentinel, "review").mockImplementation(async (opts) => {
      if (opts.task.id === "fail-node") {
        return {
          missionId: plan.missionId,
          status: "SUCCESS",
          review: {
            taskId: "fail-node",
            decision: "FAILED",
            summary: "Fatal flaw",
            criteriaResults: [],
            issues: [],
            recommendations: [],
            confidence: 1.0,
            reviewedAt: new Date().toISOString(),
          },
          totalTokens: { prompt: 10, completion: 10, total: 20 },
          totalCostUsd: 0.0001,
          durationMs: 10,
        };
      }
      return {
        missionId: plan.missionId,
        status: "SUCCESS",
        review: {
          taskId: opts.task.id,
          decision: "APPROVED",
          summary: "Approved",
          criteriaResults: [],
          issues: [],
          recommendations: [],
          confidence: 1.0,
          reviewedAt: new Date().toISOString(),
        },
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.0001,
        durationMs: 10,
      };
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      maxConcurrentTasks: 2,
      failurePolicy: "CONTINUE_INDEPENDENT",
    });

    const result = await orchestrator.run({
      missionPrompt: "Continue independent test",
      sandboxId: "sbx-1",
      failurePolicy: "CONTINUE_INDEPENDENT",
    });

    expect(result.status).toBe("FAILED");
    expect(result.taskResults["fail-node"].status).toBe("FAILED");
    expect(result.taskResults["dep-node"].status).toBe("BLOCKED");
    expect(result.taskResults["indep-node"].status).toBe("COMPLETED");
  });

  // 12. Cancelamento de múltiplas tasks
  it("cancels all active workers when AbortSignal triggers", async () => {
    const plan = makeMockPlan([
      { id: "t1", order: 1, title: "T1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "t2", order: 2, title: "T2", description: "T2", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const controller = new AbortController();
    controller.abort();

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({
      missionPrompt: "Abort parallel",
      sandboxId: "sbx-1",
      signal: controller.signal,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.error).toContain("CANCELLED");
  });

  // 13. Monotonic seq de eventos
  it("emits events with strictly increasing monotonic seq numbers", async () => {
    const plan = makeMockPlan([
      { id: "t1", order: 1, title: "T1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "t2", order: 2, title: "T2", description: "T2", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const seqNumbers: number[] = [];
    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });

    const result = await orchestrator.run({
      missionPrompt: "Monotonic seq test",
      sandboxId: "sbx-1",
      onEvent: (e) => {
        if (typeof (e as any).seq === "number") {
          seqNumbers.push((e as any).seq);
        }
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(seqNumbers.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < seqNumbers.length; i++) {
      expect(seqNumbers[i]).toBeGreaterThan(seqNumbers[i - 1]);
    }
  });

  // 14. Eventos possuem slotId e taskId corretos
  it("attaches correct taskId and slotId to parallel task events", async () => {
    const plan = makeMockPlan([
      { id: "slot-task-1", order: 1, title: "S1", description: "S1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const slotEvents: Array<{ taskId?: string; slotId?: number }> = [];
    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });

    const result = await orchestrator.run({
      missionPrompt: "Slot id test",
      sandboxId: "sbx-1",
      onEvent: (e) => {
        if (e.type === "TASK_STARTED" || e.type === "TASK_COMPLETED") {
          slotEvents.push({ taskId: (e as any).taskId, slotId: (e as any).slotId });
        }
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(slotEvents[0].taskId).toBe("slot-task-1");
    expect(typeof slotEvents[0].slotId).toBe("number");
  });

  // 15. Deadlock detection NÃO dispara com tasks RUNNING
  it("does not prematurely declare deadlock while tasks are currently running", async () => {
    const plan = makeMockPlan([
      { id: "parent", order: 1, title: "P", description: "P", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "child", order: 2, title: "C", description: "C", assignedRole: "BUILDER", priority: "HIGH", status: "BACKLOG", dependencies: ["parent"], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    vi.spyOn(builder, "run").mockImplementation(async (opts) => {
      await new Promise((r) => setTimeout(r, 20));
      return {
        missionId: plan.missionId,
        taskId: opts.taskId,
        status: "SUCCESS",
        finalResponse: "OK",
        iterations: 1,
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.0001,
        durationMs: 20,
        steps: [],
        evidence: {
          commands: [{ command: "node test.js", stdout: "PASS", stderr: "", exitCode: 0, durationMs: 5, timestamp: new Date().toISOString() }],
          stdout: "PASS",
          stderr: "",
          exitCode: 0,
          testResults: [{ name: "test", passed: true }],
          modifiedFiles: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED" }],
          patch: undefined,
          sandboxId: opts.sandboxId,
          timestamps: { startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
        },
        patch: {
          id: `patch-${opts.taskId || "task"}`,
          taskId: opts.taskId || "task-1",
          missionId: plan.missionId,
          baseRevision: opts.baselineSnapshot?.baseRevision ?? 0,
          files: [{ path: `src/${opts.taskId || "task"}.ts`, type: "ADDED", content: "// code" }],
          createdAt: new Date().toISOString(),
          authorRole: "BUILDER",
          summary: `Implemented ${opts.taskId}`,
        },
      };
    });

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({ missionPrompt: "No false deadlock", sandboxId: "sbx-1" });

    expect(result.status).toBe("COMPLETED");
  });

  // 16. Deadlock real detectado
  it("detects real deadlock when circular or unsatisfied dependencies prevent progress", async () => {
    const plan = makeMockPlan([
      { id: "deadlock-a", order: 1, title: "A", description: "A", assignedRole: "BUILDER", priority: "HIGH", status: "BACKLOG", dependencies: ["deadlock-b"], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "deadlock-b", order: 2, title: "B", description: "B", assignedRole: "BUILDER", priority: "HIGH", status: "BACKLOG", dependencies: ["deadlock-a"], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({ missionPrompt: "Real deadlock", sandboxId: "sbx-1" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("DEADLOCK_DETECTED");
  });

  // 17. Race condition resilience
  it("prevents race conditions when multiple tasks complete simultaneously", async () => {
    const plan = makeMockPlan([
      { id: "race-1", order: 1, title: "R1", description: "R1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "race-2", order: 2, title: "R2", description: "R2", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "race-3", order: 3, title: "R3", description: "R3", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "race-4", order: 4, title: "R4", description: "R4", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel, maxConcurrentTasks: 4 });
    const result = await orchestrator.run({ missionPrompt: "Race test", sandboxId: "sbx-1", maxConcurrentTasks: 4 });

    expect(result.status).toBe("COMPLETED");
    expect(Object.keys(result.taskResults)).toHaveLength(4);
    for (const key of Object.keys(result.taskResults)) {
      expect(result.taskResults[key].status).toBe("COMPLETED");
    }
  });

  // 18. Mission completed after all tasks complete
  it("marks mission COMPLETED after all tasks finish successfully", async () => {
    const plan = makeMockPlan([
      { id: "final-1", order: 1, title: "F1", description: "F1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel });
    const result = await orchestrator.run({ missionPrompt: "Final completion", sandboxId: "sbx-1" });

    expect(result.status).toBe("COMPLETED");
    expect(result.completedAt).toBeDefined();
    expect(result.summary).toContain("Successfully completed mission");
  });

  // 19. Mission failed properly on planning error
  it("fails the mission when Commander plan fails", async () => {
    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: "mission-fail-planning",
      status: "FAILED",
      error: "LLM rate limit reached",
      totalTokens: { prompt: 10, completion: 0, total: 10 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    const orchestrator = new LegionOrchestrator({ commander, builder, sentinel });
    const result = await orchestrator.run({ missionPrompt: "Plan fail test", sandboxId: "sbx-1" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("LLM rate limit reached");
  });

  // 20. Architect failure in parallel execution
  it("fails the mission when an independent Architect task fails under FAIL_FAST", async () => {
    const plan = makeMockPlan([
      { id: "arch-fail", order: 1, title: "Arch Fail", description: "AF", assignedRole: "ARCHITECT", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      { id: "build-ok", order: 2, title: "Build OK", description: "B", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
    ]);

    setupStandardMocks(plan);

    vi.spyOn(architect, "design").mockResolvedValue({
      missionId: plan.missionId,
      taskId: "arch-fail",
      status: "FAILED",
      error: "Architect blueprint parsing error",
      totalTokens: { prompt: 10, completion: 0, total: 10 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    const orchestrator = new LegionOrchestrator({ commander, architect, builder, sentinel, maxConcurrentTasks: 2 });
    const result = await orchestrator.run({ missionPrompt: "Architect parallel fail", sandboxId: "sbx-1" });

    expect(result.status).toBe("FAILED");
    expect(result.taskResults["arch-fail"].status).toBe("FAILED");
  });
});
