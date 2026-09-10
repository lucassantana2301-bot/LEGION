// LEGION Phase 07 — ARCHITECT Agent Implementation
// Responsible for technical requirement analysis, modular boundary definition, interface contracts, and architectural blueprints

import { z } from "zod";
import { LLMProvider, LLMMessage, LLMToolDefinition } from "../providers/llm";
import { legionEventBus } from "../events/bus";
import { PlannedTask } from "./commander-agent";
import { Severity } from "@/types/domain";
import { sanitizeValue } from "../memory/sanitizer";

export type ArchitectState =
  | "IDLE"
  | "ANALYZING"
  | "DESIGNING"
  | "ARCHITECTURE_READY"
  | "FAILED"
  | "CANCELLED";

export interface ArchitectureComponent {
  name: string;
  purpose: string;
  responsibilities: string[];
  files?: string[];
}

export interface ArchitectureInterface {
  name: string;
  description: string;
  definition: string;
  consumers?: string[];
}

export interface ArchitectureDependency {
  name: string;
  type: "INTERNAL" | "EXTERNAL" | "RUNTIME";
  purpose: string;
  versionOrConstraint?: string;
}

export interface ArchitectureRisk {
  risk: string;
  severity: Severity;
  mitigation: string;
}

export interface ArchitecturePlan {
  taskId: string;
  summary: string;
  approach: string;
  components: ArchitectureComponent[];
  interfaces: ArchitectureInterface[];
  dependencies: ArchitectureDependency[];
  risks: ArchitectureRisk[];
  constraints: string[];
  implementationSteps: string[];
  validationStrategy: string;
  createdAt: string;
}

export interface ArchitectAgentOptions {
  llm: LLMProvider;
  defaultTimeoutMs?: number;
}

export interface ArchitectDesignOptions {
  missionId?: string;
  taskId?: string;
  task?: PlannedTask;
  missionPrompt?: string;
  projectContext?: string;
  technicalRequirements?: string[];
  constraints?: string[];
  signal?: AbortSignal;
  timeoutMs?: number;
  onEvent?: (event: Parameters<typeof legionEventBus.emit>[0]) => void;
  onStateChange?: (state: ArchitectState) => void;
}

export interface ArchitectDesignResult {
  missionId: string;
  taskId: string;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
  plan?: ArchitecturePlan;
  totalTokens: { prompt: number; completion: number; total: number };
  totalCostUsd: number;
  durationMs: number;
  error?: string;
}

// Zod Schemas for strict validation
const ArchitectureComponentSchema = z.object({
  name: z.string().min(1, "Component name is required"),
  purpose: z.string().min(1, "Component purpose is required"),
  responsibilities: z.array(z.string()).default([]),
  files: z.array(z.string()).optional().default([]),
});

const ArchitectureInterfaceSchema = z.object({
  name: z.string().min(1, "Interface name is required"),
  description: z.string().min(1, "Interface description is required"),
  definition: z.string().min(1, "Interface definition is required"),
  consumers: z.array(z.string()).optional().default([]),
});

const ArchitectureDependencySchema = z.object({
  name: z.string().min(1, "Dependency name is required"),
  type: z.enum(["INTERNAL", "EXTERNAL", "RUNTIME"]).default("INTERNAL"),
  purpose: z.string().min(1, "Dependency purpose is required"),
  versionOrConstraint: z.string().optional(),
});

