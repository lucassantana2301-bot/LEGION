// LLM Provider Abstraction Interface and Implementations for LEGION

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMGenerateOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: LLMToolDefinition[];
  systemPrompt?: string;
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

export interface LLMGenerateResult {
  content: string;
  toolCalls?: LLMToolCall[];
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  finishReason: "stop" | "tool_calls" | "length" | "error" | "aborted";
  provider: string;
  model: string;
  costUsd?: number;
}

export interface LLMProvider {
  name: string;
  generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMGenerateResult>;
  stream(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
    onChunk?: (chunk: string) => void
  ): Promise<LLMGenerateResult>;
}

export class LLMError extends Error {
  public readonly code: string;
  public readonly provider: string;

  constructor(message: string, provider: string, code: string = "LLM_ERROR") {
    super(message);
    this.name = "LLMError";
    this.provider = provider;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const m = model.toLowerCase();
  let inputRatePerM = 3.0;
  let outputRatePerM = 15.0;

  if (m.includes("gemini")) {
    inputRatePerM = 0.075;
    outputRatePerM = 0.3;
  } else if (m.includes("haiku")) {
    inputRatePerM = 0.8;
    outputRatePerM = 4.0;
  } else if (m.includes("opus")) {
    inputRatePerM = 15.0;
    outputRatePerM = 75.0;
  } else if (m.includes("gpt-4o-mini")) {
    inputRatePerM = 0.15;
    outputRatePerM = 0.6;
  } else if (m.includes("gpt-4o")) {
    inputRatePerM = 2.5;
    outputRatePerM = 10.0;
  }

  const cost = (promptTokens / 1_000_000) * inputRatePerM + (completionTokens / 1_000_000) * outputRatePerM;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Google Gemini API Provider with native Function/Tool calling
 */
export class GoogleGeminiLLMProvider implements LLMProvider {
  public readonly name = "google-gemini-llm-provider";
  private apiKey?: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = "gemini-2.5-flash") {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.LLM_API_KEY;
    this.defaultModel = process.env.LLM_MODEL || defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new LLMError("Google Gemini API key is not configured.", this.name, "MISSING_API_KEY");
    }

    if (options?.abortSignal?.aborted) {
      return {
        content: "",
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: "aborted",
        provider: this.name,
        model: options?.model || this.defaultModel,
      };
    }

    const model = options?.model || this.defaultModel;

    // Convert messages to Gemini format
    const contents: Array<{ role: string; parts: Array<Record<string, unknown>> }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        continue;
      }

      if (msg.role === "tool") {
        const toolPart = {
          functionResponse: {
            name: msg.name || "tool",
            response: {
              name: msg.name || "tool",
              output: msg.content,
            },
          },
        };

        const lastContent = contents[contents.length - 1];
        if (lastContent && lastContent.role === "user" && lastContent.parts.some((p) => "functionResponse" in p)) {
          lastContent.parts.push(toolPart);
        } else {
          contents.push({
            role: "user",
            parts: [toolPart],
          });
        }
      } else if (msg.role === "user") {
        contents.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
      } else if (msg.role === "assistant") {
        const parts: Array<Record<string, unknown>> = [];
        if (msg.content && msg.content.trim().length > 0) {
          parts.push({ text: msg.content });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            parts.push({
              functionCall: {
                name: tc.name,
                args: tc.arguments || {},
              },
            });
          }
        }
        if (parts.length === 0) {
          parts.push({ text: "" });
        }
        contents.push({
          role: "model",
          parts,
        });
      }
    }

    // Format tools for Gemini functionDeclarations
    const functionDeclarations = options?.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    const body: Record<string, unknown> = {
      contents,
    };

    if (options?.systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: options.systemPrompt }],
      };
    }

    if (typeof options?.temperature === "number") {
      body.generationConfig = {
        temperature: options.temperature,
        maxOutputTokens: options?.maxTokens || 4096,
      };
    }

    if (functionDeclarations && functionDeclarations.length > 0) {
      body.tools = [{ functionDeclarations }];
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (options?.timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    }

    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => controller.abort());
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new LLMError(`Gemini API error (${res.status}): ${errorText}`, this.name, "API_ERROR");
      }

      const data = await res.json();
      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];

      let textContent = "";
      const toolCalls: LLMToolCall[] = [];

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.text) {
          textContent += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_gemini_${Date.now()}_${i}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args || {},
          });
        }
      }

      const promptTokens = data.usageMetadata?.promptTokenCount || 0;
      const completionTokens = data.usageMetadata?.candidatesTokenCount || 0;
      const totalTokens = data.usageMetadata?.totalTokenCount || promptTokens + completionTokens;

      const finishReason =
        toolCalls.length > 0
          ? "tool_calls"
          : candidate?.finishReason === "MAX_TOKENS"
          ? "length"
          : "stop";

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        finishReason,
        provider: this.name,
        model,
        costUsd: estimateCostUsd(model, promptTokens, completionTokens),
      };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return {
          content: "",
          tokens: { prompt: 0, completion: 0, total: 0 },
          finishReason: "aborted",
          provider: this.name,
          model,
        };
      }
      if (err instanceof LLMError) throw err;
      throw new LLMError(err instanceof Error ? err.message : String(err), this.name, "REQUEST_FAILED");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async stream(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
    onChunk?: (chunk: string) => void
  ): Promise<LLMGenerateResult> {
    const result = await this.generate(messages, options);
    if (result.content && onChunk) {
      onChunk(result.content);
    }
    return result;
  }
}

