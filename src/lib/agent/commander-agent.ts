// LEGION Phase 03 — COMMANDER Agent Implementation
// Responsible for autonomous mission analysis, requirement extraction, and task graph decomposition

import { z } from "zod";
import { LLMProvider, LLMMessage, LLMToolDefinition } from "../providers/llm";
import { legionEventBus } from "../events/bus";
import { AgentRole, Severity, TaskStatus } from "@/types/domain";
import { sanitizeValue } from "../memory/sanitizer";

export type CommanderState =
  | "IDLE"
  | "ANALYZING"
  | "DECOMPOSING"
  | "PLAN_READY"
  | "FAILED"
  | "CANCELLED";

export interface PlannedTask {
  id: string;
  order: number;
  title: string;
  description: string;
  assignedRole: AgentRole;
  priority: Severity;
  status: TaskStatus;
  dependencies: string[];
  requiredCapabilities: string[];
  successCriteria: string[];
}

export interface MissionPlan {
  missionId: string;
  title: string;
  summary: string;
  requirements: string[];
  constraints: string[];
  tasks: PlannedTask[];
  estimatedComplexity: "LOW" | "MEDIUM" | "HIGH";
  suggestedMaxIterations?: number;
  createdAt: string;
}

export interface CommanderAgentOptions {
  llm: LLMProvider;
  defaultTimeoutMs?: number;
}

export interface CommanderPlanOptions {
  missionId?: string;
  missionPrompt: string;
  projectContext?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  onEvent?: (event: Parameters<typeof legionEventBus.emit>[0]) => void;
  onStateChange?: (state: CommanderState) => void;
}

export interface CommanderPlanResult {
  missionId: string;
  status: "SUCCESS" | "FAILED" | "CANCELLED";
  plan?: MissionPlan;
  totalTokens: { prompt: number; completion: number; total: number };
  totalCostUsd: number;
  durationMs: number;
  error?: string;
}

// Zod Schema for strict validation of LLM outputs
const PlannedTaskSchema = z.object({
  id: z.string().min(1, "Task ID is required"),
  title: z.string().min(1, "Task title is required"),
  description: z.string().min(1, "Task description is required"),
  assignedRole: z.enum(["COMMANDER", "ARCHITECT", "BUILDER", "SENTINEL"]).default("BUILDER"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  dependencies: z.array(z.string()).default([]),
  requiredCapabilities: z.array(z.string()).default([]),
  successCriteria: z.array(z.string()).min(1, "At least one success criterion is required"),
});

const RawMissionPlanSchema = z.object({
  title: z.string().min(1, "Mission title is required"),
  summary: z.string().min(1, "Mission summary is required"),
  requirements: z.array(z.string()).min(1, "At least one requirement must be identified"),
  constraints: z.array(z.string()).default([]),
  estimatedComplexity: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  suggestedMaxIterations: z.number().optional(),
  tasks: z.array(PlannedTaskSchema).min(1, "At least one task must be created"),
});

export const COMMANDER_PLAN_TOOL: LLMToolDefinition = {
  name: "submitMissionPlan",
  description: "Submits the structured mission plan, decomposed task graph, dependencies, and success criteria.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "Concise title of the overall mission" },
      summary: { type: "string", description: "Executive summary of the architectural and implementation strategy" },
      requirements: {
        type: "array",
        items: { type: "string" },
        description: "Key technical, functional, and user requirements identified",
      },
      constraints: {
        type: "array",
        items: { type: "string" },
        description: "Operational, security, or technology constraints",
      },
      estimatedComplexity: {
        type: "string",
        enum: ["LOW", "MEDIUM", "HIGH"],
        description: "Estimated complexity level",
      },
      suggestedMaxIterations: {
        type: "number",
        description: "Suggested iteration limit for the mission execution",
      },
      tasks: {
        type: "array",
        description: "List of decomposed tasks with explicit dependencies and verification criteria",
        items: {
          type: "object",
          properties: {
            id: { type: "string", description: "Unique task identifier (e.g. 'task-1', 'task-2')" },
            title: { type: "string", description: "Action-oriented task title" },
            description: { type: "string", description: "Specific technical details and scope of the task" },
            assignedRole: {
              type: "string",
              enum: ["COMMANDER", "ARCHITECT", "BUILDER", "SENTINEL"],
              description: "The primary agent role assigned to execute this task",
            },
            priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
              description: "Task priority severity",
            },
            dependencies: {
              type: "array",
              items: { type: "string" },
              description: "Array of task IDs that must complete before this task can start",
            },
            requiredCapabilities: {
              type: "array",
              items: { type: "string" },
              description: "Tools or capabilities needed (e.g. writeFile, executeSafeCommand, readFile)",
            },
            successCriteria: {
              type: "array",
              items: { type: "string" },
              description: "Concrete conditions to verify task completion",
            },
          },
          required: [
            "id",
            "title",
            "description",
            "assignedRole",
            "priority",
            "dependencies",
            "requiredCapabilities",
            "successCriteria",
          ],
        },
      },
    },
    required: ["title", "summary", "requirements", "constraints", "estimatedComplexity", "tasks"],
  },
};

