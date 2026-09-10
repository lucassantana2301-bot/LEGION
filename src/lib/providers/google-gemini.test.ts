import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  GoogleGeminiLLMProvider,
  LLMMessage,
  LLMToolDefinition,
  LLMError,
} from "./llm";

describe("GoogleGeminiLLMProvider (Native Tool Calling & Lifecycle)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws LLMError MISSING_API_KEY when no API key is provided", async () => {
    const provider = new GoogleGeminiLLMProvider("", "gemini-2.5-flash");
    await expect(
      provider.generate([{ role: "user", content: "Hello" }])
    ).rejects.toThrowError(LLMError);
  });

  it("formats tools, system prompt, and parses native functionCall response from Gemini", async () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              { text: "I need to write a file first." },
              {
                functionCall: {
                  name: "writeFile",
                  args: {
                    path: "src/index.ts",
                    content: 'console.log("LEGION Online");',
                  },
                },
              },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: {
        promptTokenCount: 120,
        candidatesTokenCount: 45,
        totalTokenCount: 165,
      },
    };

    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};

    global.fetch = vi.fn().mockImplementation(async (url, init) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => mockGeminiResponse,
      };
    });

    const provider = new GoogleGeminiLLMProvider("test-gemini-key", "gemini-2.5-flash");

    const tools: LLMToolDefinition[] = [
      {
        name: "writeFile",
        description: "Writes a file to workspace",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
        },
      },
    ];

    const result = await provider.generate(
      [{ role: "user", content: "Create src/index.ts" }],
      {
        systemPrompt: "You are LEGION Builder Agent.",
        tools,
      }
    );

    // Verify Gemini API endpoint and query key
    expect(capturedUrl).toContain("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
    expect(capturedUrl).toContain("key=test-gemini-key");

    // Verify body structure
    expect(capturedBody.systemInstruction).toEqual({
      parts: [{ text: "You are LEGION Builder Agent." }],
    });
    expect(capturedBody.tools).toEqual([
      {
        functionDeclarations: [
          {
            name: "writeFile",
            description: "Writes a file to workspace",
            parameters: tools[0].parameters,
          },
        ],
      },
    ]);

    // Verify parsed output
    expect(result.content).toBe("I need to write a file first.");
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls![0].name).toBe("writeFile");
    expect(result.toolCalls![0].arguments).toEqual({
      path: "src/index.ts",
      content: 'console.log("LEGION Online");',
    });
    expect(result.finishReason).toBe("tool_calls");
    expect(result.tokens.total).toBe(165);
    expect(result.provider).toBe("google-gemini-llm-provider");
  });

  it("handles multi-turn tool calling cycle: user -> model tool call -> tool result -> final answer", async () => {
    let callCount = 0;
    const bodiesCaptured: Array<Record<string, unknown>> = [];

    global.fetch = vi.fn().mockImplementation(async (_url, init) => {
      callCount++;
      const body = JSON.parse(init.body);
      bodiesCaptured.push(body);

      if (callCount === 1) {
        // Step 1: Model decides to call tool
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "executeSafeCommand",
                        args: { command: "node -v" },
                      },
                    },
                  ],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20, totalTokenCount: 70 },
          }),
        };
      } else {
        // Step 2: Model receives tool result and provides final response
        return {
          ok: true,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    { text: "Node.js v20.18.0 is installed and active in the sandbox." },
                  ],
                },
                finishReason: "STOP",
              },
            ],
            usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 25, totalTokenCount: 115 },
          }),
        };
      }
    });

    const provider = new GoogleGeminiLLMProvider("test-gemini-key", "gemini-2.5-flash");

    // Turn 1: User asks question
    const messages: LLMMessage[] = [
      { role: "user", content: "Check Node version" },
    ];

    const turn1Result = await provider.generate(messages, {
      tools: [
        {
          name: "executeSafeCommand",
          description: "Executes command",
          parameters: { type: "object", properties: { command: { type: "string" } } },
        },
      ],
    });

    expect(turn1Result.toolCalls).toBeDefined();
    expect(turn1Result.toolCalls![0].name).toBe("executeSafeCommand");

    // Turn 2: Append Assistant tool call + Tool execution result
    messages.push({
      role: "assistant",
      content: turn1Result.content,
      toolCalls: turn1Result.toolCalls,
    });

    messages.push({
      role: "tool",
      name: "executeSafeCommand",
      toolCallId: turn1Result.toolCalls![0].id,
      content: "v20.18.0\n",
    });

    const turn2Result = await provider.generate(messages);

    expect(turn2Result.content).toContain("Node.js v20.18.0 is installed");
    expect(turn2Result.toolCalls).toBeUndefined();
    expect(turn2Result.finishReason).toBe("stop");

    // Verify multi-turn contents format sent to Gemini API in Turn 2
    const turn2Body = bodiesCaptured[1];
    const contents = turn2Body.contents as Array<{ role: string; parts: Array<Record<string, unknown>> }>;
    expect(contents).toHaveLength(3);
    expect(contents[0].role).toBe("user");
    expect(contents[0].parts[0]).toEqual({ text: "Check Node version" });

    expect(contents[1].role).toBe("model");
    expect(contents[1].parts[0]).toEqual({
      functionCall: {
        name: "executeSafeCommand",
        args: { command: "node -v" },
      },
    });

    expect(contents[2].role).toBe("user");
    expect(contents[2].parts[0]).toEqual({
      functionResponse: {
        name: "executeSafeCommand",
        response: {
          name: "executeSafeCommand",
          output: "v20.18.0\n",
        },
      },
    });
  });
});

describe("Google Gemini Live Integration (Conditional)", () => {
  const isRealKey = (key?: string) =>
    Boolean(
      key &&
        key.trim().length > 0 &&
        !key.includes("sua_chave") &&
        !key.includes("your_") &&
        !key.includes("placeholder")
    );

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const hasRealGeminiKey = isRealKey(geminiKey);

  it.skipIf(!hasRealGeminiKey)(
    "performs live Gemini function calling round-trip with real Google Generative Language API",
    async () => {
      const provider = new GoogleGeminiLLMProvider(geminiKey, "gemini-2.5-flash");

      const result = await provider.generate(
        [{ role: "user", content: "What is 40 + 2? Use calculateSum if needed." }],
        {
          tools: [
            {
              name: "calculateSum",
              description: "Calculates the sum of two numbers",
              parameters: {
                type: "object",
                properties: {
                  a: { type: "number" },
                  b: { type: "number" },
                },
                required: ["a", "b"],
              },
            },
          ],
        }
      );

      expect(result.tokens.total).toBeGreaterThan(0);
      expect(result.provider).toBe("google-gemini-llm-provider");
    },
    30000
  );
});
