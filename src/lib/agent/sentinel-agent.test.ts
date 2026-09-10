import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SentinelAgent,
  validateSentinelReview,
  SentinelState,
} from "./sentinel-agent";
import { PlannedTask } from "./commander-agent";
import { MockLLMProvider, LLMGenerateResult } from "../providers/llm";

describe("SentinelAgent (Phase 03 QA Gatekeeper)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseTask: PlannedTask = {
    id: "task-auth-01",
    order: 1,
    title: "Implement JWT Authentication",
    description: "Create JWT token generation and validation middleware",
    assignedRole: "BUILDER",
    priority: "HIGH",
    status: "IN_PROGRESS",
    dependencies: [],
    requiredCapabilities: ["writeFile", "executeSafeCommand"],
    successCriteria: [
      "JWT tokens signed with HS256 algorithm",
      "Valid token returns 200 and user claims",
      "Invalid or expired token returns 401 Unauthorized",
    ],
  };

  it("produces an APPROVED decision when all success criteria PASS with evidence", async () => {
    const mockReviewResult: LLMGenerateResult = {
      content: "",
      toolCalls: [
        {
          id: "call_sentinel_1",
          name: "submitSentinelReview",
          arguments: {
            taskId: "task-auth-01",
            decision: "APPROVED",
            summary: "All 3 criteria verified. Code compiles and tests pass with 0 errors.",
            criteriaResults: [
              {
                criterion: "JWT tokens signed with HS256 algorithm",
                status: "PASS",
                evidence: "Verified signToken function uses algorithm: 'HS256' in src/lib/auth.ts",
                reason: "Algorithm explicitly matches security specification.",
              },
              {
                criterion: "Valid token returns 200 and user claims",
                status: "PASS",
                evidence: "Test 'valid token returns 200' passed in 12ms",
                reason: "Endpoint decoded claims correctly.",
              },
              {
                criterion: "Invalid or expired token returns 401 Unauthorized",
                status: "PASS",
                evidence: "Test 'expired token rejected' returned 401 in test suite",
                reason: "Middleware caught expired token exception cleanly.",
              },
            ],
            issues: [],
            recommendations: ["Consider adding rate limiting to token refresh endpoint."],
            confidence: 0.98,
          },
        },
      ],
      tokens: { prompt: 250, completion: 180, total: 430 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
      costUsd: 0.0007,
    };

    const mockLLM = new MockLLMProvider([mockReviewResult]);
    const sentinel = new SentinelAgent({ llm: mockLLM });

    const stateHistory: SentinelState[] = [];
    const eventHistory: string[] = [];

    const result = await sentinel.review({
      missionId: "mission-test-qa",
      task: baseTask,
      builderResult: {
        missionId: "mission-test-qa",
        status: "SUCCESS",
        finalResponse: "Auth implemented and tests passing.",
        iterations: 2,
        totalTokens: { prompt: 100, completion: 50, total: 150 },
        totalCostUsd: 0.0002,
        durationMs: 3000,
        steps: [],
        evidence: {
          commands: [{ command: "npm test", stdout: "PASS src/lib/auth.test.ts (3 tests)\nAll tests passed.", stderr: "", exitCode: 0, durationMs: 10, timestamp: new Date().toISOString() }],
          stdout: "PASS src/lib/auth.test.ts (3 tests)\nAll tests passed.",
          stderr: "",
          exitCode: 0,
          testResults: [{ name: "auth tests", passed: true }],
          modifiedFiles: [{ path: "src/lib/auth.ts", type: "MODIFIED" }],
          sandboxId: "sbx-test",
          timestamps: { startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
        },
      },
      onStateChange: (s) => stateHistory.push(s),
      onEvent: (e) => eventHistory.push(e.type),
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.review).toBeDefined();
    expect(result.review?.decision).toBe("APPROVED");
    expect(result.review?.criteriaResults).toHaveLength(3);
    expect(result.review?.criteriaResults.every((c) => c.status === "PASS")).toBe(true);

    // Verify state machine progression
    expect(stateHistory).toEqual(["ANALYZING", "VERIFYING", "REVIEW_READY"]);

    // Verify observability events
    expect(eventHistory).toContain("AGENT_STARTED");
    expect(eventHistory).toContain("AGENT_THINKING");
    expect(eventHistory).toContain("AGENT_WORKING");
    expect(eventHistory).toContain("TEST_PASSED");
    expect(eventHistory).toContain("AGENT_COMPLETED");
  });

  it("produces a REVISION_REQUIRED decision when a criterion FAILS with actionable issues", async () => {
    const mockReviewResult: LLMGenerateResult = {
      content: "",
      toolCalls: [
        {
          id: "call_sentinel_2",
          name: "submitSentinelReview",
          arguments: {
            taskId: "task-auth-01",
            decision: "REVISION_REQUIRED",
            summary: "Expired token check failed: returns 500 instead of 401 Unauthorized.",
            criteriaResults: [
              {
                criterion: "JWT tokens signed with HS256 algorithm",
                status: "PASS",
                evidence: "Code uses HS256",
                reason: "Confirmed in source code.",
              },
              {
                criterion: "Valid token returns 200 and user claims",
                status: "PASS",
                evidence: "Valid token test passes",
                reason: "Expected claims returned.",
              },
              {
                criterion: "Invalid or expired token returns 401 Unauthorized",
                status: "FAIL",
                evidence: "Unhandled TokenExpiredError resulted in HTTP 500 Internal Server Error",
                reason: "Missing try/catch in token verification middleware.",
              },
            ],
            issues: [
              {
                id: "issue-1",
                title: "Unhandled TokenExpiredError in auth middleware",
                description: "JWT verify threw TokenExpiredError causing 500 response",
                severity: "HIGH",
                affectedFile: "src/lib/auth.ts",
                proposedFix: "Wrap jwt.verify in try/catch and return 401 with { error: 'token_expired' }",
              },
            ],
            recommendations: ["Handle JsonWebTokenError and TokenExpiredError separately."],
            confidence: 0.95,
          },
        },
      ],
      tokens: { prompt: 250, completion: 200, total: 450 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
      costUsd: 0.0008,
    };

    const mockLLM = new MockLLMProvider([mockReviewResult]);
    const sentinel = new SentinelAgent({ llm: mockLLM });

    const eventHistory: string[] = [];

    const result = await sentinel.review({
      task: baseTask,
      builderResult: {
        status: "SUCCESS",
        finalResponse: "Built auth",
      },
      onEvent: (e) => eventHistory.push(e.type),
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.review?.decision).toBe("REVISION_REQUIRED");
    expect(result.review?.issues).toHaveLength(1);
    expect(result.review?.issues[0].severity).toBe("HIGH");
    expect(eventHistory).toContain("TEST_FAILED");
  });

  it("produces a FAILED decision for unrecoverable or broken builds", async () => {
    const mockReviewResult: LLMGenerateResult = {
      content: "",
      toolCalls: [
        {
          id: "call_sentinel_3",
          name: "submitSentinelReview",
          arguments: {
            taskId: "task-auth-01",
            decision: "FAILED",
            summary: "Critical syntax corruption and missing core modules prevent compilation.",
            criteriaResults: [
              {
                criterion: "JWT tokens signed with HS256 algorithm",
                status: "FAIL",
                evidence: "TypeScript compile error TS2307: Cannot find module 'jsonwebtoken'",
                reason: "Missing dependency",
              },
              {
                criterion: "Valid token returns 200 and user claims",
                status: "FAIL",
                evidence: "Code cannot be executed",
                reason: "Build broken",
              },
              {
                criterion: "Invalid or expired token returns 401 Unauthorized",
                status: "FAIL",
                evidence: "Build broken",
                reason: "Build broken",
              },
            ],
            issues: [
              {
                id: "issue-crit-1",
                title: "Missing core auth dependencies and corrupt files",
                description: "Cannot compile codebase",
                severity: "CRITICAL",
              },
            ],
            recommendations: ["Re-scaffold auth module"],
            confidence: 0.99,
          },
        },
      ],
      tokens: { prompt: 200, completion: 150, total: 350 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
    };

    const mockLLM = new MockLLMProvider([mockReviewResult]);
    const sentinel = new SentinelAgent({ llm: mockLLM });

    const result = await sentinel.review({
      task: baseTask,
      builderResult: {
        status: "FAILED",
        finalResponse: "Execution timed out",
      },
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.review?.decision).toBe("FAILED");
    expect(result.review?.issues[0].severity).toBe("CRITICAL");
  });

  it("parses fallback JSON in content when tool call is not emitted", async () => {
    const rawJson = JSON.stringify({
      taskId: "task-auth-01",
      decision: "APPROVED",
      summary: "Direct JSON review passed.",
      criteriaResults: [
        {
          criterion: "JWT tokens signed with HS256 algorithm",
          status: "PASS",
          evidence: "HS256 verified",
          reason: "OK",
        },
        {
          criterion: "Valid token returns 200 and user claims",
          status: "PASS",
          evidence: "Returns 200",
          reason: "OK",
        },
        {
          criterion: "Invalid or expired token returns 401 Unauthorized",
          status: "PASS",
          evidence: "Returns 401",
          reason: "OK",
        },
      ],
      issues: [],
      recommendations: [],
      confidence: 1.0,
    });

    const mockLLM = new MockLLMProvider([
      {
        content: `\`\`\`json\n${rawJson}\n\`\`\``,
        tokens: { prompt: 100, completion: 100, total: 200 },
        finishReason: "stop",
        provider: "mock-llm-provider",
        model: "mock-v1",
      },
    ]);

    const sentinel = new SentinelAgent({ llm: mockLLM });
    const result = await sentinel.review({
      task: baseTask,
      builderResult: { status: "SUCCESS", finalResponse: "Done" },
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.review?.decision).toBe("APPROVED");
    expect(result.review?.summary).toBe("Direct JSON review passed.");
  });

  it("fails when LLM returns invalid JSON or non-parseable output", async () => {
    const mockLLM = new MockLLMProvider([
      {
        content: "I am unable to review the code at this moment.",
        tokens: { prompt: 50, completion: 10, total: 60 },
        finishReason: "stop",
        provider: "mock-llm-provider",
        model: "mock-v1",
      },
    ]);

    const sentinel = new SentinelAgent({ llm: mockLLM });
    const result = await sentinel.review({
      task: baseTask,
      builderResult: { status: "SUCCESS", finalResponse: "Done" },
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("SENTINEL failed to produce structured review");
  });

  it("fails when user cancels execution via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    const mockLLM = new MockLLMProvider([]);
    const sentinel = new SentinelAgent({ llm: mockLLM });

    const result = await sentinel.review({
      task: baseTask,
      builderResult: { status: "SUCCESS", finalResponse: "Done" },
      signal: controller.signal,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.error).toContain("cancelled");
  });

  describe("validateSentinelReview consistency checks", () => {
    it("rejects mismatched taskId", () => {
      const review = {
        taskId: "task-wrong-id",
        decision: "APPROVED" as const,
        summary: "ok",
        criteriaResults: baseTask.successCriteria.map((sc) => ({
          criterion: sc,
          status: "PASS" as const,
          evidence: "ev",
          reason: "rs",
        })),
        issues: [],
        recommendations: [],
        confidence: 1.0,
      };

      const res = validateSentinelReview(baseTask, review);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('does not match target task id "task-auth-01"');
    });

    it("rejects review with unknown/fabricated criterion", () => {
      const review = {
        taskId: "task-auth-01",
        decision: "APPROVED" as const,
        summary: "ok",
        criteriaResults: [
          ...baseTask.successCriteria.map((sc) => ({
            criterion: sc,
            status: "PASS" as const,
            evidence: "ev",
            reason: "rs",
          })),
          {
            criterion: "Invented criterion that was not in task",
            status: "PASS" as const,
            evidence: "ev",
            reason: "rs",
          },
        ],
        issues: [],
        recommendations: [],
        confidence: 1.0,
      };

      const res = validateSentinelReview(baseTask, review);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("does not exist in task successCriteria");
    });

    it("rejects review with duplicate criterion evaluation", () => {
      const review = {
        taskId: "task-auth-01",
        decision: "APPROVED" as const,
        summary: "ok",
        criteriaResults: [
          {
            criterion: baseTask.successCriteria[0],
            status: "PASS" as const,
            evidence: "ev1",
            reason: "rs1",
          },
          {
            criterion: baseTask.successCriteria[0], // Duplicate
            status: "PASS" as const,
            evidence: "ev2",
            reason: "rs2",
          },
        ],
        issues: [],
        recommendations: [],
        confidence: 1.0,
      };

      const res = validateSentinelReview(baseTask, review);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Duplicate evaluation for criterion");
    });

    it("rejects review missing evaluations for some criteria", () => {
      const review = {
        taskId: "task-auth-01",
        decision: "APPROVED" as const,
        summary: "ok",
        criteriaResults: [
          {
            criterion: baseTask.successCriteria[0],
            status: "PASS" as const,
            evidence: "ev",
            reason: "rs",
          },
        ], // missing criteria 1 and 2
        issues: [],
        recommendations: [],
        confidence: 1.0,
      };

      const res = validateSentinelReview(baseTask, review);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Missing evaluation for task criterion");
    });

    it("rejects inconsistent decision: APPROVED with FAIL status", () => {
      const review = {
        taskId: "task-auth-01",
        decision: "APPROVED" as const,
        summary: "Approved despite failure",
        criteriaResults: [
          {
            criterion: baseTask.successCriteria[0],
            status: "PASS" as const,
            evidence: "ev",
            reason: "rs",
          },
          {
            criterion: baseTask.successCriteria[1],
            status: "PASS" as const,
            evidence: "ev",
            reason: "rs",
          },
          {
            criterion: baseTask.successCriteria[2],
            status: "FAIL" as const,
            evidence: "Failed",
            reason: "Failed",
          },
        ],
        issues: [],
        recommendations: [],
        confidence: 0.9,
      };

      const res = validateSentinelReview(baseTask, review);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Decision cannot be "APPROVED" when one or more criteria have status "FAIL"');
    });

    it("rejects inconsistent decision: APPROVED with UNKNOWN status", () => {
      const review = {
        taskId: "task-auth-01",
        decision: "APPROVED" as const,
        summary: "Approved despite unknown",
        criteriaResults: [
          {
            criterion: baseTask.successCriteria[0],
            status: "PASS" as const,
            evidence: "ev",
            reason: "rs",
          },
          {
            criterion: baseTask.successCriteria[1],
            status: "UNKNOWN" as const,
            evidence: "Could not determine",
            reason: "No logs",
          },
          {
            criterion: baseTask.successCriteria[2],
            status: "PASS" as const,
            evidence: "ev",
            reason: "rs",
          },
        ],
        issues: [],
        recommendations: [],
        confidence: 0.8,
      };

      const res = validateSentinelReview(baseTask, review);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Decision cannot be "APPROVED" when criteria status is "UNKNOWN"');
    });
  });
});