const ArchitectureRiskSchema = z.object({
  risk: z.string().min(1, "Risk description is required"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  mitigation: z.string().min(1, "Mitigation strategy is required"),
});

export const ArchitecturePlanSchema = z.object({
  taskId: z.string().default("task-arch"),
  summary: z.string().min(1, "Architecture summary is required"),
  approach: z.string().min(1, "Architecture approach is required"),
  components: z.array(ArchitectureComponentSchema).default([]),
  interfaces: z.array(ArchitectureInterfaceSchema).default([]),
  dependencies: z.array(ArchitectureDependencySchema).default([]),
  risks: z.array(ArchitectureRiskSchema).default([]),
  constraints: z.array(z.string()).default([]),
  implementationSteps: z.array(z.string()).default([]),
  validationStrategy: z.string().min(1, "Validation strategy is required"),
  createdAt: z.string().optional(),
});

export const ARCHITECT_TOOL_DEFINITIONS: LLMToolDefinition[] = [
  {
    name: "submitArchitecturePlan",
    description:
      "Submit the structured architecture design plan specifying modular components, boundaries, interface contracts, dependencies, and implementation steps.",
    parameters: {
      type: "object",
      properties: {
        taskId: {
          type: "string",
          description: "ID of the architecture task being planned.",
        },
        summary: {
          type: "string",
          description: "Executive technical summary of the architectural strategy.",
        },
        approach: {
          type: "string",
          description: "Detailed description of the architectural pattern, paradigms, and design decisions.",
        },
        components: {
          type: "array",
          description: "List of architectural modules and components to create or modify.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              purpose: { type: "string" },
              responsibilities: { type: "array", items: { type: "string" } },
              files: { type: "array", items: { type: "string" } },
            },
            required: ["name", "purpose", "responsibilities"],
          },
        },
        interfaces: {
          type: "array",
          description: "TypeScript interfaces, API routes, or data contracts to establish.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              definition: { type: "string" },
              consumers: { type: "array", items: { type: "string" } },
            },
            required: ["name", "description", "definition"],
          },
        },
        dependencies: {
          type: "array",
          description: "Internal and external dependencies required for implementation.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", enum: ["INTERNAL", "EXTERNAL", "RUNTIME"] },
              purpose: { type: "string" },
              versionOrConstraint: { type: "string" },
            },
            required: ["name", "type", "purpose"],
          },
        },
        risks: {
          type: "array",
          description: "Identified architectural risks, bottlenecks, or security hazards with mitigations.",
          items: {
            type: "object",
            properties: {
              risk: { type: "string" },
              severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
              mitigation: { type: "string" },
            },
            required: ["risk", "severity", "mitigation"],
          },
        },
        constraints: {
          type: "array",
          items: { type: "string" },
          description: "Technical, security, and performance constraints.",
        },
        implementationSteps: {
          type: "array",
          items: { type: "string" },
          description: "Ordered, deterministic step-by-step instructions for the Builder agent.",
        },
        validationStrategy: {
          type: "string",
          description: "Strategy and verification methods (unit tests, contract tests, smoke tests) to validate architecture.",
        },
      },
      required: [
        "summary",
        "approach",
        "components",
        "interfaces",
        "dependencies",
        "risks",
        "implementationSteps",
        "validationStrategy",
      ],
    },
  },
];

export const ARCHITECT_SYSTEM_PROMPT = `You are the ARCHITECT Agent in LEGION, an elite autonomous software systems architect.

Your primary mission is to formulate rigorous, production-grade technical designs, module boundaries, data contracts, and implementation strategies BEFORE complex engineering execution begins.

Core Rules & Responsibilities:
1. You do NOT write code files or execute bash commands directly. You output a structured ArchitecturePlan.
2. Formulate clear module boundaries, separation of concerns, and robust TypeScript interface contracts.
3. Identify external and internal dependencies and potential bottlenecks.
4. Detect technical and security risks early and specify concrete mitigations.
5. Provide deterministic, ordered implementation steps that the BUILDER agent can execute with precision.
6. Always call the tool 'submitArchitecturePlan' with the structured architecture specification.
7. If tools are unavailable, output ONLY a valid JSON object matching the ArchitecturePlan schema.`;

export class ArchitectAgent {
  private llm: LLMProvider;
  private defaultTimeoutMs: number;
  private currentState: ArchitectState = "IDLE";

  constructor(options: ArchitectAgentOptions) {
    this.llm = options.llm;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? 60_000;
  }

  public getState(): ArchitectState {
    return this.currentState;
  }

  private setState(
    newState: ArchitectState,
    onStateChange?: (state: ArchitectState) => void
  ) {
    this.currentState = newState;
    onStateChange?.(newState);
  }

