// LEGION Phase 09.9 — Zero-Bypass Production Gate Test Suite
// Verifies all 28 mandatory requirements preventing any bypass or false positive in production QA.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InMemoryCanonicalWorkspace,
  normalizeWorkspacePath,
  detectValidationPlan,
  executeIntegratedQA,
  validateAndSanitizeCwd,
  TaskPatch,
  CanonicalWorkspaceMaterializer,
} from "./index";
import {
  SandboxProvider,
  MockSandboxProvider,
  resolveSandboxPath,
  verifyTrustedRealCapability,
} from "../providers/sandbox";
import { E2BSandboxProvider } from "../providers/e2b-sandbox";
import { LegionOrchestrator } from "../agent/orchestrator";
import { CommanderAgent, MissionPlan } from "../agent/commander-agent";
import { BuilderAgent } from "../agent/builder-agent";
import { SentinelAgent } from "../agent/sentinel-agent";
import { MockLLMProvider } from "../providers/llm";
import { POST } from "../../app/api/agent/orchestrator/route";
import { NextRequest } from "next/server";
import * as providersModule from "../providers";

describe("Phase 09.9 — Zero-Bypass Production Gate Suite", () => {
  let mockSandbox: MockSandboxProvider;
  let workspace: InMemoryCanonicalWorkspace;

  const mockCommanderPlanJson = JSON.stringify({
    title: "Test Mission",
    summary: "Plan summary",
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
  });

  const mockBuilderJson = JSON.stringify({
    finalResponse: "Built successfully",
    patch: {
      files: [{ path: "src/app.ts", type: "ADDED", content: "export const x = 1;" }],
    },
  });

  const mockSentinelJson = "```json\n" + JSON.stringify({
    decision: "APPROVED",
    summary: "Looks good",
    criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "ok", reason: "ok" }],
    issues: [],
    recommendations: [],
    confidence: 1.0,
  }) + "\n```";

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(providersModule, "getLLMProvider").mockReturnValue(
      new MockLLMProvider([
        mockCommanderPlanJson,
        mockBuilderJson,
        mockSentinelJson,
        mockSentinelJson,
        mockSentinelJson,
      ])
    );
    mockSandbox = new MockSandboxProvider();
    workspace = new InMemoryCanonicalWorkspace("mission-zero-bypass");
  });

  async function readStreamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let result = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
    }
    return result;
  }

  // =========================================================================
  // 1-4. API & TRUSTED PROVIDER CAPABILITY CHECKS
  // =========================================================================

  it("1. API + MockSandboxProvider is blocked in production mode", async () => {
    vi.spyOn(providersModule, "getSandboxProvider").mockReturnValue(new MockSandboxProvider());

    const req = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: JSON.stringify({
        mission: "Build and verify feature with mock sandbox",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const rawOutput = await readStreamToString(res.body!);
    const lines = rawOutput.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));

    const endEvt = lines.find((l) => l.type === "STREAM_END");
    expect(endEvt).toBeDefined();
    // Default API execution enforces requireRealExecution -> fails because mock sandbox is not trusted REAL
    expect(endEvt.result.status).toBe("FAILED");
    expect(endEvt.result.error).toMatch(/MOCK_QA_REJECTED|NO_REAL_PROVIDER|INTEGRATED_VERIFICATION_FAILED|rejected/i);
  });

  it("2. API + provider without executionMode is blocked", async () => {
    const fakeProvider = {
      name: "no-mode-provider",
      create: async () => ({ id: "sbx-1", status: "RUNNING" as const, createdAt: "", provider: "FAKE" }),
      execute: async () => ({ exitCode: 0, stdout: "OK", stderr: "", durationMs: 10 }),
      readFile: async () => "content",
      writeFile: async () => {},
      deleteFile: async () => {},
      listFiles: async () => [],
      destroy: async () => {},
    } as unknown as SandboxProvider;

    vi.spyOn(providersModule, "getSandboxProvider").mockReturnValue(fakeProvider);

    const req = new NextRequest("http://localhost:3000/api/agent/orchestrator", {
      method: "POST",
      body: JSON.stringify({
        mission: "Build feature",
      }),
      headers: { "content-type": "application/json" },
    });

    const res = await POST(req);
    const rawOutput = await readStreamToString(res.body!);
    const lines = rawOutput.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => JSON.parse(l));
    const endEvt = lines.find((l) => l.type === "STREAM_END");
    expect(endEvt.result.status).toBe("FAILED");
  });

  it("3. Spoofed executionMode: 'REAL' on untrusted provider is blocked by capability token", async () => {
    // Custom fake provider claiming to be REAL without internal system token
    const spoofedProvider = {
      name: "spoofed-real-provider",
      executionMode: "REAL" as const,
      create: async () => ({ id: "sbx-spoof", status: "RUNNING" as const, createdAt: "", provider: "SPOOF" }),
      execute: async () => ({ exitCode: 0, stdout: "OK", stderr: "", durationMs: 10 }),
      readFile: async () => "content",
      writeFile: async () => {},
      deleteFile: async () => {},
      listFiles: async () => [],
      destroy: async () => {},
    } as SandboxProvider;

    expect(verifyTrustedRealCapability(spoofedProvider)).toBe(false);

    workspace.setBaseline({
      missionId: "mission-spoof",
      revision: 0,
      files: {
        "package.json": JSON.stringify({ name: "app", scripts: { test: "vitest" } }),
        "src/index.ts": "export const x = 1;",
      },
    });

    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider: spoofedProvider,
      sandboxId: "sbx-spoof",
      requireRealExecution: true,
    });

    expect(qaResult.success).toBe(false);
    expect(qaResult.error).toContain("MOCK_QA_REJECTED");
  });

  it("4. Missing sandbox provider is blocked fail-closed", async () => {
    workspace.setBaseline({
      missionId: "mission-no-provider",
      revision: 0,
      files: { "index.ts": "export const a = 1;" },
    });

    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider: undefined as unknown as SandboxProvider,
      sandboxId: "none",
      requireRealExecution: true,
    });

    expect(qaResult.success).toBe(false);
    expect(qaResult.error).toContain("NO_REAL_PROVIDER");
  });

  // =========================================================================
  // 5-7. ZERO-BYPASS GATES (EMPTY WORKSPACE, EMPTY PLAN, UNTRUSTED VALIDATOR)
  // =========================================================================

  it("5. Empty canonical workspace is blocked fail-closed", async () => {
    workspace.reset();
    expect(Object.keys(workspace.getAllFiles()).length).toBe(0);

    const trustedProvider = new E2BSandboxProvider();
    vi.spyOn(trustedProvider, "create").mockResolvedValue({
      id: "sbx-test-5",
      status: "RUNNING",
      createdAt: new Date().toISOString(),
      provider: "E2B",
    });
    const sbx = await trustedProvider.create();
    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider: trustedProvider,
      sandboxId: sbx.id,
      requireRealExecution: true,
    });

    expect(qaResult.success).toBe(false);
    expect(qaResult.error).toContain("EMPTY_WORKSPACE");
  });

  it("6. Empty validation plan (no verifiable commands) is blocked fail-closed", async () => {
    workspace.setBaseline({
      missionId: "mission-no-plan",
      revision: 0,
      files: {
        "README.md": "# Just documentation",
        "notes.txt": "Some text",
      },
    });

    const trustedProvider = new E2BSandboxProvider();
    vi.spyOn(trustedProvider, "create").mockResolvedValue({
      id: "sbx-test-6",
      status: "RUNNING",
      createdAt: new Date().toISOString(),
      provider: "E2B",
    });
    const sbx = await trustedProvider.create();

    const remoteFiles: Record<string, string> = {
      "README.md": "# Just documentation",
      "notes.txt": "Some text",
    };
    vi.spyOn(trustedProvider, "writeFile").mockImplementation(async (_id, path, content) => {
      remoteFiles[path] = content;
    });
    vi.spyOn(trustedProvider, "readFile").mockImplementation(async (_id, path) => {
      return remoteFiles[path] || "";
    });
    vi.spyOn(trustedProvider, "listFiles").mockImplementation(async () => {
      return Object.keys(remoteFiles).map((p) => ({
        path: p,
        isDirectory: false,
        sizeBytes: remoteFiles[p].length,
        updatedAt: new Date().toISOString(),
      }));
    });
    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider: trustedProvider,
      sandboxId: sbx.id,
      requireRealExecution: true,
    });

    expect(qaResult.success).toBe(false);
    expect(qaResult.error).toMatch(/NO_VALIDATION_COMMANDS|NO_MEANINGFUL_VALIDATION/);
  });

  it("7. Custom validator without trusted production capability is blocked", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: mockSandbox, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-untrusted-val",
      title: "Test Untrusted Validator",
      summary: "Test",
      requirements: [],
      constraints: [],
      tasks: [
        { id: "t1", order: 1, title: "T1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
    });

    vi.spyOn(builder, "run").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      finalResponse: "OK",
      iterations: 1,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
      steps: [],
      evidence: { commands: [], stdout: "OK", stderr: "", exitCode: 0, modifiedFiles: [], sandboxId: "sbx-1", timestamps: { startedAt: "", completedAt: "" } },
      patch: { id: "p1", taskId: "t1", missionId: plan.missionId, baseRevision: 0, files: [{ path: "a.txt", type: "ADDED", content: "hello" }], createdAt: "", authorRole: "BUILDER" },
    });

    vi.spyOn(sentinel, "review").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      review: {
        taskId: "t1",
        decision: "APPROVED",
        summary: "Approved",
        criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "ok", reason: "ok" }],
        issues: [],
        recommendations: [],
        confidence: 1.0,
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 10,
    });

    // Custom validator claiming success
    const untrustedValidator = vi.fn().mockResolvedValue({ success: true });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider: mockSandbox,
      canonicalWorkspace: new InMemoryCanonicalWorkspace(plan.missionId),
      integratedValidator: untrustedValidator,
    });

    const result = await orchestrator.run({
      missionId: plan.missionId,
      missionPrompt: "Test",
      sandboxId: "sbx-1",
      requireRealExecution: true, // Production mode
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/UNTRUSTED_VALIDATOR|NO_REAL_PROVIDER/);
  });

  // =========================================================================
  // 8-10. TOCTOU, DIGEST & GENERATION LOCK
  // =========================================================================

  it("8. TOCTOU prevention: workspace mutation during/after QA check blocks completion", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: mockSandbox, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-toctou",
      title: "Test TOCTOU",
      summary: "Test",
      requirements: [],
      constraints: [],
      tasks: [
        { id: "t1", order: 1, title: "T1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
    });

    vi.spyOn(builder, "run").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      finalResponse: "OK",
      iterations: 1,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
      steps: [],
      evidence: { commands: [], stdout: "OK", stderr: "", exitCode: 0, modifiedFiles: [], sandboxId: "sbx-1", timestamps: { startedAt: "", completedAt: "" } },
      patch: { id: "p1", taskId: "t1", missionId: plan.missionId, baseRevision: 0, files: [{ path: "app.ts", type: "ADDED", content: "console.log('hi');" }], createdAt: "", authorRole: "BUILDER" },
    });

    vi.spyOn(sentinel, "review").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      review: {
        taskId: "t1",
        decision: "APPROVED",
        summary: "Approved",
        criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "ok", reason: "ok" }],
        issues: [],
        recommendations: [],
        confidence: 1.0,
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 10,
    });

    const orchestratorWorkspace = new InMemoryCanonicalWorkspace(plan.missionId);

    // Custom validator that mutates workspace mid-validation!
    const mutatingValidator = async (ws: any) => {
      // Simulate concurrent mutation
      ws.applyFiles({ "sneaky.ts": "corrupted" }, "malicious-task");
      return { success: true };
    };

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      canonicalWorkspace: orchestratorWorkspace,
      integratedValidator: mutatingValidator,
    });

    const result = await orchestrator.run({
      missionId: plan.missionId,
      missionPrompt: "Test",
      sandboxId: "sbx-1",
      requireRealExecution: false,
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toMatch(/STALE_REVISION|DIGEST_MISMATCH/);
  });

  it("9. setBaseline() regenerates generation ID and resets digest", () => {
    workspace.setBaseline({
      missionId: "m1",
      revision: 0,
      files: { "a.ts": "const x = 1;" },
    });

    const gen1 = workspace.getGenerationId();
    const digest1 = workspace.getWorkspaceDigest();
    expect(gen1).toBeDefined();
    expect(digest1).toBeDefined();

    // Reset baseline with new content
    workspace.setBaseline({
      missionId: "m2",
      revision: 0,
      files: { "a.ts": "const x = 2;" },
    });

    const gen2 = workspace.getGenerationId();
    const digest2 = workspace.getWorkspaceDigest();

    expect(gen2).not.toBe(gen1);
    expect(digest2).not.toBe(digest1);
    expect(workspace.getMissionId()).toBe("m2");
  });

  it("10. Digest changes on content modification even if file count is same", () => {
    workspace.setBaseline({
      missionId: "m-digest",
      revision: 0,
      files: { "index.ts": "export const val = 100;" },
    });

    const digestBefore = workspace.getWorkspaceDigest();

    workspace.integratePatch({
      id: "p-mod",
      taskId: "t-mod",
      missionId: "m-digest",
      baseRevision: 0,
      files: [
        { path: "index.ts", type: "MODIFIED", content: "export const val = 200;" },
      ],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    });

    const digestAfter = workspace.getWorkspaceDigest();
    expect(digestAfter).not.toBe(digestBefore);
  });

  // =========================================================================
  // 11-13. CWD COMMAND INJECTION & STRUCTURED CONCURRENCY
  // =========================================================================

  it("11. CWD command injection attack 'x; true #/package.json' is strictly rejected", () => {
    const maliciousCwd = "src; true #/package.json";
    expect(() => validateAndSanitizeCwd(maliciousCwd)).toThrow("INVALID_CWD_INJECTION");

    const traversalCwd = "../../etc";
    expect(() => validateAndSanitizeCwd(traversalCwd)).toThrow("INVALID_CWD_TRAVERSAL");

    const validNested = "packages/core";
    expect(validateAndSanitizeCwd(validNested)).toBe("packages/core");
  });

  it("12. Worker unexpected rejection triggers immediate drain and fail-fast termination", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: mockSandbox, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-reject-drain",
      title: "Worker Rejection",
      summary: "Test",
      requirements: [],
      constraints: [],
      tasks: [
        { id: "t1", order: 1, title: "T1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
        { id: "t2", order: 2, title: "T2", description: "T2", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
    });

    // Task 1 throws unexpected unhandled exception
    vi.spyOn(builder, "run").mockImplementation(async (opts) => {
      if (opts.taskId === "t1") {
        throw new Error("UNHANDLED_WORKER_CRASH");
      }
      // Task 2 hangs briefly
      await new Promise((r) => setTimeout(r, 500));
      return {
        missionId: plan.missionId,
        status: "SUCCESS",
        finalResponse: "T2 OK",
        iterations: 1,
        totalTokens: { prompt: 0, completion: 0, total: 0 },
        totalCostUsd: 0,
        durationMs: 0,
        steps: [],
        evidence: { commands: [], stdout: "", stderr: "", exitCode: 0, modifiedFiles: [], sandboxId: "sbx-1", timestamps: { startedAt: "", completedAt: "" } },
      };
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      maxConcurrentTasks: 2,
    });

    const result = await orchestrator.run({
      missionId: plan.missionId,
      missionPrompt: "Test",
      sandboxId: "sbx-1",
      requireRealExecution: false,
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("UNHANDLED_WORKER_CRASH");
  });

  it("13. Worker that never resolves is terminated by active deadline timer", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: mockSandbox, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-deadline",
      title: "Deadline Test",
      summary: "Test",
      requirements: [],
      constraints: [],
      tasks: [
        { id: "t1", order: 1, title: "Infinite Task", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
    });

    // Builder never resolves unless signal is aborted
    vi.spyOn(builder, "run").mockImplementation(async (opts) => {
      return new Promise<any>((resolve) => {
        opts.signal?.addEventListener("abort", () => {
          resolve({
            missionId: plan.missionId,
            status: "CANCELLED",
            finalResponse: "Aborted",
            iterations: 0,
            totalTokens: { prompt: 0, completion: 0, total: 0 },
            totalCostUsd: 0,
            durationMs: 0,
            steps: [],
            evidence: { commands: [], stdout: "", stderr: "Aborted", exitCode: 130, modifiedFiles: [], sandboxId: "sbx-1", timestamps: { startedAt: "", completedAt: "" } },
          });
        });
      });
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
    });

    const result = await orchestrator.run({
      missionId: plan.missionId,
      missionPrompt: "Test",
      sandboxId: "sbx-1",
      timeoutMs: 150, // Short timeout
      requireRealExecution: false,
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("timed out");
  });

  // =========================================================================
  // 14-17. QA ABORT, DELETIONS & STALE PATCH RESURRECTION
  // =========================================================================

  it("14-15. QA success after abort or deadline is discarded", async () => {
    workspace.setBaseline({
      missionId: "m-abort-qa",
      revision: 0,
      files: {
        "package.json": JSON.stringify({ name: "app", scripts: { test: "vitest" } }),
        "src/app.ts": "export const a = 1;",
      },
    });

    const abortController = new AbortController();
    abortController.abort(); // Pre-aborted

    const sbx = await mockSandbox.create();
    const qaResult = await executeIntegratedQA({
      workspace,
      sandboxProvider: mockSandbox,
      sandboxId: sbx.id,
      requireRealExecution: false,
      signal: abortController.signal,
    });

    expect(qaResult.success).toBe(false);
    expect(qaResult.error).toContain("INTEGRATED_QA_ABORTED");
  });

  it("16. Materializer executes real deletion on sandbox", async () => {
    workspace.setBaseline({
      missionId: "m-delete",
      revision: 0,
      files: {
        "keep.txt": "keep me",
        "remove.txt": "delete me",
      },
    });

    const sbx = await mockSandbox.create();
    // Materialize initial state
    await CanonicalWorkspaceMaterializer.materialize(workspace, mockSandbox, sbx.id);

    expect(await mockSandbox.readFile(sbx.id, "keep.txt")).toBe("keep me");
    expect(await mockSandbox.readFile(sbx.id, "remove.txt")).toBe("delete me");

    // Integrate patch deleting remove.txt
    workspace.integratePatch({
      id: "p-del",
      taskId: "t-del",
      missionId: "m-delete",
      baseRevision: 0,
      files: [
        { path: "remove.txt", type: "DELETED" },
      ],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    });

    // Materialize again
    const report = await CanonicalWorkspaceMaterializer.materialize(workspace, mockSandbox, sbx.id);
    expect(report.deletedFiles).toContain("remove.txt");

    // Verify file no longer exists in sandbox
    await expect(mockSandbox.readFile(sbx.id, "remove.txt")).rejects.toThrow("File not found");
  });

  it("17. Deleted file cannot be resurrected by a stale patch", () => {
    workspace.setBaseline({
      missionId: "m-resurrect",
      revision: 0,
      files: {
        "deprecated.ts": "export const old = true;",
      },
    });

    // Task 1 deletes deprecated.ts in revision 1
    const delResult = workspace.integratePatch({
      id: "p-del",
      taskId: "t-del",
      missionId: "m-resurrect",
      baseRevision: 0,
      files: [{ path: "deprecated.ts", type: "DELETED" }],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    });
    expect(delResult.success).toBe(true);
    expect(workspace.getCurrentRevision()).toBe(1);

    // Task 2 (stale based on revision 0) tries to modify deprecated.ts
    const stalePatch: TaskPatch = {
      id: "p-stale-mod",
      taskId: "t-stale",
      missionId: "m-resurrect",
      baseRevision: 0,
      files: [{ path: "deprecated.ts", type: "MODIFIED", content: "export const resurrected = true;" }],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    };

    const conflicts = workspace.detectConflicts(stalePatch);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe("STALE_DELETE_MODIFICATION");

    const modResult = workspace.integratePatch(stalePatch);
    expect(modResult.success).toBe(false);
  });

  // =========================================================================
  // 18-24. PATH NORMALIZATION, MONOREPO & TEST DETECTION HARDENING
  // =========================================================================

  it("18-19. Path normalization blocks traversal and canonicalizes ./ aliases", () => {
    expect(() => normalizeWorkspacePath("../etc/passwd")).toThrow("PATH_TRAVERSAL_REJECTED");
    expect(() => normalizeWorkspacePath("foo/../../bar")).toThrow("PATH_TRAVERSAL_REJECTED");

    expect(normalizeWorkspacePath("./src/index.ts")).toBe("src/index.ts");
    expect(normalizeWorkspacePath("src//index.ts")).toBe("src/index.ts");
    expect(normalizeWorkspacePath("\\src\\index.ts")).toBe("src/index.ts");
  });

  it("20. Sandbox boundary check prevents /home/user vs /home/user2 bypass", () => {
    const root = "/home/user";

    // Valid path within /home/user
    expect(resolveSandboxPath(root, "src/app.ts")).toBe("/home/user/src/app.ts");
    expect(resolveSandboxPath(root, "/home/user/src/app.ts")).toBe("/home/user/src/app.ts");

    // Invalid path escaping into /home/user2
    expect(() => resolveSandboxPath(root, "/home/user2/file.txt")).toThrow(/boundary violation|escapes sandbox root/);
    expect(() => resolveSandboxPath(root, "../user2/file.txt")).toThrow(/boundary violation|escapes sandbox root/);
  });

  it("21. Detects nested tsconfig.build.json and project configs", () => {
    const files = {
      "packages/server/tsconfig.build.json": JSON.stringify({ compilerOptions: {} }),
      "packages/server/src/index.ts": "export const x = 1;",
    };

    const plan = detectValidationPlan(files);
    expect(plan.commands.some((c) => c.command === "npx tsc --noEmit -p tsconfig.build.json" && c.cwd === "packages/server")).toBe(true);
  });

  it("22-23. Conservative Python test detection ignores tests/README.md and requires .py", () => {
    // tests/README.md should NOT activate pytest
    const nonPyFiles = {
      "src/app.py": "def main(): pass",
      "tests/README.md": "Documentation about tests",
    };

    const plan1 = detectValidationPlan(nonPyFiles);
    expect(plan1.commands.some((c) => c.command === "pytest")).toBe(false);

    // tests/test_app.py should activate pytest
    const pyFiles = {
      "src/app.py": "def main(): pass",
      "tests/test_app.py": "def test_main(): assert True",
    };

    const plan2 = detectValidationPlan(pyFiles);
    expect(plan2.commands.some((c) => c.command === "pytest")).toBe(true);
  });

  it("24. Rejects trivial test scripts like 'true;', 'exit 0;' while keeping real test scripts", () => {
    const trivialFiles = {
      "package.json": JSON.stringify({
        name: "pkg",
        scripts: {
          test: "true;",
          build: "exit 0;",
        },
      }),
    };

    const plan = detectValidationPlan(trivialFiles);
    expect(plan.commands.some((c) => c.command === "npm test")).toBe(false);
    expect(plan.commands.some((c) => c.command === "npm run build")).toBe(false);
  });

  // =========================================================================
  // 25-28. QA EVIDENCE, DEEP IMMUTABILITY & SEEDING CONSISTENCY
  // =========================================================================

  it("25. Final evidence memory snapshot contains Sentinel QA finding", async () => {
    const commander = new CommanderAgent({ llm: new MockLLMProvider([]) });
    const builder = new BuilderAgent({ sandbox: mockSandbox, llm: new MockLLMProvider([]) });
    const sentinel = new SentinelAgent({ llm: new MockLLMProvider([]) });

    const plan: MissionPlan = {
      missionId: "mission-evidence-snap",
      title: "Evidence Snapshot Test",
      summary: "Test",
      requirements: [],
      constraints: [],
      tasks: [
        { id: "t1", order: 1, title: "T1", description: "T1", assignedRole: "BUILDER", priority: "HIGH", status: "READY", dependencies: [], requiredCapabilities: [], successCriteria: ["ok"] },
      ],
      estimatedComplexity: "LOW",
      createdAt: new Date().toISOString(),
    };

    vi.spyOn(commander, "plan").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      plan,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
    });

    vi.spyOn(builder, "run").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      finalResponse: "T1 Built",
      iterations: 1,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 0,
      steps: [],
      evidence: { commands: [], stdout: "OK", stderr: "", exitCode: 0, modifiedFiles: [], sandboxId: "sbx-1", timestamps: { startedAt: "", completedAt: "" } },
      patch: {
        id: "p1",
        taskId: "t1",
        missionId: plan.missionId,
        baseRevision: 0,
        files: [
          { path: "package.json", type: "ADDED", content: JSON.stringify({ name: "app", scripts: { test: "vitest run" } }) },
          { path: "src/app.ts", type: "ADDED", content: "export const v = 1;" },
        ],
        createdAt: "",
        authorRole: "BUILDER",
      },
    });

    vi.spyOn(sentinel, "review").mockResolvedValue({
      missionId: plan.missionId,
      status: "SUCCESS",
      review: {
        taskId: "t1",
        decision: "APPROVED",
        summary: "Approved",
        criteriaResults: [{ criterion: "ok", status: "PASS", evidence: "ok", reason: "ok" }],
        issues: [],
        recommendations: [],
        confidence: 1.0,
        reviewedAt: new Date().toISOString(),
      },
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCostUsd: 0,
      durationMs: 10,
    });

    const orchestrator = new LegionOrchestrator({
      commander,
      builder,
      sentinel,
      sandboxProvider: mockSandbox,
      canonicalWorkspace: new InMemoryCanonicalWorkspace(plan.missionId),
    });

    const result = await orchestrator.run({
      missionId: plan.missionId,
      missionPrompt: "Test",
      sandboxId: "sbx-1",
      requireRealExecution: false,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.memorySnapshot).toBeDefined();

    // Verify memory snapshot contains the final QA finding
    const findings = result.memorySnapshot!.sentinelFindings.filter((e) => e.tags.includes("integrated_qa"));
    expect(findings.length).toBeGreaterThan(0);
    const qaData = JSON.parse(findings[0].content);
    expect(qaData.success).toBe(true);
    expect(qaData.validatedRevision).toBe(1);
    expect(qaData.workspaceDigest).toBeDefined();
  });

  it("26. Baseline metadata is deeply isolated and immutable", () => {
    const originalMetadata = {
      packageJson: { name: "original", version: "1.0.0" },
      framework: "next",
    };

    workspace.setBaseline({
      missionId: "m-meta",
      revision: 0,
      files: {},
      metadata: originalMetadata,
    });

    // Mutating the input object after setBaseline
    originalMetadata.packageJson.name = "mutated";

    const retrieved = workspace.getBaseline();
    expect(retrieved?.metadata?.packageJson?.name).toBe("original");
  });

  it("27. Freezing canonical workspace prevents any subsequent mutation", () => {
    workspace.setBaseline({
      missionId: "m-freeze",
      revision: 0,
      files: { "main.ts": "const a = 1;" },
    });

    workspace.freeze();
    expect(workspace.isFrozen()).toBe(true);

    // Attempting to integrate patch on frozen workspace must fail
    const res = workspace.integratePatch({
      id: "p-after-freeze",
      taskId: "t-after",
      missionId: "m-freeze",
      baseRevision: 0,
      files: [{ path: "main.ts", type: "MODIFIED", content: "const a = 2;" }],
      createdAt: new Date().toISOString(),
      authorRole: "BUILDER",
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain("WORKSPACE_FROZEN");
  });

  it("28. Builder baseline seeding failure reports exitCode 1 and consistent error evidence", async () => {
    const failingSandbox = new MockSandboxProvider();
    vi.spyOn(failingSandbox, "writeFile").mockRejectedValue(new Error("DISK_WRITE_FAILURE"));

    const builder = new BuilderAgent({
      sandbox: failingSandbox,
      llm: new MockLLMProvider([]),
    });

    const result = await builder.run({
      missionId: "m-seed-fail",
      taskId: "t-seed",
      taskPrompt: "Build something",
      sandboxId: "sbx-fail",
      baselineSnapshot: {
        missionId: "m-seed-fail",
        taskId: "t-seed",
        baseRevision: 0,
        files: { "broken.txt": "crash" },
        createdAt: new Date().toISOString(),
      },
    });

    expect(result.status).toBe("FAILED");
    expect(result.evidence.exitCode).toBe(1);
    expect(result.evidence.stderr).toContain("BUILDER_MATERIALIZATION_FAILED");
  });
});
