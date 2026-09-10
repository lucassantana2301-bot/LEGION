// LEGION Phase 09.5 — Hardened SENTINEL Agent Implementation
// Gatekeeper verifying actual ExecutionEvidence, rejecting unverified builder narrative claims

import { z } from "zod";
import { LLMProvider, LLMMessage, LLMToolDefinition } from "../providers/llm";
import { legionEventBus } from "../events/bus";
import { PlannedTask } from "./commander-agent";
import { BuilderRunResult } from "./builder-agent";
import { Severity } from "@/types/domain";
import { ExecutionEvidence } from "./evidence";
import { sanitizeValue } from "../memory/sanitizer";

export type SentinelDecision = "APPROVED" | "REVISION_REQUIRED" | "FAILED";

export type SentinelState =
  | "IDLE"
  | "ANALYZING"
  | "VERIFYING"
  | "REVIEW_READY"
  | "FAILED"
  | "CANCELLED";

export interface CriterionEvaluation {
  criterion: string;
  status: "PASS" | "FAIL" | "UNKNOWN";
  evidence: string;
  reason: string;
}

export interface SentinelIssue {
  id: string;
  title: string;
  description: string;
  severity: "INFO" | Severity;
  affectedFile?: string;
  proposedFix?: string;
}

export interface SentinelReview {
  taskId: string;
  decision: SentinelDecision;
  summary: string;
  criteriaResults: CriterionEvaluation[];
  issues: SentinelIssue[];
  recommendations: string[];
  confidence: number;
  reviewedAt: string;
}

export interface SentinelAgentOptions {
  llm: LLMProvider;
  defaultTimeoutMs?: number;
}

export interface SentinelReviewOptions {
  missionId?: string;
  task: PlannedTask;
  builderResult: BuilderRunResult | {
    status: string;
    finalResponse: string;
    steps?: unknown[];
    error?: string;
  };
  evidence?: ExecutionEvidence;
  executionEvidence?: ExecutionEvidence | string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onEvent?: (event: Parameters<typeof legionEventBus.emit>[0]) => void;
  onStateChange?: (state: SentinelState) => void;
}

export interface SentinelReviewResult {
  missionId: string;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
  review?: SentinelReview;
  totalTokens: { prompt: number; completion: number; total: number };
  totalCostUsd: number;
  durationMs: number;
  error?: string;
}

// Zod Schema for Sentinel review validation
const CriterionEvaluationSchema = z.object({
  criterion: z.string().min(1, "Criterion description is required"),
  status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  evidence: z.string().min(1, "Evidence is required for evaluation"),
  reason: z.string().min(1, "Reasoning is required for evaluation"),
});