/**
 * Anthropic Messages API Provider with native tool calling
 */
export class AnthropicLLMProvider implements LLMProvider {
  public readonly name = "anthropic-llm-provider";
  private apiKey?: string;
  private defaultModel: string;

  constructor(apiKey?: string, defaultModel: string = "claude-3-5-sonnet-20241022") {
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || process.env.LLM_API_KEY;
    this.defaultModel = process.env.LLM_MODEL || defaultModel;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new LLMError("Anthropic API key is not configured.", this.name, "MISSING_API_KEY");
    }

    if (options?.abortSignal?.aborted) {
      return {
        content: "",
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: "aborted",
        provider: this.name,
        model: options?.model || this.defaultModel,
      };
    }

    const model = options?.model || this.defaultModel;
    const systemPrompt = options?.systemPrompt;

    // Convert messages to Anthropic format
    const anthropicMessages: Array<{ role: "user" | "assistant"; content: unknown }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        // Handled via top-level system parameter
        continue;
      }

      if (msg.role === "tool") {
        anthropicMessages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId || "unknown",
              content: msg.content,
            },
          ],
        });
      } else if (msg.role === "user") {
        anthropicMessages.push({
          role: "user",
          content: msg.content,
        });
      } else if (msg.role === "assistant") {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const contentBlocks: Array<Record<string, unknown>> = [];
          if (msg.content && msg.content.trim().length > 0) {
            contentBlocks.push({ type: "text", text: msg.content });
          }
          for (const tc of msg.toolCalls) {
            contentBlocks.push({
              type: "tool_use",
              id: tc.id,
              name: tc.name,
              input: tc.arguments || {},
            });
          }
          anthropicMessages.push({
            role: "assistant",
            content: contentBlocks,
          });
        } else {
          anthropicMessages.push({
            role: "assistant",
            content: msg.content,
          });
        }
      }
    }

    // Format tools for Anthropic
    const anthropicTools = options?.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens || 4096,
      messages: anthropicMessages,
    };

    if (systemPrompt) {
      body.system = systemPrompt;
    }

    if (typeof options?.temperature === "number") {
      body.temperature = options.temperature;
    }

    if (anthropicTools && anthropicTools.length > 0) {
      body.tools = anthropicTools;
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (options?.timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    }

    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => controller.abort());
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new LLMError(`Anthropic API error (${res.status}): ${errorText}`, this.name, "API_ERROR");
      }

      const data = await res.json();

      let textContent = "";
      const toolCalls: LLMToolCall[] = [];

      for (const block of data.content || []) {
        if (block.type === "text") {
          textContent += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: (block.input as Record<string, unknown>) || {},
          });
        }
      }

      const promptTokens = data.usage?.input_tokens || 0;
      const completionTokens = data.usage?.output_tokens || 0;
      const totalTokens = promptTokens + completionTokens;

      const finishReason =
        data.stop_reason === "tool_use"
          ? "tool_calls"
          : data.stop_reason === "max_tokens"
          ? "length"
          : "stop";

      return {
        content: textContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        finishReason,
        provider: this.name,
        model,
        costUsd: estimateCostUsd(model, promptTokens, completionTokens),
      };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return {
          content: "",
          tokens: { prompt: 0, completion: 0, total: 0 },
          finishReason: "aborted",
          provider: this.name,
          model,
        };
      }
      if (err instanceof LLMError) throw err;
      throw new LLMError(err instanceof Error ? err.message : String(err), this.name, "REQUEST_FAILED");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async stream(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
    onChunk?: (chunk: string) => void
  ): Promise<LLMGenerateResult> {
    // For non-streaming fallback or single response
    const result = await this.generate(messages, options);
    if (result.content && onChunk) {
      onChunk(result.content);
    }
    return result;
  }
}

/**
 * OpenAI Provider with standard function calling
 */