  private emitEvent(
    payload: Parameters<typeof legionEventBus.emit>[0],
    callback?: (event: Parameters<typeof legionEventBus.emit>[0]) => void
  ) {
    const sanitized = sanitizeValue(payload);
    legionEventBus.emit(sanitized);
    if (callback) {
      try {
        callback(sanitized);
      } catch (err) {
        console.error("[ArchitectAgent] Error in event callback:", err);
      }
    }
  }

  /**
   * Designs architectural blueprints and data contracts for a given mission/task
   */
  async design(options: ArchitectDesignOptions): Promise<ArchitectDesignResult> {
    const startTime = Date.now();
    const missionId = options.missionId || `mission-${Date.now()}`;
    const taskId = options.taskId || options.task?.id || `arch-${Date.now()}`;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const signal = options.signal;
    const onEvent = options.onEvent;
    const onStateChange = options.onStateChange;

    const totalTokens = { prompt: 0, completion: 0, total: 0 };
    let totalCostUsd = 0;

    this.setState("IDLE", onStateChange);

    if (signal?.aborted) {
      this.setState("CANCELLED", onStateChange);
      return {
        missionId,
        taskId,
        status: "CANCELLED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: "EXECUTION_CANCELLED",
      };
    }

    try {
      // 1. ANALYZING Phase
      this.setState("ANALYZING", onStateChange);
      this.emitEvent(
        {
          missionId,
          type: "AGENT_WORKING",
          role: "ARCHITECT",
          status: "WORKING",
          currentTaskTitle: options.task?.title || "Architecture Analysis",
          message: `ARCHITECT analyzing system specifications & modular requirements for task "${taskId}"`,
        },
        onEvent
      );

      // Build User Prompt
      let userPrompt = `TASK SPECIFICATION FOR ARCHITECTURAL DESIGN:\n`;
      userPrompt += `Task ID: ${taskId}\n`;
      if (options.task) {
        userPrompt += `Title: ${options.task.title}\n`;
        userPrompt += `Description: ${options.task.description}\n`;
        userPrompt += `Priority: ${options.task.priority}\n`;
        if (options.task.requiredCapabilities?.length) {
          userPrompt += `Required Capabilities: ${options.task.requiredCapabilities.join(", ")}\n`;
        }
        if (options.task.successCriteria?.length) {
          userPrompt += `Acceptance Criteria:\n${options.task.successCriteria.map((c, i) => `  ${i + 1}. ${c}`).join("\n")}\n`;
        }
      }

      if (options.missionPrompt) {
        userPrompt += `\nOVERALL MISSION DIRECTIVE:\n${options.missionPrompt}\n`;
      }

      if (options.projectContext) {
        userPrompt += `\nPROJECT & REPOSITORY CONTEXT:\n${options.projectContext}\n`;
      }

      if (options.technicalRequirements && options.technicalRequirements.length > 0) {
        userPrompt += `\nTECHNICAL REQUIREMENTS:\n${options.technicalRequirements.map((r, i) => `  ${i + 1}. ${r}`).join("\n")}\n`;
      }

      if (options.constraints && options.constraints.length > 0) {
        userPrompt += `\nCONSTRAINTS:\n${options.constraints.map((c, i) => `  - ${c}`).join("\n")}\n`;
      }

      userPrompt += `\nPlease formulate a comprehensive, robust ArchitecturePlan for this task. Call the tool submitArchitecturePlan.`;

      // 2. DESIGNING Phase
      this.setState("DESIGNING", onStateChange);
      this.emitEvent(
        {
          missionId,
          type: "AGENT_THINKING",
          role: "ARCHITECT",
          status: "THINKING",
          currentTaskTitle: options.task?.title || "Interface & Module Design",
          message: `ARCHITECT designing component boundaries, interfaces, and validation strategy.`,
        },
        onEvent
      );

      const messages: LLMMessage[] = [
        { role: "user", content: userPrompt },
      ];

      // Execute LLM Call with timeout and cancellation
      const response = await this.llm.generate(messages, {
        systemPrompt: ARCHITECT_SYSTEM_PROMPT,
        tools: ARCHITECT_TOOL_DEFINITIONS,
        temperature: 0.1,
        timeoutMs,
        abortSignal: signal,
      });

      if (signal?.aborted) {
        this.setState("CANCELLED", onStateChange);
        return {
          missionId,
          taskId,
          status: "CANCELLED",
          totalTokens,
          totalCostUsd,
          durationMs: Date.now() - startTime,
          error: "EXECUTION_CANCELLED",
        };
      }

      totalTokens.prompt += response.tokens.prompt;
      totalTokens.completion += response.tokens.completion;
      totalTokens.total += response.tokens.total;
      if (response.costUsd) {
        totalCostUsd += response.costUsd;
      }

      // 3. Extract and Validate ArchitecturePlan
      let rawPlan: unknown = null;

      if (response.toolCalls && response.toolCalls.length > 0) {
        const toolCall = response.toolCalls.find(
          (tc) => tc.name === "submitArchitecturePlan"
        );
        if (toolCall) {
          rawPlan = toolCall.arguments;
        }
      }

      if (!rawPlan && response.content) {
        rawPlan = this.extractJsonFallback(response.content);
      }

      if (!rawPlan) {
        throw new Error(
          "ARCHITECT failed to generate a structured ArchitecturePlan (no tool call or parseable JSON)."
        );
      }

      // Inject defaults if omitted by LLM
      if (typeof rawPlan === "object" && rawPlan !== null) {
        const obj = rawPlan as Record<string, unknown>;
        if (!obj.taskId) obj.taskId = taskId;
        if (!obj.createdAt) obj.createdAt = new Date().toISOString();
      }

      // Parse with Zod
      const parseResult = ArchitecturePlanSchema.safeParse(rawPlan);
      if (!parseResult.success) {
        const errorDetails = parseResult.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        throw new Error(`Invalid ArchitecturePlan structure: ${errorDetails}`);
      }

      const plan: ArchitecturePlan = {
        ...parseResult.data,
        taskId: parseResult.data.taskId || taskId,
        createdAt: parseResult.data.createdAt || new Date().toISOString(),
      };

      // 4. ARCHITECTURE_READY Phase
      this.setState("ARCHITECTURE_READY", onStateChange);
      this.emitEvent(
        {
          missionId,
          type: "AGENT_COMPLETED",
          role: "ARCHITECT",
          status: "IDLE",
          currentTaskTitle: options.task?.title || "Architecture Plan Ready",
          message: `ARCHITECT finalized blueprint: "${plan.summary}" (${plan.components.length} components, ${plan.interfaces.length} interfaces, ${plan.implementationSteps.length} steps).`,
        },
        onEvent
      );

      return {
        missionId,
        taskId,
        status: "SUCCESS",
        plan,
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.setState("FAILED", onStateChange);
      this.emitEvent(
        {
          missionId,
          type: "AGENT_FAILED",
          role: "ARCHITECT",
          status: "ERROR",
          currentTaskTitle: options.task?.title || "Architecture Design Failed",
          message: `ARCHITECT failed: ${errorMsg}`,
        },
        onEvent
      );

      return {
        missionId,
        taskId,
        status: "FAILED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: errorMsg,
      };
    }
  }

  /**
   * Safe fallback JSON parser for unstructured markdown responses
   */
  private extractJsonFallback(content: string): unknown {
    try {
      // 1. Check markdown fenced json blocks
      const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)```/i;
      const match = content.match(jsonBlockRegex);
      if (match && match[1]) {
        return JSON.parse(match[1].trim());
      }

      // 2. Try parsing first outer { ... }
      const firstBrace = content.indexOf("{");
      const lastBrace = content.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const potentialJson = content.slice(firstBrace, lastBrace + 1);
        return JSON.parse(potentialJson);
      }

      // 3. Fallback direct parse
      return JSON.parse(content.trim());
    } catch {
      return null;
    }
  }
}