export const COMMANDER_SYSTEM_PROMPT = `You are the COMMANDER Agent in LEGION, the elite engineering orchestrator.
Your sole purpose is to analyze user missions, identify core requirements and constraints, and decompose them into an optimal, verifiable task graph.

CRITICAL RESPONSIBILITIES & CONSTRAINTS:
1. SECURITY & ISOLATION:
   - You NEVER write application code directly.
   - You NEVER execute shell commands or interact with sandboxes.
   - You NEVER request or process secrets or API keys.
2. STRUCTURED OUTPUT:
   - You MUST formulate the plan using the 'submitMissionPlan' tool or output a single strictly valid JSON object matching the required schema.
3. TASK GRAPH RULES:
   - Each task must have a unique ID (e.g., 'task-1', 'task-2', 'task-3').
   - Task dependencies MUST be a valid DAG (Directed Acyclic Graph). Never introduce circular dependencies.
   - Every dependency referenced in 'dependencies' must refer to an existing task ID in the plan.
   - Assign appropriate roles:
     * ARCHITECT: Schema design, data models, API contracts, architectural blueprint.
     * BUILDER: Source code implementation, UI components, file writes, bug fixing.
     * SENTINEL: Automated testing, unit/e2e test runs, linting, regression validation.
   - Define concrete, measurable success criteria for each task.
`;

/**
 * Validates the topological integrity and constraints of the planned task graph
 */
export function validateTaskGraph(tasks: PlannedTask[]): { valid: boolean; error?: string } {
  if (tasks.length === 0) {
    return { valid: false, error: "Mission plan must contain at least 1 task." };
  }

  const taskIds = new Set<string>();
  for (const t of tasks) {
    if (taskIds.has(t.id)) {
      return { valid: false, error: `Duplicate task ID detected: "${t.id}"` };
    }
    taskIds.add(t.id);
  }

  // Verify all referenced dependencies exist
  for (const t of tasks) {
    for (const depId of t.dependencies) {
      if (depId === t.id) {
        return { valid: false, error: `Self-referential dependency in task "${t.id}"` };
      }
      if (!taskIds.has(depId)) {
        return {
          valid: false,
          error: `Task "${t.id}" references non-existent dependency "${depId}"`,
        };
      }
    }
  }

  // Detect circular dependencies via DFS cycle detection
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(t.id, [...t.dependencies]);
  }

  const visited = new Map<string, "UNVISITED" | "VISITING" | "VISITED">();
  for (const id of taskIds) {
    visited.set(id, "UNVISITED");
  }

  function hasCycle(node: string, path: string[]): string[] | null {
    visited.set(node, "VISITING");
    const deps = adj.get(node) || [];
    for (const dep of deps) {
      if (visited.get(dep) === "VISITING") {
        return [...path, node, dep];
      }
      if (visited.get(dep) === "UNVISITED") {
        const cycle = hasCycle(dep, [...path, node]);
        if (cycle) return cycle;
      }
    }
    visited.set(node, "VISITED");
    return null;
  }

  for (const id of taskIds) {
    if (visited.get(id) === "UNVISITED") {
      const cycle = hasCycle(id, []);
      if (cycle) {
        return {
          valid: false,
          error: `Circular dependency detected: ${cycle.join(" -> ")}`,
        };
      }
    }
  }

  return { valid: true };
}