export class OpenAILLMProvider implements LLMProvider {
  public readonly name = "openai-llm-provider";
  private apiKey?: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(
    apiKey?: string,
    defaultModel: string = "gpt-4o",
    baseUrl: string = "https://api.openai.com/v1"
  ) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || process.env.LLM_API_KEY;
    this.defaultModel = process.env.LLM_MODEL || defaultModel;
    this.baseUrl = baseUrl;
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new LLMError("OpenAI API key is not configured.", this.name, "MISSING_API_KEY");
    }

    if (options?.abortSignal?.aborted) {
      return {
        content: "",
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: "aborted",
        provider: this.name,
        model: options?.model || this.defaultModel,
      };
    }

    const model = options?.model || this.defaultModel;

    const openAiMessages: Array<Record<string, unknown>> = [];
    if (options?.systemPrompt) {
      openAiMessages.push({ role: "system", content: options.systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === "tool") {
        openAiMessages.push({
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: msg.content,
        });
      } else if (msg.role === "assistant") {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          openAiMessages.push({
            role: "assistant",
            content: msg.content || null,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.arguments || {}),
              },
            })),
          });
        } else {
          openAiMessages.push({
            role: "assistant",
            content: msg.content,
          });
        }
      } else {
        openAiMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    const openAiTools = options?.tools?.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    const body: Record<string, unknown> = {
      model,
      messages: openAiMessages,
    };

    if (typeof options?.temperature === "number") {
      body.temperature = options.temperature;
    }
    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }
    if (openAiTools && openAiTools.length > 0) {
      body.tools = openAiTools;
    }

    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (options?.timeoutMs) {
      timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    }

    if (options?.abortSignal) {
      options.abortSignal.addEventListener("abort", () => controller.abort());
    }

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new LLMError(`OpenAI API error (${res.status}): ${errorText}`, this.name, "API_ERROR");
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const message = choice?.message;

      const toolCalls: LLMToolCall[] = [];
      if (message?.tool_calls) {
        for (const tc of message.tool_calls) {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {
            args = {};
          }
          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: args,
          });
        }
      }

      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;

      const finishReason =
        choice?.finish_reason === "tool_calls"
          ? "tool_calls"
          : choice?.finish_reason === "length"
          ? "length"
          : "stop";

      return {
        content: message?.content || "",
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: totalTokens,
        },
        finishReason,
        provider: this.name,
        model,
        costUsd: estimateCostUsd(model, promptTokens, completionTokens),
      };
    } catch (err: unknown) {
      if (controller.signal.aborted) {
        return {
          content: "",
          tokens: { prompt: 0, completion: 0, total: 0 },
          finishReason: "aborted",
          provider: this.name,
          model,
        };
      }
      if (err instanceof LLMError) throw err;
      throw new LLMError(err instanceof Error ? err.message : String(err), this.name, "REQUEST_FAILED");
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async stream(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
    onChunk?: (chunk: string) => void
  ): Promise<LLMGenerateResult> {
    const result = await this.generate(messages, options);
    if (result.content && onChunk) {
      onChunk(result.content);
    }
    return result;
  }
}

/**
 * Scriptable Mock LLM Provider for deterministic unit testing
 */
export class MockLLMProvider implements LLMProvider {
  public readonly name = "mock-llm-provider";
  private responseQueue: LLMGenerateResult[] = [];
  public callHistory: Array<{ messages: LLMMessage[]; options?: LLMGenerateOptions }> = [];

  constructor(responses?: Array<LLMGenerateResult | string>) {
    if (responses) {
      this.responseQueue = responses.map((r) => this.normalizeResponse(r));
    }
  }

  private normalizeResponse(resp: LLMGenerateResult | string): LLMGenerateResult {
    if (typeof resp === "string") {
      return {
        content: resp,
        tokens: { prompt: 50, completion: 50, total: 100 },
        finishReason: "stop",
        provider: this.name,
        model: "mock-v1",
        costUsd: 0.0001,
      };
    }
    return {
      ...resp,
      tokens: resp.tokens || { prompt: 50, completion: 50, total: 100 },
    };
  }

  /**
   * Queue a scripted response for testing multi-turn agent execution
   */
  public enqueueResponse(response: LLMGenerateResult | string) {
    this.responseQueue.push(this.normalizeResponse(response));
  }

  public clearQueue() {
    this.responseQueue = [];
    this.callHistory = [];
  }

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
    this.callHistory.push({ messages: [...messages], options });

    if (options?.abortSignal?.aborted) {
      return {
        content: "",
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: "aborted",
        provider: this.name,
        model: options?.model ?? "mock-v1",
      };
    }

    if (this.responseQueue.length > 0) {
      return this.responseQueue.shift()!;
    }

    // Default mock response: inspect messages to determine helpful deterministic response
    const lastMsg = messages[messages.length - 1];

    if (lastMsg?.role === "tool") {
      return {
        content: `I have reviewed the tool result. The execution completed successfully: "${lastMsg.content.slice(0, 60)}"`,
        tokens: { prompt: 100, completion: 30, total: 130 },
        finishReason: "stop",
        provider: this.name,
        model: options?.model ?? "mock-v1",
        costUsd: 0.0001,
      };
    }

    // Default first turn response with hello.ts tool calls if no script was queued
    return {
      content: "I will create hello.ts and execute it.",
      toolCalls: [
        {
          id: "call_mock_1",
          name: "writeFile",
          arguments: {
            path: "hello.ts",
            content: 'console.log("LEGION ONLINE");\n',
          },
        },
      ],
      tokens: { prompt: 150, completion: 50, total: 200 },
      finishReason: "tool_calls",
      provider: this.name,
      model: options?.model ?? "mock-v1",
      costUsd: 0.0002,
    };
  }

  async stream(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
    onChunk?: (chunk: string) => void
  ): Promise<LLMGenerateResult> {
    const result = await this.generate(messages, options);
    if (result.content && onChunk) {
      onChunk(result.content);
    }
    return result;
  }
}