const SentinelIssueSchema = z.object({
  id: z.string().min(1, "Issue ID is required"),
  title: z.string().min(1, "Issue title is required"),
  description: z.string().min(1, "Issue description is required"),
  severity: z.enum(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  affectedFile: z.string().optional(),
  proposedFix: z.string().optional(),
});

const RawSentinelReviewSchema = z.object({
  taskId: z.string().min(1, "Task ID is required"),
  decision: z.enum(["APPROVED", "REVISION_REQUIRED", "FAILED"]),
  summary: z.string().min(1, "Review summary is required"),
  criteriaResults: z.array(CriterionEvaluationSchema).min(1, "Criteria results are required"),
  issues: z.array(SentinelIssueSchema).default([]),
  recommendations: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(1.0),
});

export const SENTINEL_REVIEW_TOOL: LLMToolDefinition = {
  name: "submitSentinelReview",
  description: "Submits the rigorous QA verification verdict, evaluated success criteria, and issues for a task based on verified execution evidence.",
  parameters: {
    type: "object",
    properties: {
      taskId: { type: "string", description: "The ID of the task being reviewed" },
      decision: {
        type: "string",
        enum: ["APPROVED", "REVISION_REQUIRED", "FAILED"],
        description: "The QA gatekeeping decision: APPROVED (all criteria pass with real evidence), REVISION_REQUIRED (recoverable defects), FAILED (fatal/unrecoverable)",
      },
      summary: {
        type: "string",
        description: "Executive summary of the QA review findings and verification rationale backed by evidence",
      },
      criteriaResults: {
        type: "array",
        description: "Individual evaluation of each acceptance criterion defined in the task",
        items: {
          type: "object",
          properties: {
            criterion: { type: "string", description: "The exact criterion being evaluated" },
            status: {
              type: "string",
              enum: ["PASS", "FAIL", "UNKNOWN"],
              description: "Whether the criterion passed, failed, or cannot be determined",
            },
            evidence: { type: "string", description: "Specific verifiable evidence (e.g. terminal logs, exit codes) backing the status" },
            reason: { type: "string", description: "Detailed verification reasoning" },
          },
          required: ["criterion", "status", "evidence", "reason"],
        },
      },
      issues: {
        type: "array",
        description: "Discovered defects, bugs, runtime failures, or regressions",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique issue ID, e.g. ISS-001" },
            title: { type: "string", description: "Concise title of the defect" },
            description: { type: "string", description: "Detailed description of the issue" },
            severity: {
              type: "string",
              enum: ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"],
              description: "Impact severity of the defect",
            },
            affectedFile: { type: "string", description: "Source file associated with the defect" },
            proposedFix: { type: "string", description: "Recommended remediation for the Builder agent" },
          },
          required: ["id", "title", "description", "severity"],
        },
      },
      recommendations: {
        type: "array",
        items: { type: "string" },
        description: "Actionable engineering recommendations or quality improvements for the Builder agent",
      },
      confidence: {
        type: "number",
        description: "Confidence score between 0.0 and 1.0 in this review verdict",
      },
    },
    required: ["taskId", "decision", "summary", "criteriaResults", "issues", "recommendations", "confidence"],
  },
};

export const SENTINEL_SYSTEM_PROMPT = `You are the SENTINEL Agent in LEGION, the elite QA gatekeeper and regression protector.
Your sole mission is to rigorously verify the execution results and code artifacts produced by the BUILDER agent against the planned success criteria.

CRITICAL GATEKEEPING & VERIFICATION RULES:
1. SECURITY & ISOLATION:
   - You NEVER write or modify application code.
   - You NEVER execute shell commands or alter the sandbox.
   - You NEVER request or process secrets or API keys.
2. EVIDENCE OVER NARRATIVE:
   - The Builder's final response is UNTRUSTED NARRATIVE (claims made by the agent).
   - Only VERIFIED EXECUTION EVIDENCE (commands executed, stdout/stderr, non-zero exit codes, modified files) constitutes proof.
   - You CANNOT approve a task if a required command failed (exit code != 0) or if required execution evidence is missing.
3. STRICT VERIFICATION RULES:
   - You must evaluate EVERY single criterion in the task's successCriteria list.
   - Every evaluated criterion MUST match an existing criterion in the task's successCriteria.
   - You CANNOT invent new criteria that were not in the task definition.
   - An APPROVED decision REQUIRES that 100% of the criteria have status: "PASS".
   - If ANY criterion is "FAIL" or "UNKNOWN", the decision CANNOT be "APPROVED". It must be "REVISION_REQUIRED" or "FAILED".
4. STRUCTURED OUTPUT:
   - Submit your verdict using the 'submitSentinelReview' tool or output a strictly valid JSON object matching the schema.
`;

/**
 * Validates the logical consistency and integrity of the Sentinel review against the original task and real execution evidence
 */