export class CommanderAgent {
  private llm: LLMProvider;
  private defaultTimeoutMs: number;

  constructor(options: CommanderAgentOptions) {
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
        console.error("[CommanderAgent] Error in event callback:", err);
      }
    }
  }

  /**
   * Plans a mission and decomposes it into a validated task graph
   */
  async plan(options: CommanderPlanOptions): Promise<CommanderPlanResult> {
    const startTime = Date.now();
    const missionId = options.missionId || `mission-${Date.now()}`;
    const timeoutMs = options.timeoutMs || this.defaultTimeoutMs;
    const signal = options.signal;
    const callback = options.onEvent;
    const onStateChange = options.onStateChange;

    let currentState: CommanderState = "IDLE";
    const updateState = (newState: CommanderState) => {
      currentState = newState;
      onStateChange?.(newState);
    };

    const totalTokens = { prompt: 0, completion: 0, total: 0 };
    let totalCostUsd = 0;

    // Check prompt validity
    if (!options.missionPrompt || options.missionPrompt.trim().length === 0) {
      updateState("FAILED");
      return {
        missionId,
        status: "FAILED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: "Mission prompt cannot be empty.",
      };
    }

    // 1. Initial Analyzing Phase
    updateState("ANALYZING");
    this.emit(
      {
        missionId,
        type: "AGENT_STARTED",
        role: "COMMANDER",
        status: "WORKING",
        currentTaskTitle: "Mission Analysis",
        message: `COMMANDER started analyzing mission: "${options.missionPrompt.slice(0, 100)}"`,
      },
      callback
    );

    this.emit(
      {
        missionId,
        type: "AGENT_THINKING",
        role: "COMMANDER",
        status: "THINKING",
        currentTaskTitle: "Requirement Extraction",
        message: "COMMANDER extracting technical requirements, scope, and system constraints...",
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
        error: "Planning cancelled by user.",
      };
    }

    // 2. Decomposing Phase
    updateState("DECOMPOSING");
    this.emit(
      {
        missionId,
        type: "AGENT_WORKING",
        role: "COMMANDER",
        status: "WORKING",
        currentTaskTitle: "Task Graph Decomposition",
        message: "COMMANDER formulating dependency-aware task graph and verification criteria...",
      },
      callback
    );

    const userPrompt = options.projectContext
      ? `Project Context: ${options.projectContext}\n\nMission Objective: ${options.missionPrompt}`
      : `Mission Objective: ${options.missionPrompt}`;

    const messages: LLMMessage[] = [
      {
        role: "user",
        content: userPrompt,
      },
    ];

    try {
      const llmResult = await this.llm.generate(messages, {
        systemPrompt: COMMANDER_SYSTEM_PROMPT,
        tools: [COMMANDER_PLAN_TOOL],
        timeoutMs,
        abortSignal: signal,
      });

      totalTokens.prompt += llmResult.tokens.prompt;
      totalTokens.completion += llmResult.tokens.completion;
      totalTokens.total += llmResult.tokens.total;
      if (llmResult.costUsd) {
        totalCostUsd += llmResult.costUsd;
      }

      // 3. Extract and parse raw plan object
      let rawData: unknown = null;

      // Check tool calls first
      if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
        const planCall = llmResult.toolCalls.find(
          (tc) => tc.name === "submitMissionPlan" || tc.name.includes("Plan")
        );
        if (planCall) {
          rawData = planCall.arguments;
        }
      }

      // Fallback: parse JSON from text content if not in tool call
      if (!rawData && llmResult.content) {
        const trimmed = llmResult.content.trim();
        try {
          rawData = JSON.parse(trimmed);
        } catch {
          // Look for ```json ... ``` markdown code block
          const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            try {
              rawData = JSON.parse(jsonMatch[1]);
            } catch {
              // Could not parse
            }
          }
        }
      }

      if (!rawData || typeof rawData !== "object") {
        throw new Error(
          "COMMANDER failed to produce structured plan. Invalid or empty output from LLM."
        );
      }

      // 4. Validate with Zod schema
      const parseResult = RawMissionPlanSchema.safeParse(rawData);
      if (!parseResult.success) {
        const formattedErrors = parseResult.error.errors
          .map((e) => `${e.path.join(".")}: ${e.message}`)
          .join("; ");
        throw new Error(`Invalid plan structure: ${formattedErrors}`);
      }

      const validatedRaw = parseResult.data;

      // 5. Convert to domain PlannedTask array and order
      const plannedTasks: PlannedTask[] = validatedRaw.tasks.map((t, index) => ({
        id: t.id,
        order: index + 1,
        title: t.title,
        description: t.description,
        assignedRole: t.assignedRole as AgentRole,
        priority: t.priority as Severity,
        status: t.dependencies.length === 0 ? "READY" : "BACKLOG",
        dependencies: t.dependencies,
        requiredCapabilities: t.requiredCapabilities,
        successCriteria: t.successCriteria,
      }));

      // 6. Validate Graph integrity (no cycles, no missing deps, no duplicates)
      const graphValidation = validateTaskGraph(plannedTasks);
      if (!graphValidation.valid) {
        throw new Error(`Task graph validation failed: ${graphValidation.error}`);
      }

      const finalPlan: MissionPlan = {
        missionId,
        title: validatedRaw.title,
        summary: validatedRaw.summary,
        requirements: validatedRaw.requirements,
        constraints: validatedRaw.constraints,
        tasks: plannedTasks,
        estimatedComplexity: validatedRaw.estimatedComplexity,
        suggestedMaxIterations: validatedRaw.suggestedMaxIterations,
        createdAt: new Date().toISOString(),
      };

      updateState("PLAN_READY");

      this.emit(
        {
          missionId,
          type: "MISSION_PLANNING",
          title: finalPlan.title,
          progressPercent: 10,
          message: `COMMANDER formulated mission plan with ${finalPlan.tasks.length} structured tasks.`,
        },
        callback
      );

      this.emit(
        {
          missionId,
          type: "AGENT_COMPLETED",
          role: "COMMANDER",
          status: "IDLE",
          currentTaskTitle: "Planning Completed",
          message: `COMMANDER plan ready: "${finalPlan.title}" (${finalPlan.tasks.length} tasks)`,
          tokensUsed: totalTokens.total,
        },
        callback
      );

      return {
        missionId,
        status: "SUCCESS",
        plan: finalPlan,
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      if (signal?.aborted) {
        updateState("CANCELLED");
        return {
          missionId,
          status: "CANCELLED",
          totalTokens,
          totalCostUsd,
          durationMs: Date.now() - startTime,
          error: "Planning cancelled by user.",
        };
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      updateState("FAILED");

      this.emit(
        {
          missionId,
          type: "AGENT_FAILED",
          role: "COMMANDER",
          status: "ERROR",
          message: `COMMANDER planning failed: ${errorMessage}`,
        },
        callback
      );

      return {
        missionId,
        status: "FAILED",
        totalTokens,
        totalCostUsd,
        durationMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }
}
