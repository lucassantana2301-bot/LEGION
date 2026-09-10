// LEGION Phase 09.7 — Real Integrated Workspace Verification Tests
// Covers: Full Canonical Project, Complete Workspace Materialization, Validation Plan Detection,
// False Failure Prevention, Combined TypeScript/Test Regression Detection, and Real Execution Evidence.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InMemoryCanonicalWorkspace,
  CanonicalWorkspaceMaterializer,
  detectValidationPlan,
  executeIntegratedQA,
  TaskPatch,
  ProjectBaseline,
} from "./index";
import { LegionOrchestrator } from "../agent/orchestrator";
import { CommanderAgent, MissionPlan } from "../agent/commander-agent";
import { BuilderAgent } from "../agent/builder-agent";
import { SentinelAgent } from "../agent/sentinel-agent";
import { MockLLMProvider } from "../providers/llm";
import { MockSandboxProvider } from "../providers/sandbox";

describe("Phase 09.7 — Real Integrated Workspace QA Gate", () => {
  let sandboxProvider: MockSandboxProvider;
  let workspace: InMemoryCanonicalWorkspace;

  beforeEach(() => {
    sandboxProvider = new MockSandboxProvider();
    workspace = new InMemoryCanonicalWorkspace("mission-qa-097");
  });

  // =========================================================================
  // 1. FULL PROJECT BASELINE & MATERIALIZATION
  // =========================================================================

  it("materializes full project baseline including configs, nested files, and package metadata", async () => {
    const baseline: ProjectBaseline = {
      missionId: "mission-qa-097",
      revision: 0,
      files: {
        "package.json": JSON.stringify({ name: "my-app", version: "1.0.0", scripts: { test: "vitest run" } }, null, 2),
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }, null, 2),
        "src/index.ts": "export const app = 'ready';",
        "src/utils/math.ts": "export function add(a: number, b: number) { return a + b; }",
        "tests/math.test.ts": "import { add } from '../src/utils/math'; test('add', () => expect(add(1, 2)).toBe(3));",
      },
    };

    workspace.setBaseline(baseline);

    const sbx = await sandboxProvider.create();
    const report = await CanonicalWorkspaceMaterializer.materialize(workspace, sandboxProvider, sbx.id);

    expect(report.totalFilesWritten).toBe(5);
    expect(report.files).toContain("package.json");
    expect(report.files).toContain("tsconfig.json");
    expect(report.files).toContain("src/utils/math.ts");

    // Verify sandbox filesystem has exact content
    const indexContent = await sandboxProvider.readFile(sbx.id, "src/index.ts");
    expect(indexContent).toBe("export const app = 'ready';");

    const mathContent = await sandboxProvider.readFile(sbx.id, "src/utils/math.ts");
    expect(mathContent).toContain("export function add");
  });

  it("materializes incremental patches (ADDED, MODIFIED, DELETED) on top of baseline", async () => {
    workspace.setBaseline({
      missionId: "mission-qa-097",
      revision: 0,
      files: {
        "src/core.ts": "export const v = 1;",
        "src/obsolete.ts": "export const old = true;",
      },
    });

    const patch: TaskPatch = {
      id: "patch-1",
      taskId: "task-1",
      missionId: "mission-qa-097",
      baseRevision: 0,
      files: [
        { path: "src/core.ts", type: "MODIFIED", previousContent: "export const v = 1;", content: "export const v = 2;" },
        { path: "src/feature.ts", type: "ADDED", content: "export const feat = true;" },
        { path: "src/obsolete.ts", type: "DELETED" },
      ],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    };

    workspace.integratePatch(patch);

    const sbx = await sandboxProvider.create();
    const report = await CanonicalWorkspaceMaterializer.materialize(workspace, sandboxProvider, sbx.id);

    expect(report.totalFilesWritten).toBe(2);
    expect(report.files).toContain("src/core.ts");
    expect(report.files).toContain("src/feature.ts");
    expect(report.deletedFiles).toContain("src/obsolete.ts");

    const allFiles = workspace.getAllFiles();
    expect(allFiles["src/core.ts"]).toBe("export const v = 2;");
    expect(allFiles["src/feature.ts"]).toBe("export const feat = true;");
    expect(allFiles["src/obsolete.ts"]).toBeUndefined();
  });

  // =========================================================================
  // 2. VALIDATION PLAN DETECTION & FALSE FAILURE PREVENTION
  // =========================================================================

  it("detects tsc, npm test, and npm run build from valid Node/TypeScript project", () => {
    const files = {
      "package.json": JSON.stringify({
        name: "test-pkg",
        scripts: {
          test: "vitest run",
          build: "next build",
        },
      }),
      "tsconfig.json": "{}",
      "src/main.ts": "export const x = 1;",
    };

    const plan = detectValidationPlan(files);
    const cmdNames = plan.commands.map((c) => c.command);

    expect(cmdNames).toContain("npx tsc --noEmit");
    expect(cmdNames).toContain("npm test");
    expect(cmdNames).toContain("npm run build");
    expect(plan.projectMetadata.hasPackageJson).toBe(true);
    expect(plan.projectMetadata.hasTsConfig).toBe(true);
  });

  it("prevents false failure: ignores dummy npm test placeholder script", () => {
    const files = {
      "package.json": JSON.stringify({
        name: "dummy-test-pkg",
        scripts: {
          test: 'echo "Error: no test specified" && exit 1',
        },
      }),
      "src/index.js": "console.log('hello');",
    };

    const plan = detectValidationPlan(files);
    const cmdNames = plan.commands.map((c) => c.command);

    // Dummy test MUST NOT be added to validation plan
    expect(cmdNames).not.toContain("npm test");
  });

  it("prevents false failure: does not blindly run tsc or npm test on plain HTML/JS project", () => {
    const files = {
      "index.html": "<!DOCTYPE html><html><body><h1>Hello</h1></body></html>",
      "style.css": "body { background: #000; }",
      "app.js": "console.log('web app');",
    };

    const plan = detectValidationPlan(files);
    expect(plan.commands.length).toBe(0);
    expect(plan.reason).toContain("No automated verification scripts detected");
  });

  it("detects pytest validation for Python projects", () => {
    const files = {
      "requirements.txt": "pytest>=7.0.0",
      "pytest.ini": "[pytest]\npython_files = tests.py test_*.py",
      "src/app.py": "def main(): return True",
      "tests/test_app.py": "from src.app import main\ndef test_main(): assert main() is True",
    };

    const plan = detectValidationPlan(files);
    const cmdNames = plan.commands.map((c) => c.command);
    expect(cmdNames).toContain("pytest");
  });

  // =========================================================================
  // 3. REAL COMBINED TYPESCRIPT & TEST REGRESSION DETECTION
  // =========================================================================

  it("detects combined TypeScript regression: Task A + Task B break typecheck in combined workspace", async () => {
    // Baseline: module A exports add(number, number), module B imports and calls it
    workspace.setBaseline({
      missionId: "mission-qa-097",
      revision: 0,
      files: {
        "package.json": JSON.stringify({ name: "app", scripts: { build: "tsc" } }),
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
        "src/a.ts": "export function calculate(val: number): number { return val * 2; }",
        "src/b.ts": "import { calculate } from './a'; export const result = calculate(10);",
      },
    });

    // Task A: Changes calculate parameter to string (alone passes its isolated tests if updated)
    const patchA: TaskPatch = {
      id: "patch-A",
      taskId: "task-A",
      missionId: "mission-qa-097",
      baseRevision: 0,
      files: [
        {
          path: "src/a.ts",
          type: "MODIFIED",
          previousContent: "export function calculate(val: number): number { return val * 2; }",
          content: "export function calculate(val: string): string { return val.toUpperCase(); }",
        },
      ],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    };

    // Task B: Updates calculation consumer to calculate(99) (alone was written expecting number)
    const patchB: TaskPatch = {
      id: "patch-B",
      taskId: "task-B",
      missionId: "mission-qa-097",
      baseRevision: 0,
      files: [
        {
          path: "src/b.ts",
          type: "MODIFIED",
          previousContent: "import { calculate } from './a'; export const result = calculate(10);",
          content: "import { calculate } from './a'; export const result = calculate(99);",
        },
      ],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    };

    // Both patches integrated into CanonicalWorkspace
    workspace.integratePatch(patchA);
    workspace.integratePatch(patchB);

    const sbx = await sandboxProvider.create();

    // Mock realistic compiler failure when 'npx tsc --noEmit' runs against the combined files
    vi.spyOn(sandboxProvider, "execute").mockImplementation(async (sbxId, cmd) => {
      if (cmd.includes("tsc")) {
        const fileA = await sandboxProvider.readFile(sbxId, "src/a.ts");
        const fileB = await sandboxProvider.readFile(sbxId, "src/b.ts");
        // If a.ts expects string and b.ts passes 99, fail typecheck!
        if (fileA.includes("val: string") && fileB.includes("calculate(99)")) {
          return {
            exitCode: 2,
            stdout: "",
            stderr: "src/b.ts(1,48): error TS2345: Argument of type 'number' is not assignable to parameter of type 'string'.",
            durationMs: 45,
          };
        }
      }
      return { exitCode: 0, stdout: "PASS", stderr: "", durationMs: 10 };
    });

    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider,
      sandboxId: sbx.id,
    });

    expect(qaResult.success).toBe(false);
    expect(qaResult.error).toContain("error TS2345");
    expect(qaResult.evidence.exitCode).toBe(2);
    expect(qaResult.evidence.commands.length).toBeGreaterThan(0);
    expect(qaResult.evidence.commands[0].command).toBe("npx tsc --noEmit");
  });

  // =========================================================================
  // 4. FULL ORCHESTRATOR INTEGRATION & MISSION COMPLETION GATE
  // =========================================================================

  it("orchestrator blocks MISSION_COMPLETED when combined workspace fails integrated QA", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: sandboxProvider, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-fail-gate",
      title: "Combined Gate Failure",
      summary: "Test gate",
      requirements: [],
      constraints: [],
      tasks: [
        { id: "t1", order: 1, title: "Task 1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    // Builder produces patch with tsconfig and failing TypeScript
    vi.spyOn(builder, "run").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      finalResponse: "Built",
      iterations: 1,
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
      steps: [],
      evidence: {
        commands: [{ command: "node test.js", stdout: "PASS", stderr: "", exitCode: 0, timestamp: new Date().toISOString() }],
        stdout: "PASS",
        stderr: "",
        exitCode: 0,
        modifiedFiles: [{ path: "src/broken.ts", type: "ADDED" }],
        sandboxId: "sbx-1",
        timestamps: { startedAt: "", completedAt: "" },
      },
      patch: {
        id: "patch-broken",
        taskId: "t1",
        missionId: plan.missionId,
        baseRevision: 0,
        files: [
          { path: "tsconfig.json", type: "ADDED", content: "{}" },
          { path: "src/broken.ts", type: "ADDED", content: "const x: number = 'not a number';" },
        ],
        createdAt: new Date().toISOString(),
        authorRole: "BUILDER",
      },
    });

    // Sentinel approves isolated task review
    vi.spyOn(sentinel, "review").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      review: {
        taskId: "t1",
        decision: "APPROVED",
        summary: "Isolated review approved",
        criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "node test.js", reason: "ok" }],
        issues: [],
        recommendations: [],
        confidence: 1.0,
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    // Sandbox execution fails on tsc
    vi.spyOn(sandboxProvider, "execute").mockImplementation(async (_id, cmd) => {
      if (cmd.includes("tsc")) {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "src/broken.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.",
          durationMs: 30,
        };
      }
      return { exitCode: 0, stdout: "ok", stderr: "", durationMs: 10 };
    });

    const emittedEvents: string[] = [];

    const orch = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider,
      canonicalWorkspace: workspace,
    });

    const result = await orch.run({
      missionPrompt: "Test integrated QA failure gate",
      sandboxId: "sbx-master",
      onEvent: (evt) => {
        emittedEvents.push(evt.type);
      },
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("INTEGRATED_VERIFICATION_FAILED");
    expect(emittedEvents).not.toContain("MISSION_COMPLETED");
    expect(emittedEvents).toContain("MISSION_FAILED");
  });

  it("orchestrator allows MISSION_COMPLETED when full combined workspace passes integrated QA", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: sandboxProvider, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-success-gate",
      title: "Combined Gate Success",
      summary: "Test success",
      requirements: [],
      constraints: [],
      tasks: [
        { id: "t-valid", order: 1, title: "Valid Task", description: "TV", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    vi.spyOn(builder, "run").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      finalResponse: "Valid implementation",
      iterations: 1,
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
      steps: [],
      evidence: {
        commands: [{ command: "npm test", stdout: "PASS", stderr: "", exitCode: 0, timestamp: new Date().toISOString() }],
        stdout: "PASS",
        stderr: "",
        exitCode: 0,
        modifiedFiles: [{ path: "src/valid.ts", type: "ADDED" }],
        sandboxId: "sbx-1",
        timestamps: { startedAt: "", completedAt: "" },
      },
      patch: {
        id: "patch-valid",
        taskId: "t-valid",
        missionId: plan.missionId,
        baseRevision: 0,
        files: [
          { path: "package.json", type: "ADDED", content: JSON.stringify({ name: "ok", scripts: { test: "vitest run" } }) },
          { path: "tsconfig.json", type: "ADDED", content: "{}" },
          { path: "src/valid.ts", type: "ADDED", content: "export const ok: boolean = true;" },
        ],
        createdAt: new Date().toISOString(),
        authorRole: "BUILDER",
      },
    });

    vi.spyOn(sentinel, "review").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      review: {
        taskId: "t-valid",
        decision: "APPROVED",
        summary: "Valid",
        criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "npm test", reason: "ok" }],
        issues: [],
        recommendations: [],
        confidence: 1.0,
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    // Sandbox execution returns 0 for all commands
    vi.spyOn(sandboxProvider, "execute").mockResolvedValue({
      exitCode: 0,
      stdout: "TypeScript check PASS\nTests PASS (5/5)",
      stderr: "",
      durationMs: 50,
    });

    const emittedEvents: string[] = [];

    const orch = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider,
      canonicalWorkspace: workspace,
    });

    const result = await orch.run({
      missionPrompt: "Test integrated QA success gate",
      sandboxId: "sbx-master",
      onEvent: (evt) => {
        emittedEvents.push(evt.type);
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(emittedEvents).toContain("MISSION_COMPLETED");
    expect(emittedEvents).not.toContain("MISSION_FAILED");
  });

  // =========================================================================
  // 5. ADVERSARIAL REGRESSION: MULTI-TASK A + B SUCCEED IN ISOLATION BUT FAIL COMBINED
  // =========================================================================

  it("ADVERSARIAL REGRESSION: Task A (PASS) + Task B (PASS) -> Combined Integrated QA fails -> Blocks MISSION_COMPLETED", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: sandboxProvider, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-adversarial-ab",
      title: "Adversarial Multi-Task Mission",
      summary: "Task A augments AppContext with auth object, Task B augments AppContext with auth string; both pass alone but break TypeScript when combined",
      requirements: ["Module A update", "Module B update"],
      constraints: [],
      tasks: [
        {
          id: "task-A",
          order: 1,
          title: "Add Module A Authentication",
          description: "Augment AppContext with auth token object",
          assignedRole: "BUILDER",
          priority: "HIGH",
          status: "READY",
          dependencies: [],
          requiredCapabilities: ["typescript"],
          successCriteria: ["Module A exports handleA"],
        },
        {
          id: "task-B",
          order: 2,
          title: "Add Module B Auth Status",
          description: "Augment AppContext with auth status string",
          assignedRole: "BUILDER",
          priority: "HIGH",
          status: "READY",
          dependencies: [],
          requiredCapabilities: ["typescript"],
          successCriteria: ["Module B exports handleB"],
        },
      ],
      estimatedComplexity: "MEDIUM",
      createdAt: new Date().toISOString(),
    };

    // Baseline project in canonical workspace
    workspace.setBaseline({
      missionId: "mission-adversarial-ab",
      revision: 0,
      files: {
        "package.json": JSON.stringify({ name: "app", scripts: { test: "vitest run" } }),
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
        "src/context.ts": "export interface AppContext { version: string; }\nexport function getContext(): AppContext { return { version: '1.0' }; }",
      },
    });

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    // Builder runs Task A and Task B
    vi.spyOn(builder, "run").mockImplementation(async (opts) => {
      if (opts.taskId === "task-A") {
        return {
          missionId: plan.missionId,
          status: "SUCCESS",
          finalResponse: "Created module A",
          iterations: 1,
          totalTokens: { prompt: 10, completion: 10, total: 20 },
          totalCostUsd: 0.0001,
          durationMs: 10,
          steps: [],
          evidence: {
            commands: [{ command: "npm test", stdout: "PASS", stderr: "", exitCode: 0, timestamp: new Date().toISOString() }],
            stdout: "PASS",
            stderr: "",
            exitCode: 0,
            modifiedFiles: [{ path: "src/moduleA.ts", type: "ADDED" }],
            sandboxId: opts.sandboxId,
            timestamps: { startedAt: "", completedAt: "" },
          },
          patch: {
            id: "patch-A",
            taskId: "task-A",
            missionId: plan.missionId,
            baseRevision: 0,
            files: [
              {
                path: "src/moduleA.ts",
                type: "ADDED",
                content: "import { AppContext } from './context';\ndeclare module './context' { interface AppContext { auth: { token: string }; } }\nexport function handleA(ctx: AppContext): string { return ctx.auth.token; }",
              },
            ],
            createdAt: new Date().toISOString(),
            authorRole: "BUILDER",
          },
        };
      } else {
        return {
          missionId: plan.missionId,
          status: "SUCCESS",
          finalResponse: "Created module B",
          iterations: 1,
          totalTokens: { prompt: 10, completion: 10, total: 20 },
          totalCostUsd: 0.0001,
          durationMs: 10,
          steps: [],
          evidence: {
            commands: [{ command: "npm test", stdout: "PASS", stderr: "", exitCode: 0, timestamp: new Date().toISOString() }],
            stdout: "PASS",
            stderr: "",
            exitCode: 0,
            modifiedFiles: [{ path: "src/moduleB.ts", type: "ADDED" }],
            sandboxId: opts.sandboxId,
            timestamps: { startedAt: "", completedAt: "" },
          },
          patch: {
            id: "patch-B",
            taskId: "task-B",
            missionId: plan.missionId,
            baseRevision: 0,
            files: [
              {
                path: "src/moduleB.ts",
                type: "ADDED",
                content: "import { AppContext } from './context';\ndeclare module './context' { interface AppContext { auth: string; } }\nexport function handleB(ctx: AppContext): string { return ctx.auth; }",
              },
            ],
            createdAt: new Date().toISOString(),
            authorRole: "BUILDER",
          },
        };
      }
    });

    // Sentinel approves both tasks individually
    vi.spyOn(sentinel, "review").mockImplementation(async (opts) => {
      return {
        missionId: plan.missionId,
        status: "SUCCESS",
        review: {
          taskId: opts.task.id,
          decision: "APPROVED",
          summary: `Task ${opts.task.id} verified and approved in isolation.`,
          criteriaResults: [{ criterion: opts.task.successCriteria[0], status: "PASS", evidence: "npm test", reason: "ok" }],
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

    // Sandbox execution: When integrated QA runs 'npx tsc --noEmit' on the combined project, it fails with TS2717!
    vi.spyOn(sandboxProvider, "execute").mockImplementation(async (sbxId, cmd) => {
      if (cmd.includes("tsc")) {
        const fileA = await sandboxProvider.readFile(sbxId, "src/moduleA.ts");
        const fileB = await sandboxProvider.readFile(sbxId, "src/moduleB.ts");
        if (fileA.includes("auth: { token: string }") && fileB.includes("auth: string")) {
          return {
            exitCode: 2,
            stdout: "",
            stderr: "src/moduleB.ts(3,40): error TS2717: Subsequent property declarations must have the same type. Property 'auth' must be of type '{ token: string; }', but here has type 'string'.",
            durationMs: 35,
          };
        }
      }
      return { exitCode: 0, stdout: "PASS", stderr: "", durationMs: 10 };
    });

    const emittedEvents: string[] = [];

    const orch = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider,
      canonicalWorkspace: workspace,
      maxConcurrentTasks: 1,
    });

    const result = await orch.run({
      missionPrompt: "Execute adversarial mission",
      sandboxId: "sbx-master",
      onEvent: (evt) => {
        emittedEvents.push(evt.type);
      },
    });

    // Integrated QA MUST fail the mission and block MISSION_COMPLETED
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("INTEGRATED_VERIFICATION_FAILED");
    expect(result.error).toContain("error TS2717");
    expect(emittedEvents).not.toContain("MISSION_COMPLETED");
    expect(emittedEvents).toContain("MISSION_FAILED");
  });

  // =========================================================================
  // 6. MULTI-TASK SUCCESS PATH: A (PASS) + B (PASS) -> COMBINED QA PASSES
  // =========================================================================

  it("SUCCESS PATH: Task A (PASS) + Task B (PASS) -> Combined Integrated QA passes -> Emits MISSION_COMPLETED", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: sandboxProvider, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-success-ab",
      title: "Harmonious Multi-Task Mission",
      summary: "Task A creates helper, Task B uses helper; both pass alone and pass combined",
      requirements: ["Helper", "Usage"],
      constraints: [],
      tasks: [
        {
          id: "task-A",
          order: 1,
          title: "Create Helper",
          description: "Export formatUser()",
          assignedRole: "BUILDER",
          priority: "HIGH",
          status: "READY",
          dependencies: [],
          requiredCapabilities: ["typescript"],
          successCriteria: ["formatUser works"],
        },
        {
          id: "task-B",
          order: 2,
          title: "Create Service",
          description: "Use formatUser()",
          assignedRole: "BUILDER",
          priority: "HIGH",
          status: "READY",
          dependencies: [],
          requiredCapabilities: ["typescript"],
          successCriteria: ["Service formats user correctly"],
        },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    workspace.setBaseline({
      missionId: "mission-success-ab",
      revision: 0,
      files: {
        "package.json": JSON.stringify({ name: "app", scripts: { test: "vitest run" } }),
        "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }),
      },
    });

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    vi.spyOn(builder, "run").mockImplementation(async (opts) => {
      if (opts.taskId === "task-A") {
        return {
          missionId: plan.missionId,
          status: "SUCCESS",
          finalResponse: "Created formatUser",
          iterations: 1,
          totalTokens: { prompt: 10, completion: 10, total: 20 },
          totalCostUsd: 0.0001,
          durationMs: 10,
          steps: [],
          evidence: {
            commands: [{ command: "npm test", stdout: "PASS", stderr: "", exitCode: 0, timestamp: new Date().toISOString() }],
            stdout: "PASS",
            stderr: "",
            exitCode: 0,
            modifiedFiles: [{ path: "src/helper.ts", type: "ADDED" }],
            sandboxId: opts.sandboxId,
            timestamps: { startedAt: "", completedAt: "" },
          },
          patch: {
            id: "patch-A",
            taskId: "task-A",
            missionId: plan.missionId,
            baseRevision: 0,
            files: [
              {
                path: "src/helper.ts",
                type: "ADDED",
                content: "export function formatUser(name: string): string { return `User: ${name}`; }",
              },
            ],
            createdAt: new Date().toISOString(),
            authorRole: "BUILDER",
          },
        };
      } else {
        return {
          missionId: plan.missionId,
          status: "SUCCESS",
          finalResponse: "Created UserService",
          iterations: 1,
          totalTokens: { prompt: 10, completion: 10, total: 20 },
          totalCostUsd: 0.0001,
          durationMs: 10,
          steps: [],
          evidence: {
            commands: [{ command: "npm test", stdout: "PASS", stderr: "", exitCode: 0, timestamp: new Date().toISOString() }],
            stdout: "PASS",
            stderr: "",
            exitCode: 0,
            modifiedFiles: [{ path: "src/service.ts", type: "ADDED" }],
            sandboxId: opts.sandboxId,
            timestamps: { startedAt: "", completedAt: "" },
          },
          patch: {
            id: "patch-B",
            taskId: "task-B",
            missionId: plan.missionId,
            baseRevision: 0,
            files: [
              {
                path: "src/service.ts",
                type: "ADDED",
                content: "import { formatUser } from './helper'; export const alice = formatUser('Alice');",
              },
            ],
            createdAt: new Date().toISOString(),
            authorRole: "BUILDER",
          },
        };
      }
    });

    vi.spyOn(sentinel, "review").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      review: {
        taskId: "task",
        decision: "APPROVED",
        summary: "Approved",
        criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "npm test", reason: "ok" }],
        issues: [],
        recommendations: [],
        confidence: 1.0,
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.0001,
      durationMs: 10,
    });

    // Sandbox execution returns 0
    vi.spyOn(sandboxProvider, "execute").mockResolvedValue({
      exitCode: 0,
      stdout: "TypeScript strict check PASS\nTests 2/2 passed",
      stderr: "",
      durationMs: 30,
    });

    const emittedEvents: string[] = [];

    const orch = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider,
      canonicalWorkspace: workspace,
      maxConcurrentTasks: 1,
    });

    const result = await orch.run({
      missionPrompt: "Execute harmonious mission",
      sandboxId: "sbx-master",
      onEvent: (evt) => {
        emittedEvents.push(evt.type);
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(emittedEvents).toContain("MISSION_COMPLETED");
    expect(emittedEvents).not.toContain("MISSION_FAILED");
  });

  // =========================================================================
  // 7. MATERIALIZATION FAILURE & FAIL-CLOSED SAFETY
  // =========================================================================

  it("materialization failure in integrated QA safely fails closed and blocks mission", async () => {
    workspace.setBaseline({
      missionId: "mission-mat-fail",
      revision: 0,
      files: {
        "package.json": "{}",
        "src/index.ts": "export const x = 1;",
      },
    });

    const sbx = await sandboxProvider.create();
    vi.spyOn(sandboxProvider, "writeFile").mockRejectedValue(new Error("EACCES: Disk write permission denied"));

    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider,
      sandboxId: sbx.id,
    });

    expect(qaResult.success).toBe(false);
    expect(qaResult.error).toContain("MATERIALIZATION_FAILED");
    expect(qaResult.error).toContain("Disk write permission denied");
    expect(qaResult.evidence.exitCode).toBe(1);
  });
});