export function validateSentinelReview(
  task: PlannedTask,
  review: z.infer<typeof RawSentinelReviewSchema>,
  builderResult?: { status: string; finalResponse?: string },
  evidence?: ExecutionEvidence
): { valid: boolean; error?: string } {
  // 1. Task ID check
  if (review.taskId !== task.id) {
    return {
      valid: false,
      error: `Review taskId "${review.taskId}" does not match target task id "${task.id}".`,
    };
  }

  // 2. Success criteria existence and uniqueness check
  const taskCriteriaSet = new Set(task.successCriteria);
  const reviewedCriteriaSet = new Set<string>();

  for (const cr of review.criteriaResults) {
    if (reviewedCriteriaSet.has(cr.criterion)) {
      return {
        valid: false,
        error: `Duplicate evaluation for criterion: "${cr.criterion}".`,
      };
    }
    reviewedCriteriaSet.add(cr.criterion);

    if (!taskCriteriaSet.has(cr.criterion)) {
      return {
        valid: false,
        error: `Evaluated criterion "${cr.criterion}" does not exist in task successCriteria.`,
      };
    }
  }

  // Check that all task success criteria were evaluated
  for (const tc of task.successCriteria) {
    if (!reviewedCriteriaSet.has(tc)) {
      return {
        valid: false,
        error: `Missing evaluation for task criterion: "${tc}".`,
      };
    }
  }

  // 3. Decision consistency check
  const hasFail = review.criteriaResults.some((c) => c.status === "FAIL");
  const hasUnknown = review.criteriaResults.some((c) => c.status === "UNKNOWN");

  if (review.decision === "APPROVED") {
    if (hasFail) {
      return {
        valid: false,
        error: `Inconsistent review: Decision cannot be "APPROVED" when one or more criteria have status "FAIL".`,
      };
    }
    if (hasUnknown) {
      return {
        valid: false,
        error: `Inconsistent review: Decision cannot be "APPROVED" when criteria status is "UNKNOWN".`,
      };
    }

    // Builder failure cannot be approved
    if (builderResult && builderResult.status !== "SUCCESS") {
      return {
        valid: false,
        error: `Inconsistent review: Decision cannot be "APPROVED" when Builder execution status was "${builderResult.status}".`,
      };
    }

    // P0-02 (A): Zero-command bypass
    // If task criteria require execution/tests or code was modified, evidence.commands cannot be empty.
    const requiresExecution =
      task.successCriteria.some((c) =>
        /test|build|run|verify|compile|typecheck|execution|pass|lint/i.test(c)
      ) ||
      (evidence?.modifiedFiles && evidence.modifiedFiles.length > 0);

    if (requiresExecution && (!evidence || !evidence.commands || evidence.commands.length === 0)) {
      return {
        valid: false,
        error: `Inconsistent review: Decision cannot be "APPROVED" without objective execution evidence (zero commands executed for task requiring verification or modifying code).`,
      };
    }

    // P0-02 (B): Failed test / failed command + trivial successful command bypass
    if (evidence) {
      // Aggregate exit code check
      if (typeof evidence.exitCode === "number" && evidence.exitCode !== 0) {
        return {
          valid: false,
          error: `Inconsistent review: Decision cannot be "APPROVED" when execution evidence ends in non-zero exit code (${evidence.exitCode}).`,
        };
      }

      // Explicit test results check
      if (evidence.testResults && evidence.testResults.some((t) => !t.passed)) {
        return {
          valid: false,
          error: `Inconsistent review: Decision cannot be "APPROVED" when test results contain failures.`,
        };
      }

      // Detailed commands check
      if (evidence.commands && evidence.commands.length > 0) {
        const trivialCmdRegex = /^(echo|pwd|ls|dir|true|whoami|cat\b|date)\b/i;
        const failedCmds = evidence.commands.filter((c) => c.exitCode !== 0);

        if (failedCmds.length > 0) {
          const lastCmd = evidence.commands[evidence.commands.length - 1];
          const nonTrivialCmds = evidence.commands.filter(
            (c) => !trivialCmdRegex.test(c.command.trim())
          );
          const lastNonTrivial = nonTrivialCmds[nonTrivialCmds.length - 1];

          // If the last non-trivial command failed OR the last command overall failed
          if (lastCmd.exitCode !== 0 || (lastNonTrivial && lastNonTrivial.exitCode !== 0)) {
            const failedRef = lastNonTrivial || lastCmd;
            return {
              valid: false,
              error: `Inconsistent review: Decision cannot be "APPROVED" when execution evidence contains unresolved command failure ("${failedRef.command}" exited with ${failedRef.exitCode}). Trivial commands cannot mask failures.`,
            };
          }

          // If a verification/test/build command specifically failed and wasn't followed by a successful verification command
          const failedTestCmd = failedCmds.find((c) =>
            /test|build|tsc|typecheck|vitest|jest|pytest|npm run/i.test(c.command)
          );
          if (failedTestCmd) {
            const failedIndex = evidence.commands.indexOf(failedTestCmd);
            const laterSuccessfulTest = evidence.commands
              .slice(failedIndex + 1)
              .some((c) => c.exitCode === 0 && !trivialCmdRegex.test(c.command.trim()));
            if (!laterSuccessfulTest) {
              return {
                valid: false,
                error: `Inconsistent review: Decision cannot be "APPROVED" when execution evidence contains unresolved test/build failure ("${failedTestCmd.command}" exited with ${failedTestCmd.exitCode}).`,
              };
            }
          }
        }
      }
    }
  }

  if (review.decision !== "APPROVED" && !hasFail && !hasUnknown && review.issues.length === 0) {
    return {
      valid: false,
      error: `Inconsistent review: Decision is "${review.decision}" but all criteria passed and no issues were reported.`,
    };
  }

  return { valid: true };
}

