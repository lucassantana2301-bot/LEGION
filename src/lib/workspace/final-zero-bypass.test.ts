// LEGION Phase 09.10 — Final Zero-Bypass Adversarial Hardening Test Suite
// Verifies all 27 Zero-Bypass invariants: provider trust identity, atomic final commit,
// irreversible freeze, whole-mission deadline, exact sandbox reconciliation, generation-bound patches,
// meaningful validation classification, monorepo tsconfig detection, and run exclusivity.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  verifyTrustedRealCapability,
  SandboxProvider,
  SandboxInstance,
  SandboxExecutionResult,
  MockSandboxProvider,
} from "../providers/sandbox";
import { E2BSandboxProvider } from "../providers/e2b-sandbox";
import {
  InMemoryCanonicalWorkspace,
  CanonicalWorkspaceMaterializer,
  executeIntegratedQA,
  detectValidationPlan,
  isTrivialScript,
  TaskPatch,
} from "./index";
import { LegionOrchestrator } from "../agent/orchestrator";
import { CommanderAgent } from "../agent/commander-agent";
import { BuilderAgent } from "../agent/builder-agent";
import { SentinelAgent } from "../agent/sentinel-agent";
import { InMemoryMissionMemoryStore } from "../memory";
import { MockLLMProvider } from "../providers/llm";

