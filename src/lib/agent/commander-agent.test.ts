import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommanderAgent, validateTaskGraph, PlannedTask, CommanderState } from "./commander-agent";
import { MockLLMProvider, LLMGenerateResult } from "../providers/llm";
import { legionEventBus } from "../events/bus";

describe("CommanderAgent (Phase 03 Orchestrator Planning)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("plans a simple mission into a structured task graph", async () => {
    const mockPlanResult: LLMGenerateResult = {
      content: "",
      toolCalls: [
        {
          id: "call_plan_1",
          name: "submitMissionPlan",
          arguments: {
            title: "Build Landing Page",
            summary: "Create responsive Next.js landing page with Tailwind",
            requirements: ["Hero section", "Feature grid", "Responsive navigation"],
            constraints: ["No external UI libraries", "Pure Tailwind CSS"],
            estimatedComplexity: "LOW",
            tasks: [
              {
                id: "task-1",
                title: "Define component architecture",
                description: "Map out Hero, Features, and Footer components",
                assignedRole: "ARCHITECT",
                priority: "HIGH",
                dependencies: [],
                requiredCapabilities: ["readFile"],
                successCriteria: ["Component hierarchy documented"],
              },
              {
                id: "task-2",
                title: "Implement Hero and Features",
                description: "Create Next.js components in src/components",
                assignedRole: "BUILDER",
                priority: "HIGH",
                dependencies: ["task-1"],
                requiredCapabilities: ["writeFile", "executeSafeCommand"],
                successCriteria: ["Components render without syntax errors"],
              },
            ],
          },
        },
      ],
      tokens: { prompt: 200, completion: 150, total: 350 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
      costUsd: 0.0005,
    };

    const mockLLM = new MockLLMProvider([mockPlanResult]);
    const commander = new CommanderAgent({ llm: mockLLM });

    const stateHistory: CommanderState[] = [];
    const eventHistory: string[] = [];

    const result = await commander.plan({
      missionId: "mission-test-01",
      missionPrompt: "Create a modern landing page",
      onStateChange: (state) => stateHistory.push(state),
      onEvent: (evt) => eventHistory.push(evt.type),
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan).toBeDefined();
    expect(result.plan?.title).toBe("Build Landing Page");
    expect(result.plan?.tasks).toHaveLength(2);

    // Initial statuses
    expect(result.plan?.tasks[0].status).toBe("READY"); // 0 dependencies
    expect(result.plan?.tasks[1].status).toBe("BACKLOG"); // has dependencies
    expect(result.plan?.tasks[1].dependencies).toEqual(["task-1"]);

    // State machine progression
    expect(stateHistory).toEqual(["ANALYZING", "DECOMPOSING", "PLAN_READY"]);

    // Observability events
    expect(eventHistory).toContain("AGENT_STARTED");
    expect(eventHistory).toContain("AGENT_THINKING");
    expect(eventHistory).toContain("AGENT_WORKING");
    expect(eventHistory).toContain("MISSION_PLANNING");
    expect(eventHistory).toContain("AGENT_COMPLETED");
  });

  it("plans a complex multi-agent mission with ARCHITECT, BUILDER, and SENTINEL roles", async () => {
    const complexPlanResult: LLMGenerateResult = {
      content: "",
      toolCalls: [
        {
          id: "call_complex_1",
          name: "submitMissionPlan",
          arguments: {
            title: "Build Auth & API Microservice",
            summary: "Implement JWT auth service with PostgreSQL storage and unit test verification",
            requirements: ["JWT Authentication", "PostgreSQL Drizzle schema", "Rate limiting"],
            constraints: ["TypeScript strict mode", "E2B micro-VM sandbox execution"],
            estimatedComplexity: "HIGH",
            suggestedMaxIterations: 15,
            tasks: [
              {
                id: "task-arch-1",
                title: "Design Auth & User Schemas",
                description: "Specify database schema for users and refresh tokens",
                assignedRole: "ARCHITECT",
                priority: "CRITICAL",
                dependencies: [],
                requiredCapabilities: ["readFile"],
                successCriteria: ["Drizzle schema contracts defined with strict typing"],
              },
              {
                id: "task-build-1",
                title: "Implement Auth Service & Endpoints",
                description: "Create auth middleware, token signing, and login endpoints",
                assignedRole: "BUILDER",
                priority: "HIGH",
                dependencies: ["task-arch-1"],
                requiredCapabilities: ["writeFile", "executeSafeCommand"],
                successCriteria: ["Endpoints return 200 on valid credentials and 401 on invalid"],
              },
              {
                id: "task-qa-1",
                title: "Verify Auth Integration & Security Tests",
                description: "Run automated security test suite and check token expiration",
                assignedRole: "SENTINEL",
                priority: "HIGH",
                dependencies: ["task-build-1"],
                requiredCapabilities: ["executeSafeCommand"],
                successCriteria: ["All unit and integration tests pass with 0 failures"],
              },
            ],
          },
        },
      ],
      tokens: { prompt: 350, completion: 280, total: 630 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
      costUsd: 0.0012,
    };

    const mockLLM = new MockLLMProvider([complexPlanResult]);
    const commander = new CommanderAgent({ llm: mockLLM });

    const result = await commander.plan({
      missionPrompt: "Build authenticated API with tests",
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.estimatedComplexity).toBe("HIGH");
    expect(result.plan?.suggestedMaxIterations).toBe(15);
    expect(result.plan?.tasks).toHaveLength(3);

    const roles = result.plan?.tasks.map((t) => t.assignedRole);
    expect(roles).toEqual(["ARCHITECT", "BUILDER", "SENTINEL"]);

    // Verify dependency chain
    expect(result.plan?.tasks[0].dependencies).toEqual([]);
    expect(result.plan?.tasks[1].dependencies).toEqual(["task-arch-1"]);
    expect(result.plan?.tasks[2].dependencies).toEqual(["task-build-1"]);
  });

  it("handles fallback JSON in LLM text content instead of tool call", async () => {
    const rawJson = JSON.stringify({
      title: "Direct JSON Plan",
      summary: "Plan output directly as JSON in content",
      requirements: ["Feature A"],
      constraints: ["Constraint 1"],
      estimatedComplexity: "MEDIUM",
      tasks: [
        {
          id: "task-direct-1",
          title: "Implement Feature A",
          description: "Write code for feature A",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          dependencies: [],
          requiredCapabilities: ["writeFile"],
          successCriteria: ["Feature A works"],
        },
      ],
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

    const commander = new CommanderAgent({ llm: mockLLM });
    const result = await commander.plan({ missionPrompt: "Build Feature A" });

    expect(result.status).toBe("SUCCESS");
    expect(result.plan?.title).toBe("Direct JSON Plan");
    expect(result.plan?.tasks[0].id).toBe("task-direct-1");
  });

  it("fails gracefully when LLM returns invalid JSON or non-parseable output", async () => {
    const mockLLM = new MockLLMProvider([
      {
        content: "I cannot formulate a plan right now. Sorry!",
        tokens: { prompt: 50, completion: 10, total: 60 },
        finishReason: "stop",
        provider: "mock-llm-provider",
        model: "mock-v1",
      },
    ]);

    const commander = new CommanderAgent({ llm: mockLLM });
    const result = await commander.plan({ missionPrompt: "Do something" });

    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("COMMANDER failed to produce structured plan");
  });

  it("fails when mission prompt is empty", async () => {
    const mockLLM = new MockLLMProvider([]);
    const commander = new CommanderAgent({ llm: mockLLM });

    const result = await commander.plan({ missionPrompt: "   " });
    expect(result.status).toBe("FAILED");
    expect(result.error).toContain("Mission prompt cannot be empty");
  });

  it("fails when user cancels execution via AbortSignal", async () => {
    const controller = new AbortController();
    controller.abort();

    const mockLLM = new MockLLMProvider([]);
    const commander = new CommanderAgent({ llm: mockLLM });

    const result = await commander.plan({
      missionPrompt: "Build something",
      signal: controller.signal,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.error).toContain("cancelled");
  });

  describe("validateTaskGraph integrity checks", () => {
    it("detects empty task list", () => {
      const res = validateTaskGraph([]);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("at least 1 task");
    });

    it("detects duplicate task IDs", () => {
      const tasks: PlannedTask[] = [
        {
          id: "task-1",
          order: 1,
          title: "Task 1",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "READY",
          dependencies: [],
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
        {
          id: "task-1",
          order: 2,
          title: "Task 1 duplicate",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "READY",
          dependencies: [],
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
      ];

      const res = validateTaskGraph(tasks);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Duplicate task ID detected: "task-1"');
    });

    it("detects non-existent dependencies", () => {
      const tasks: PlannedTask[] = [
        {
          id: "task-1",
          order: 1,
          title: "Task 1",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "BACKLOG",
          dependencies: ["task-999"], // Does not exist
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
      ];

      const res = validateTaskGraph(tasks);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('references non-existent dependency "task-999"');
    });

    it("detects self-referential dependencies", () => {
      const tasks: PlannedTask[] = [
        {
          id: "task-1",
          order: 1,
          title: "Task 1",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "BACKLOG",
          dependencies: ["task-1"], // Self reference
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
      ];

      const res = validateTaskGraph(tasks);
      expect(res.valid).toBe(false);
      expect(res.error).toContain('Self-referential dependency in task "task-1"');
    });

    it("detects circular dependencies (2-node cycle: A -> B -> A)", () => {
      const tasks: PlannedTask[] = [
        {
          id: "task-A",
          order: 1,
          title: "Task A",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "BACKLOG",
          dependencies: ["task-B"],
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
        {
          id: "task-B",
          order: 2,
          title: "Task B",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "BACKLOG",
          dependencies: ["task-A"],
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
      ];

      const res = validateTaskGraph(tasks);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Circular dependency detected");
    });

    it("detects circular dependencies (3-node cycle: A -> B -> C -> A)", () => {
      const tasks: PlannedTask[] = [
        {
          id: "task-1",
          order: 1,
          title: "Task 1",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "BACKLOG",
          dependencies: ["task-3"],
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
        {
          id: "task-2",
          order: 2,
          title: "Task 2",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "BACKLOG",
          dependencies: ["task-1"],
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
        {
          id: "task-3",
          order: 3,
          title: "Task 3",
          description: "desc",
          assignedRole: "BUILDER",
          priority: "MEDIUM",
          status: "BACKLOG",
          dependencies: ["task-2"],
          requiredCapabilities: [],
          successCriteria: ["pass"],
        },
      ];

      const res = validateTaskGraph(tasks);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Circular dependency detected");
    });
  });
});