export class SentinelAgent {
  private llm: LLMProvider;
  private defaultTimeoutMs: number;

  constructor(options: SentinelAgentOptions) {
    this.llm = options.llm;
    this.defaultTimeoutMs = options.defaultTimeoutMs || 60_000;
  }

  private emit(
    payload: Parameters<typeof legionEventBus.emit>[0],
    callback?: (event: Parameters<typeof legionEventBus.emit>[0]) => void
  ) {
    const sanitized = sanitizeValue(payload);
    legionEventBus.emit(sanitized);
    if (callback) {
      try {
        callback(sanitized);
      } catch (err) {
        console.error("[SentinelAgent] Error in event callback:", err);
      }
    }
  }

  /**
   * Reviews a completed task and builder execution result against success criteria and real execution evidence
   */
  async review(options: SentinelReviewOptions): Promise<SentinelReviewResult> {
    const startTime = Date.now();
    const missionId = options.missionId || "mission-001";
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const signal = options.signal;
    const callback = options.onEvent;
    const onStateChange = options.onStateChange;

    let currentState: SentinelState = "IDLE";
    const updateState = (newState: SentinelState) => {
      currentState = newState;
      onStateChange?.(newState);
    };

    const totalTokens = { prompt: 0, completion: 0, total: 0 };
    let totalCostUsd = 0;

    // Validate input task
    if (!options.task || !options.task.id) {
      updateState("FAILED");
      return {
        missionId,
        status: "FAILED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: "Task definition is missing or invalid.",
      };
    }

    if (!options.task.successCriteria || options.task.successCriteria.length === 0) {
      updateState("FAILED");
      return {
        missionId,
        status: "FAILED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: `Task "${options.task.id}" has no defined successCriteria to verify.`,
      };
    }

    // 1. Initial Analyzing Phase
    updateState("ANALYZING");
    this.emit(
      {
        missionId,
        type: "AGENT_STARTED",
        role: "SENTINEL",
        status: "WORKING",
        currentTaskTitle: `QA Review: ${options.task.title}`,
        message: `SENTINEL started QA review for task "${options.task.id}": "${options.task.title}"`,
      },
      callback
    );

    this.emit(
      {
        missionId,
        type: "AGENT_THINKING",
        role: "SENTINEL",
        status: "THINKING",
        currentTaskTitle: `Analyzing Evidence: ${options.task.title}`,
        message: "SENTINEL analyzing verified sandbox execution evidence and acceptance criteria...",
      },
      callback
    );

    if (signal?.aborted) {
      updateState("CANCELLED");
      return {
        missionId,
        status: "CANCELLED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: "Review cancelled by user.",
      };
    }

    // 2. Verifying Phase
    updateState("VERIFYING");
    this.emit(
      {
        missionId,
        type: "AGENT_WORKING",
        role: "SENTINEL",
        status: "WORKING",
        currentTaskTitle: `Verifying Criteria: ${options.task.title}`,
        message: `SENTINEL evaluating ${options.task.successCriteria.length} success criteria against verified execution telemetry...`,
      },
      callback
    );

    // Extract execution evidence
    const evidence: ExecutionEvidence | undefined =
      options.evidence ||
      (typeof options.executionEvidence === "object" && options.executionEvidence !== null
        ? (options.executionEvidence as ExecutionEvidence)
        : (options.builderResult as any).evidence);

    const formattedCommandLogs =
      evidence?.commands && evidence.commands.length > 0
        ? evidence.commands
            .map(
              (c, i) =>
                `[Command ${i + 1}] $ ${c.command}\nExit Code: ${c.exitCode}\nStdout:\n${c.stdout || "(empty)"}\nStderr:\n${c.stderr || "(empty)"}`
            )
            .join("\n\n")
        : typeof options.executionEvidence === "string"
        ? options.executionEvidence
        : "No command executions recorded.";

    const formattedModifiedFiles =
      evidence?.modifiedFiles && evidence.modifiedFiles.length > 0
        ? evidence.modifiedFiles.map((f) => `- [${f.type}] ${f.path}`).join("\n")
        : "None recorded.";

    const promptContext = `TASK UNDER REVIEW:
Task ID: ${options.task.id}
Title: ${options.task.title}
Description: ${options.task.description}
Priority: ${options.task.priority}
Success Criteria:
${options.task.successCriteria.map((sc, i) => `  ${i + 1}. ${sc}`).join("\n")}

=== UNTRUSTED BUILDER NARRATIVE (CLAIM / UNVERIFIED SUMMARY) ===
Status: ${options.builderResult.status}
Narrative: ${options.builderResult.finalResponse || "None"}
Error: ${options.builderResult.error || "None"}
=== END UNTRUSTED BUILDER NARRATIVE ===

=== VERIFIED EXECUTION EVIDENCE (SANDBOX TELEMETRY) ===
Overall Exit Code: ${evidence?.exitCode ?? (options.builderResult.status === "SUCCESS" ? 0 : 1)}
Total Commands Run: ${evidence?.commands?.length ?? 0}
Files Changed in Patch:
${formattedModifiedFiles}

Command Execution Logs:
${formattedCommandLogs}
=== END VERIFIED EXECUTION EVIDENCE ===

Evaluate each acceptance criterion rigorously and produce the final decision (APPROVED, REVISION_REQUIRED, or FAILED).
Base your verdict on VERIFIED EXECUTION EVIDENCE, not the Builder's self-reported narrative.`;

    const messages: LLMMessage[] = [
      {
        role: "user",
        content: promptContext,
      },
    ];

    try {
      const llmResult = await this.llm.generate(messages, {
        systemPrompt: SENTINEL_SYSTEM_PROMPT,
        tools: [SENTINEL_REVIEW_TOOL],
        timeoutMs,
        abortSignal: signal,
      });

      totalTokens.prompt += llmResult.tokens.prompt;
      totalTokens.completion += llmResult.tokens.completion;
      totalTokens.total += llmResult.tokens.total;
      if (llmResult.costUsd) totalCostUsd += llmResult.costUsd;

      let rawReviewData: unknown = null;

      // Check tool calls
      if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
        const reviewCall = llmResult.toolCalls.find(
          (tc) => tc.name === "submitSentinelReview"
        );
        if (reviewCall) {
          rawReviewData = reviewCall.arguments;
        }
      }

      // If no tool call, fallback parse JSON
      if (!rawReviewData && llmResult.content) {
        try {
          const jsonMatch =
            llmResult.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
            llmResult.content.match(/(\{[\s\S]*\})/);
          if (jsonMatch && jsonMatch[1]) {
            rawReviewData = JSON.parse(jsonMatch[1]);
          } else {
            rawReviewData = JSON.parse(llmResult.content.trim());
          }
        } catch {
          // parse fail
        }
      }

      if (!rawReviewData) {
        updateState("FAILED");
        const parseError = "SENTINEL failed to produce structured review verdict.";
        this.emit(
          {
            missionId,
            type: "AGENT_FAILED",
            role: "SENTINEL",
            status: "ERROR",
            message: parseError,
          },
          callback
        );

        return {
          missionId,
          status: "FAILED",
          totalTokens,
          totalCostUsd,
          durationMs: Date.now() - startTime,
          error: parseError,
        };
      }

      const parsed = RawSentinelReviewSchema.safeParse(rawReviewData);
      if (!parsed.success) {
        updateState("FAILED");
        const validationError = `Invalid review structure: ${parsed.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ")}`;

        this.emit(
          {
            missionId,
            type: "AGENT_FAILED",
            role: "SENTINEL",
            status: "ERROR",
            message: validationError,
          },
          callback
        );

        return {
          missionId,
          status: "FAILED",
          totalTokens,
          totalCostUsd,
          durationMs: Date.now() - startTime,
          error: validationError,
        };
      }

      // Validate review logic against task and evidence
      const consistency = validateSentinelReview(
        options.task,
        parsed.data,
        options.builderResult,
        evidence
      );

      if (!consistency.valid) {
        updateState("FAILED");
        const consistencyError = consistency.error || "Inconsistent Sentinel review verdict.";

        this.emit(
          {
            missionId,
            type: "AGENT_FAILED",
            role: "SENTINEL",
            status: "ERROR",
            message: consistencyError,
          },
          callback
        );

        return {
          missionId,
          status: "FAILED",
          totalTokens,
          totalCostUsd,
          durationMs: Date.now() - startTime,
          error: consistencyError,
        };
      }

      const review: SentinelReview = {
        taskId: parsed.data.taskId,
        decision: parsed.data.decision,
        summary: parsed.data.summary,
        criteriaResults: parsed.data.criteriaResults,
        issues: parsed.data.issues as SentinelIssue[],
        recommendations: parsed.data.recommendations,
        confidence: parsed.data.confidence,
        reviewedAt: new Date().toISOString(),
      };

      updateState("REVIEW_READY");

      if (review.decision === "APPROVED") {
        this.emit(
          {
            missionId,
            type: "TEST_PASSED",
            taskId: options.task.id,
            suiteName: options.task.title,
            agentRole: "SENTINEL",
            message: `SENTINEL Verdict: [APPROVED] ${review.summary}`,
          },
          callback
        );
      } else {
        this.emit(
          {
            missionId,
            type: "TEST_FAILED",
            taskId: options.task.id,
            suiteName: options.task.title,
            agentRole: "SENTINEL",
            message: `SENTINEL Verdict: [${review.decision}] ${review.summary}`,
          },
          callback
        );
      }

      this.emit(
        {
          missionId,
          type: "AGENT_COMPLETED",
          role: "SENTINEL",
          status: "IDLE",
          message: `Sentinel completed review for task "${options.task.id}" (${review.decision})`,
        },
        callback
      );

      return {
        missionId,
        status: "SUCCESS",
        review,
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      updateState("FAILED");
      const errorMsg = err instanceof Error ? err.message : String(err);

      this.emit(
        {
          missionId,
          type: "AGENT_FAILED",
          role: "SENTINEL",
          status: "ERROR",
          message: `Sentinel QA review failed: ${errorMsg}`,
        },
        callback
      );

      return {
        missionId,
        status: "FAILED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }
}