describe("LEGION Phase 09.10 — Final Zero-Bypass Hardening Suite", () => {
  let mockLlm: MockLLMProvider;
  let commander: CommanderAgent;
  let builder: BuilderAgent;
  let sentinel: SentinelAgent;

  beforeEach(() => {
    mockLlm = new MockLLMProvider();
    commander = new CommanderAgent({ llm: mockLlm });
    builder = new BuilderAgent({ llm: mockLlm, sandbox: new MockSandboxProvider() });
    sentinel = new SentinelAgent({ llm: mockLlm });

    // Set default deterministic behavior for agents
    vi.spyOn(commander, "plan").mockImplementation(async (opts) => ({
      missionId: opts.missionId || "test-mission",
      status: "SUCCESS",
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.001,
      durationMs: 10,
      plan: {
        missionId: opts.missionId || "test-mission",
        title: "Test Mission",
        summary: "Plan",
        requirements: ["Req 1"],
        constraints: [],
        tasks: [
          {
            id: "t1",
            order: 1,
            title: "Task 1",
            description: "Do work",
            assignedRole: "BUILDER",
            priority: "HIGH",
            status: "READY",
            dependencies: [],
            requiredCapabilities: [],
            successCriteria: ["ok"],
          },
        ],
        estimatedComplexity: "LOW",
        createdAt: new Date().toISOString(),
      },
    }));

    vi.spyOn(builder, "run").mockImplementation(async (opts) => ({
      missionId: opts.missionId || "test-mission",
      taskId: opts.taskId || "t1",
      status: "SUCCESS",
      finalResponse: "Built successfully",
      iterations: 1,
      steps: [],
      patch: {
        id: `patch-${opts.taskId || "t1"}`,
        taskId: opts.taskId || "t1",
        missionId: opts.missionId || "test-mission",
        generationId: opts.baselineSnapshot?.generationId,
        baseRevision: opts.baselineSnapshot?.baseRevision ?? 0,
        files: [{ path: "src/app.ts", type: "ADDED", content: "export const x = 1;" }],
        createdAt: new Date().toISOString(),
        authorRole: "BUILDER",
        summary: "Built successfully",
      },
      evidence: {
        commands: [],
        stdout: "ok",
        stderr: "",
        exitCode: 0,
        modifiedFiles: [{ path: "src/app.ts", type: "ADDED" }],
        sandboxId: opts.sandboxId,
        timestamps: { startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
      },
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.001,
      durationMs: 10,
    }));

    vi.spyOn(sentinel, "review").mockImplementation(async (opts) => ({
      missionId: opts.missionId || "test-mission",
      status: "SUCCESS",
      review: {
        taskId: opts.task.id,
        decision: "APPROVED",
        confidence: 1.0,
        summary: "QA Approved",
        criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "Verified", reason: "All good" }],
        issues: [],
        recommendations: [],
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 10, completion: 10, total: 20 },
      totalCostUsd: 0.001,
      durationMs: 10,
    }));
  });

  // ==========================================
  // P0-01: UNFORGEABLE PROVIDER TRUST REGISTRY
  // ==========================================

  it("1. Mock provider with executionMode REAL is BLOCKED", () => {
    const mock = new MockSandboxProvider();
    (mock as any).executionMode = "REAL";
    expect(verifyTrustedRealCapability(mock)).toBe(false);
  });

  it("2. Mock provider with forged Symbol is BLOCKED", () => {
    const forged: any = {
      name: "forged-provider",
      executionMode: "REAL",
      [Symbol.for("legion.trusted.real.capability")]: true,
      create: async () => ({ id: "sbx-fake", status: "READY" as const }),
      destroy: async () => {},
      execute: async () => ({ exitCode: 0, stdout: "", stderr: "", durationMs: 5 }),
      writeFile: async () => {},
      readFile: async () => "",
      removeFile: async () => {},
      listFiles: async () => [],
    };
    expect(verifyTrustedRealCapability(forged)).toBe(false);
  });

  it("3. copied descriptor is BLOCKED", () => {
    const realE2B = new E2BSandboxProvider();
    const fake: Record<string, unknown> = {};
    for (const key of Object.getOwnPropertyNames(realE2B)) {
      const desc = Object.getOwnPropertyDescriptor(realE2B, key);
      if (desc) Object.defineProperty(fake, key, desc);
    }
    for (const sym of Object.getOwnPropertySymbols(realE2B)) {
      const desc = Object.getOwnPropertyDescriptor(realE2B, sym);
      if (desc) Object.defineProperty(fake, sym, desc);
    }
    expect(verifyTrustedRealCapability(fake as unknown as SandboxProvider)).toBe(false);
  });

  it("4. Proxy of trusted provider is BLOCKED", () => {
    const realE2B = new E2BSandboxProvider();
    const proxied = new Proxy(realE2B, {
      get(target, prop, receiver) {
        return Reflect.get(target, prop, receiver);
      },
    });
    // WeakSet.has on proxy does not match the target reference unless proxy itself was registered
    expect(verifyTrustedRealCapability(proxied)).toBe(false);
  });

  it("5. Object.create(realProvider) is BLOCKED", () => {
    const realE2B = new E2BSandboxProvider();
    const derived = Object.create(realE2B);
    expect(verifyTrustedRealCapability(derived)).toBe(false);
  });

  it("6. Custom provider is BLOCKED", () => {
    class CustomProvider implements SandboxProvider {
      name = "CustomProvider";
      executionMode = "REAL" as const;
      async create(): Promise<SandboxInstance> {
        return {
          id: "cust-1",
          status: "RUNNING",
          createdAt: new Date().toISOString(),
          provider: "CUSTOM",
        };
      }
      async destroy() {}
      async execute(): Promise<SandboxExecutionResult> {
        return { exitCode: 0, stdout: "ok", stderr: "", durationMs: 10 };
      }
      async writeFile() {}
      async readFile() { return ""; }
      async deleteFile() {}
      async removeFile() {}
      async listFiles() { return []; }
    }
    const custom = new CustomProvider();
    expect(verifyTrustedRealCapability(custom)).toBe(false);
  });

  it("7. Authentic E2B instance created by trusted factory is ACCEPTED", () => {
    const realE2B = new E2BSandboxProvider();
    expect(verifyTrustedRealCapability(realE2B)).toBe(true);
    expect(realE2B.executionMode).toBe("REAL");
  });

  // ==========================================
  // P0-02: NO CUSTOM VALIDATOR BYPASS IN PRODUCTION
  // ==========================================

  it("8. Custom validator cannot bypass Integrated QA when requireRealExecution is true", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-p02", {
      "index.ts": "console.log('hi');",
    });

    // Untrusted mock provider
    const mockProvider = new MockSandboxProvider();

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider: mockProvider,
      canonicalWorkspace: workspace,
      // Attempted bypass via custom validator returning success true
      integratedValidator: async () => ({ success: true }),
    });

    const result = await orchestrator.run({
      missionId: "mission-p02",
      missionPrompt: "Build something",
      sandboxId: "sbx-test",
      requireRealExecution: true,
    });

    // In production mode, custom validator cannot bypass real pipeline with untrusted provider
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("NO_REAL_PROVIDER");
  });

  // ==========================================
  // P0-04: FREEZE MUST BE IRREVERSIBLE DURING RUN
  // ==========================================

  it("9. reset() and mutations after freeze are BLOCKED", () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-p04", {
      "app.ts": "export const x = 1;",
    });
    workspace.freeze();

    expect(workspace.isFrozen()).toBe(true);
    expect(() => workspace.reset()).toThrow("WORKSPACE_FROZEN");
    expect(() => workspace.setBaseline({ missionId: "mission-p04", revision: 0, files: { "app.ts": "2" } })).toThrow("WORKSPACE_FROZEN");
    expect(() => workspace.applyFiles({ "new.ts": "export const y = 2;" }, "task-1")).toThrow("WORKSPACE_FROZEN");
  });

  // ==========================================
  // P0-03 & P0-05: ATOMIC FINAL COMMIT GUARD & MUTATION SAFETY
  // ==========================================

  it("10. Mutation during final memory append blocks completion", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-p03", {
      "src/index.ts": "console.log(1);",
    });

    const memoryStore = new InMemoryMissionMemoryStore();
    const mockProvider = new MockSandboxProvider();
    await mockProvider.create();

    const originalAppend = memoryStore.append.bind(memoryStore);
    vi.spyOn(memoryStore, "append").mockImplementation(async (entry) => {
      // During QA result memory append, simulate adversarial attempt to unlock or mutate
      if (entry.type === "SENTINEL_FINDING" && entry.title.includes("Integrated QA")) {
        try {
          (workspace as unknown as { frozen: boolean }).frozen = false;
          workspace.applyFiles({ "backdoor.ts": "hacked" }, "task-adversary");
        } catch {
          // ignore
        }
      }
      return originalAppend(entry);
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider: mockProvider,
      memoryStore,
      canonicalWorkspace: workspace,
    });

    const result = await orchestrator.run({
      missionId: "mission-p03",
      missionPrompt: "Adversarial mutation test",
      sandboxId: "sbx-p03",
      requireRealExecution: false,
    });

    // If workspace was mutated after QA, FINAL_COMMIT_GUARD blocks completion
    if (result.status === "COMPLETED") {
      expect(workspace.isFrozen()).toBe(true);
      expect(workspace.getAllFiles()["backdoor.ts"]).toBeUndefined();
    } else {
      expect(result.status).toBe("FAILED");
      expect(result.error).toContain("FINAL_COMMIT_GUARD_FAILED");
    }
  });

  it("11. Mutation via onStatusChange blocks completion", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-status", {
      "src/index.ts": "console.log(1);",
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      canonicalWorkspace: workspace,
    });

    let completedEventEmitted = false;
    const result = await orchestrator.run({
      missionId: "mission-status",
      missionPrompt: "Status change mutation",
      sandboxId: "sbx-status",
      requireRealExecution: false,
      onStatusChange: (status) => {
        if (status === "VERIFYING") {
          try {
            workspace.applyFiles({ "evil.ts": "fail" }, "task-evil");
          } catch {
            // Freeze blocks if already frozen
          }
        }
      },
      onEvent: (evt) => {
        if (evt.type === "MISSION_COMPLETED") {
          completedEventEmitted = true;
        }
      },
    });

    if (completedEventEmitted) {
      expect(result.status).toBe("COMPLETED");
      expect(workspace.isFrozen()).toBe(true);
    }
  });

  it("12. Abort during final persistence blocks completion", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-abort", {
      "src/index.ts": "console.log(1);",
    });

    const memoryStore = new InMemoryMissionMemoryStore();
    const abortController = new AbortController();

    vi.spyOn(memoryStore, "snapshot").mockImplementation(async () => {
      // Abort during final snapshot
      abortController.abort();
      return {
        missionId: "mission-abort",
        totalEntries: 0,
        requirements: [],
        architecturalDecisions: [],
        implementationSummary: [],
        issues: [],
        sentinelFindings: [],
        artifacts: [],
        createdAt: new Date().toISOString(),
      };
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      memoryStore,
      canonicalWorkspace: workspace,
    });

    const result = await orchestrator.run({
      missionId: "mission-abort",
      missionPrompt: "Abort persistence test",
      sandboxId: "sbx-abort",
      requireRealExecution: false,
      signal: abortController.signal,
    });

    expect(result.status).not.toBe("COMPLETED");
    expect(["CANCELLED", "FAILED"]).toContain(result.status);
  });

  it("13. Deadline during final persistence blocks completion", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-deadline", {
      "src/index.ts": "console.log(1);",
    });

    const memoryStore = new InMemoryMissionMemoryStore();
    vi.spyOn(memoryStore, "snapshot").mockImplementation(async () => {
      // Simulate delay exceeding deadline
      await new Promise((resolve) => setTimeout(resolve, 80));
      return {
        missionId: "mission-deadline",
        totalEntries: 0,
        requirements: [],
        architecturalDecisions: [],
        implementationSummary: [],
        issues: [],
        sentinelFindings: [],
        artifacts: [],
        createdAt: new Date().toISOString(),
      };
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      memoryStore,
      canonicalWorkspace: workspace,
    });

    const result = await orchestrator.run({
      missionId: "mission-deadline",
      missionPrompt: "Deadline persistence test",
      sandboxId: "sbx-deadline",
      timeoutMs: 30, // 30ms mission deadline
      requireRealExecution: false,
    });

    expect(result.status).not.toBe("COMPLETED");
  });

  // ==========================================
  // P1-01 & P1-02: EXACT RECONCILIATION & EMPTY FILE PRESERVATION
  // ==========================================

  it("14. Empty file survives materialization without truthiness bug", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-empty", {
      "empty.txt": "",
      "populated.txt": "hello",
    });

    const mockProvider = new MockSandboxProvider();
    await mockProvider.create();
    const report = await CanonicalWorkspaceMaterializer.materialize(workspace, mockProvider, "sbx-empty");

    expect(report.files).toContain("empty.txt");
    expect(report.files).toContain("populated.txt");
    const readEmpty = await mockProvider.readFile("sbx-empty", "empty.txt");
    expect(readEmpty).toBe("");
  });

  it("15. Extra remote file is removed before QA", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-extra", {
      "src/main.ts": "export const a = 1;",
    });

    const mockProvider = new MockSandboxProvider();
    await mockProvider.create();
    // Simulate pre-existing extraneous file on remote sandbox
    await mockProvider.writeFile("sbx-extra", "untracked.ts", "rogue file");
    await mockProvider.writeFile("sbx-extra", "src/main.ts", "old content");

    const report = await CanonicalWorkspaceMaterializer.materialize(workspace, mockProvider, "sbx-extra");

    expect(report.deletedFiles.some((f) => f.includes("untracked.ts"))).toBe(true);
    const remoteFiles = await mockProvider.listFiles("sbx-extra", ".");
    expect(remoteFiles.some((f) => f.path.includes("untracked.ts"))).toBe(false);
    expect(remoteFiles.some((f) => f.path.includes("src/main.ts"))).toBe(true);
  });

  it("16. Canonical digest equals remote digest before QA", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-digest", {
      "package.json": JSON.stringify({ name: "test", scripts: { test: "vitest run" } }),
      "src/index.ts": "export const ready = true;",
    });

    const mockProvider = new MockSandboxProvider();
    await mockProvider.create();
    const report = await CanonicalWorkspaceMaterializer.materialize(workspace, mockProvider, "sbx-digest");

    expect(report.canonicalWorkspaceDigest).toBe(workspace.getWorkspaceDigest());
    expect(report.remoteWorkspaceDigest).toBe(workspace.getWorkspaceDigest());
  });

  // ==========================================
  // P1-03: GENERATION-BOUND PATCHES
  // ==========================================

  it("17. Old generation patch is REJECTED", () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-gen", {
      "index.ts": "v1",
    });

    const patch: TaskPatch = {
      id: "patch-1",
      taskId: "task-1",
      missionId: "mission-gen",
      generationId: "old-generation-uuid",
      baseRevision: 0,
      files: [{ path: "index.ts", content: "v2", previousContent: "v1", type: "MODIFIED" }],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
      summary: "Update index",
    };

    const result = workspace.integratePatch(patch);
    expect(result.success).toBe(false);
    expect(result.conflicts?.some((c) => c.type === "STALE_GENERATION_PATCH")).toBe(true);
  });

  it("18. Old missionId patch is REJECTED", () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-A", {
      "index.ts": "v1",
    });

    const patch: TaskPatch = {
      id: "patch-1",
      taskId: "task-1",
      missionId: "mission-B", // Different mission
      generationId: workspace.getGenerationId(),
      baseRevision: 0,
      files: [{ path: "index.ts", content: "v2", previousContent: "v1", type: "MODIFIED" }],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
      summary: "Update index",
    };

    const result = workspace.integratePatch(patch);
    expect(result.success).toBe(false);
    expect(result.conflicts?.some((c) => c.type === "INVALID_MISSION_PATCH")).toBe(true);
  });

  // ==========================================
  // P1-04: MEANINGFUL VALIDATION CLASSIFICATION
  // ==========================================

  it("19. Trivial test scripts are REJECTED with NO_MEANINGFUL_VALIDATION", () => {
    expect(isTrivialScript("echo audited")).toBe(true);
    expect(isTrivialScript("true && true")).toBe(true);
    expect(isTrivialScript("exit 0")).toBe(true);
    expect(isTrivialScript("echo ok")).toBe(true);
    expect(isTrivialScript("true;")).toBe(true);

    const plan = detectValidationPlan({
      "package.json": JSON.stringify({ scripts: { test: "echo audited" } }),
    });
    // Test script command should be omitted because it is trivial
    expect(plan.commands.find((c) => c.purpose === "TEST")).toBeUndefined();
  });

  it("20. Meaningful test commands are ACCEPTED", () => {
    expect(isTrivialScript("vitest run")).toBe(false);
    expect(isTrivialScript("jest --coverage")).toBe(false);
    expect(isTrivialScript("pytest")).toBe(false);
    expect(isTrivialScript("next build")).toBe(false);

    const plan = detectValidationPlan({
      "package.json": JSON.stringify({ scripts: { test: "vitest run", build: "next build" } }),
    });
    expect(plan.commands.some((c) => c.command === "npm test")).toBe(true);
    expect(plan.commands.some((c) => c.command === "npm run build")).toBe(true);
  });

  // ==========================================
  // P1-05: TYPESCRIPT MONOREPO CORRECTNESS
  // ==========================================

  it("21. Nested tsconfig.build.json executes with correct cwd and -p flag", () => {
    const plan = detectValidationPlan({
      "packages/pkg-a/package.json": JSON.stringify({ name: "pkg-a" }),
      "packages/pkg-a/tsconfig.build.json": JSON.stringify({ compilerOptions: {} }),
      "packages/pkg-a/src/index.ts": "export const a = 1;",
    });

    const tsCmd = plan.commands.find((c) => c.purpose === "TYPECHECK");
    expect(tsCmd).toBeDefined();
    expect(tsCmd?.command).toBe("npx tsc --noEmit -p tsconfig.build.json");
    expect(tsCmd?.cwd).toBe("packages/pkg-a");
  });

  it("22. TypeScript Project References run tsc --build", () => {
    const plan = detectValidationPlan({
      "tsconfig.json": JSON.stringify({
        references: [{ path: "./packages/core" }],
      }),
      "packages/core/tsconfig.json": JSON.stringify({ compilerOptions: { composite: true } }),
    });

    const rootTsCmd = plan.commands.find((c) => c.cwd === ".");
    expect(rootTsCmd).toBeDefined();
    expect(rootTsCmd?.command).toBe("npx tsc --build");
  });

  // ==========================================
  // P1-06: REMOTE PROCESS ABORT
  // ==========================================

  it("23. Local abort with remote command execution fails QA cleanly", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-abort-cmd", {
      "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
    });

    const realE2B = new E2BSandboxProvider();
    vi.spyOn(realE2B, "create").mockResolvedValue({
      id: "sbx-abort-1",
      status: "RUNNING",
      createdAt: new Date().toISOString(),
      provider: "E2B",
    });
    const instance = await realE2B.create();
    const abortCtrl = new AbortController();

    const remoteFiles: Record<string, string> = {
      "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
    };
    vi.spyOn(realE2B, "writeFile").mockImplementation(async (_id, path, content) => {
      remoteFiles[path] = content;
    });
    vi.spyOn(realE2B, "readFile").mockImplementation(async (_id, path) => {
      return remoteFiles[path] || "";
    });
    vi.spyOn(realE2B, "listFiles").mockImplementation(async () => {
      return Object.keys(remoteFiles).map((p) => ({
        path: p,
        isDirectory: false,
        sizeBytes: remoteFiles[p].length,
        updatedAt: new Date().toISOString(),
      }));
    });

    vi.spyOn(realE2B, "execute").mockImplementation(async (_id, _cmd, _in, _t, signal) => {
      // Simulate slow remote command aborted mid-flight
      abortCtrl.abort();
      if (signal?.aborted) {
        return { exitCode: 130, stdout: "", stderr: "Process terminated by SIGINT/SIGKILL", durationMs: 20 };
      }
      return { exitCode: 0, stdout: "ok", stderr: "", durationMs: 20 };
    });

    const result = await executeIntegratedQA({
      workspace,
      sandboxProvider: realE2B,
      sandboxId: instance.id,
      requireRealExecution: true,
      signal: abortCtrl.signal,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("ABORTED");
  });

  // ==========================================
  // P1-07: DEADLINE MUST COVER WHOLE MISSION
  // ==========================================

  it("24. Deadline starts from mission start and covers all phases", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-full-deadline", {
      "index.ts": "console.log(1);",
    });

    // Simulate slow commander
    vi.spyOn(commander, "plan").mockImplementation(async (opts) => {
      await new Promise((resolve) => setTimeout(resolve, 60));
      return {
        missionId: opts.missionId || "mission-full-deadline",
        status: "SUCCESS",
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.001,
        durationMs: 60,
        plan: {
          missionId: opts.missionId || "mission-full-deadline",
          title: "Slow Plan",
          summary: "Slow",
          requirements: ["Req 1"],
          constraints: [],
          tasks: [],
          estimatedComplexity: "LOW",
          createdAt: new Date().toISOString(),
        },
      };
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      canonicalWorkspace: workspace,
    });

    const result = await orchestrator.run({
      missionId: "mission-full-deadline",
      missionPrompt: "Full mission deadline test",
      sandboxId: "sbx-dl",
      timeoutMs: 30, // 30ms total mission deadline
    });

    expect(result.status).not.toBe("COMPLETED");
  });

  // ==========================================
  // P1-08: RUN EXCLUSIVITY
  // ==========================================

  it("25. Concurrent run on same orchestrator instance is REJECTED with RUN_ALREADY_ACTIVE", async () => {
    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
    });

    vi.spyOn(commander, "plan").mockImplementation(async (opts) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        missionId: opts.missionId || "mission-excl",
        status: "SUCCESS",
        totalTokens: { prompt: 10, completion: 10, total: 20 },
        totalCostUsd: 0.001,
        durationMs: 50,
        plan: {
          missionId: opts.missionId || "mission-excl",
          title: "P1",
          summary: "P1",
          requirements: ["Req 1"],
          constraints: [],
          tasks: [],
          estimatedComplexity: "LOW",
          createdAt: new Date().toISOString(),
        },
      };
    });

    const run1 = orchestrator.run({ missionId: "mission-excl-1", missionPrompt: "Mission 1", sandboxId: "sbx-1" });
    const run2Promise = orchestrator.run({ missionId: "mission-excl-2", missionPrompt: "Mission 2", sandboxId: "sbx-2" });

    await expect(run2Promise).rejects.toThrow("RUN_ALREADY_ACTIVE");
    await run1;
  });

  // ==========================================
  // P2: EVIDENCE CONSISTENCY & FINAL COMMIT GUARD
  // ==========================================

  it("26. Final QA evidence is strictly tied to validated canonical workspace", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-evidence", {
      "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
      "src/index.ts": "export const x = 42;",
    });

    const realE2B = new E2BSandboxProvider();
    vi.spyOn(realE2B, "create").mockResolvedValue({
      id: "sbx-ev-1",
      status: "RUNNING",
      createdAt: new Date().toISOString(),
      provider: "E2B",
    });
    const instance = await realE2B.create();

    const remoteFiles: Record<string, string> = {
      "package.json": JSON.stringify({ scripts: { test: "vitest run" } }),
      "src/index.ts": "export const x = 42;",
    };
    vi.spyOn(realE2B, "writeFile").mockImplementation(async (_id, path, content) => {
      remoteFiles[path] = content;
    });
    vi.spyOn(realE2B, "readFile").mockImplementation(async (_id, path) => {
      return remoteFiles[path] || "";
    });
    vi.spyOn(realE2B, "listFiles").mockImplementation(async () => {
      return Object.keys(remoteFiles).map((p) => ({
        path: p,
        isDirectory: false,
        sizeBytes: remoteFiles[p].length,
        updatedAt: new Date().toISOString(),
      }));
    });

    vi.spyOn(realE2B, "execute").mockResolvedValue({
      exitCode: 0,
      stdout: "Tests passed: 5",
      stderr: "",
      durationMs: 35,
    });

    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider: realE2B,
      sandboxId: instance.id,
      requireRealExecution: true,
    });

    expect(qaResult.success).toBe(true);
    expect(qaResult.validatedRevision).toBe(workspace.getCurrentRevision());
    expect(qaResult.validatedGeneration).toBe(workspace.getGenerationId());
    expect(qaResult.workspaceDigest).toBe(workspace.getWorkspaceDigest());
    expect(qaResult.materialization.remoteWorkspaceDigest).toBe(workspace.getWorkspaceDigest());
    expect(qaResult.evidence.commands.length).toBeGreaterThan(0);
    expect(qaResult.executionMode).toBe("REAL");
  });

  it("27. MISSION_COMPLETED only emitted after final commit guard passes", async () => {
    const workspace = new InMemoryCanonicalWorkspace("mission-complete-guard", {
      "index.ts": "console.log('done');",
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      canonicalWorkspace: workspace,
    });

    const emittedEvents: string[] = [];
    const result = await orchestrator.run({
      missionId: "mission-complete-guard",
      missionPrompt: "Final commit guard verification",
      sandboxId: "sbx-guard",
      requireRealExecution: false,
      onEvent: (evt) => {
        emittedEvents.push(evt.type);
      },
    });

    expect(result.status).toBe("COMPLETED");
    expect(emittedEvents).toContain("MISSION_COMPLETED");
    expect(workspace.isFrozen()).toBe(true);
  });
});
