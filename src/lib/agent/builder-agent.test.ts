import { describe, it, expect, beforeEach } from "vitest";
import { BuilderAgent } from "./builder-agent";
import { MockLLMProvider } from "../providers/llm";
import { MockSandboxProvider } from "../providers/sandbox";
import { E2BSandboxProvider } from "../providers/e2b-sandbox";
import { getLLMProvider } from "../providers";

describe("BuilderAgent Unit Tests", () => {
  let mockSandbox: MockSandboxProvider;
  let mockLLM: MockLLMProvider;

  beforeEach(() => {
    mockSandbox = new MockSandboxProvider();
    mockLLM = new MockLLMProvider();
  });

  it("completes engineering task successfully in multi-turn tool execution", async () => {
    const sandboxInstance = await mockSandbox.create();

    mockLLM.enqueueResponse({
      content: "Writing source file hello.ts",
      toolCalls: [
        {
          id: "call_1",
          name: "writeFile",
          arguments: {
            path: "hello.ts",
            content: 'console.log("LEGION ONLINE");\n',
          },
        },
      ],
      tokens: { prompt: 100, completion: 40, total: 140 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
      costUsd: 0.0001,
    });

    mockLLM.enqueueResponse({
      content: "Executing hello.ts to verify output",
      toolCalls: [
        {
          id: "call_2",
          name: "executeSafeCommand",
          arguments: {
            command: "node hello.ts",
          },
        },
      ],
      tokens: { prompt: 120, completion: 30, total: 150 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
      costUsd: 0.0001,
    });

    mockLLM.enqueueResponse({
      content: "Task verified successfully: hello.ts printed LEGION ONLINE.",
      tokens: { prompt: 150, completion: 20, total: 170 },
      finishReason: "stop",
      provider: "mock-llm-provider",
      model: "mock-v1",
      costUsd: 0.0001,
    });

    const agent = new BuilderAgent({
      sandbox: mockSandbox,
      llm: mockLLM,
      defaultMaxIterations: 5,
    });

    const events: Array<{ type: string; message?: string }> = [];
    const result = await agent.run({
      missionId: "mission-test-01",
      taskPrompt: "Create hello.ts that prints LEGION ONLINE and verify it runs.",
      sandboxId: sandboxInstance.id,
      onEvent: (evt) => events.push(evt as { type: string; message?: string }),
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.iterations).toBe(3);
    expect(result.totalTokens.total).toBe(460);
    expect(result.finalResponse).toContain("Task verified successfully");

    // Verify file was written in sandbox
    const content = await mockSandbox.readFile(sandboxInstance.id, "hello.ts");
    expect(content).toBe('console.log("LEGION ONLINE");\n');

    // Verify events were emitted
    expect(events.some((e) => e.type === "AGENT_STARTED")).toBe(true);
    expect(events.some((e) => e.type === "FILE_CREATED")).toBe(true);
    expect(events.some((e) => e.type === "EXECUTION_STARTED")).toBe(true);
    expect(events.some((e) => e.type === "AGENT_COMPLETED")).toBe(true);
  });

  it("handles self-correction scenario (failure -> fix -> pass)", async () => {
    const sandboxInstance = await mockSandbox.create();

    // Turn 1: Write broken syntax
    mockLLM.enqueueResponse({
      content: "Creating initial file",
      toolCalls: [
        {
          id: "call_broken",
          name: "writeFile",
          arguments: {
            path: "hello.ts",
            content: "console.log(BROKEN SYNTAX);\n",
          },
        },
      ],
      tokens: { prompt: 100, completion: 30, total: 130 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
    });

    // Turn 2: Attempt execution (simulated failure or inspect error)
    mockLLM.enqueueResponse({
      content: "Fixing syntax error",
      toolCalls: [
        {
          id: "call_fixed",
          name: "writeFile",
          arguments: {
            path: "hello.ts",
            content: 'console.log("LEGION ONLINE");\n',
          },
        },
      ],
      tokens: { prompt: 140, completion: 40, total: 180 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
    });

    // Turn 3: Execute fixed file
    mockLLM.enqueueResponse({
      content: "Executing corrected file",
      toolCalls: [
        {
          id: "call_exec",
          name: "executeSafeCommand",
          arguments: {
            command: "node hello.ts",
          },
        },
      ],
      tokens: { prompt: 160, completion: 30, total: 190 },
      finishReason: "tool_calls",
      provider: "mock-llm-provider",
      model: "mock-v1",
    });

    // Turn 4: Complete
    mockLLM.enqueueResponse({
      content: "Self-correction succeeded. Output confirmed.",
      tokens: { prompt: 180, completion: 20, total: 200 },
      finishReason: "stop",
      provider: "mock-llm-provider",
      model: "mock-v1",
    });

    const agent = new BuilderAgent({
      sandbox: mockSandbox,
      llm: mockLLM,
    });

    const result = await agent.run({
      taskPrompt: "Create hello.ts, fix any error, and confirm output.",
      sandboxId: sandboxInstance.id,
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.iterations).toBe(4);

    const finalContent = await mockSandbox.readFile(sandboxInstance.id, "hello.ts");
    expect(finalContent).toBe('console.log("LEGION ONLINE");\n');
  });

  it("terminates with failure when max iterations limit is reached", async () => {
    const sandboxInstance = await mockSandbox.create();

    // Enqueue endless tool calls
    for (let i = 0; i < 5; i++) {
      mockLLM.enqueueResponse({
        content: `Iteration ${i + 1}`,
        toolCalls: [
          {
            id: `call_${i}`,
            name: "listFiles",
            arguments: {},
          },
        ],
        tokens: { prompt: 50, completion: 20, total: 70 },
        finishReason: "tool_calls",
        provider: "mock-llm-provider",
        model: "mock-v1",
      });
    }

    const agent = new BuilderAgent({
      sandbox: mockSandbox,
      llm: mockLLM,
      defaultMaxIterations: 3,
    });

    const result = await agent.run({
      taskPrompt: "Endless task",
      sandboxId: sandboxInstance.id,
      maxIterations: 3,
    });

    expect(result.status).toBe("FAILED");
    expect(result.error).toBe("EXECUTION_LIMIT_REACHED");
    expect(result.iterations).toBe(3);
  });

  it("handles user cancellation via AbortSignal", async () => {
    const sandboxInstance = await mockSandbox.create();
    const controller = new AbortController();
    controller.abort();

    const agent = new BuilderAgent({
      sandbox: mockSandbox,
      llm: mockLLM,
    });

    const result = await agent.run({
      taskPrompt: "Cancelled task",
      sandboxId: sandboxInstance.id,
      signal: controller.signal,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.error).toBe("EXECUTION_CANCELLED");
  });
});

describe("Builder Live Integration (Conditional)", () => {
  const isRealKey = (key?: string) =>
    Boolean(
      key &&
        key.trim().length > 0 &&
        !key.includes("sua_chave") &&
        !key.includes("your_") &&
        !key.includes("placeholder")
    );

  const hasLLMKey =
    isRealKey(process.env.GEMINI_API_KEY) ||
    isRealKey(process.env.GOOGLE_API_KEY) ||
    isRealKey(process.env.ANTHROPIC_API_KEY) ||
    isRealKey(process.env.OPENAI_API_KEY) ||
    isRealKey(process.env.LLM_API_KEY);

  const hasE2BKey = isRealKey(process.env.E2B_API_KEY);

  it.skipIf(!hasLLMKey || !hasE2BKey)(
    "executes live Builder agent task on real LLM + real E2B Sandbox",
    async () => {
      const sandboxProvider = new E2BSandboxProvider();
      const llmProvider = getLLMProvider();

      const instance = await sandboxProvider.create();
      try {
        const agent = new BuilderAgent({
          sandbox: sandboxProvider,
          llm: llmProvider,
          defaultMaxIterations: 8,
        });

        const result = await agent.run({
          taskPrompt: "Create a file hello.ts that prints LEGION ONLINE, execute it with node, and verify the output.",
          sandboxId: instance.id,
        });

        expect(result.status).toBe("SUCCESS");
        expect(result.totalTokens.total).toBeGreaterThan(0);

        const content = await sandboxProvider.readFile(instance.id, "hello.ts");
        expect(content).toContain("LEGION ONLINE");
      } finally {
        await sandboxProvider.destroy(instance.id);
      }
    },
    90000
  );
});
