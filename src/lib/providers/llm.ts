// LLM Provider Abstraction Interface

export interface LLMMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  toolCallId?: string;
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

/**
 * Mock LLM Provider for local development & deterministic testing
 */
export class MockLLMProvider implements LLMProvider {
  name = "mock-llm-provider";

  async generate(messages: LLMMessage[], options?: LLMGenerateOptions): Promise<LLMGenerateResult> {
    if (options?.abortSignal?.aborted) {
      return {
        content: "",
        tokens: { prompt: 0, completion: 0, total: 0 },
        finishReason: "aborted",
        provider: this.name,
        model: options?.model ?? "mock-v1",
      };
    }

    const lastMessage = messages[messages.length - 1]?.content || "";
    return {
      content: `[LEGION MOCK LLM]: Analyzed context. Prepared execution strategy for: "${lastMessage.slice(0, 80)}..."`,
      tokens: { prompt: 140, completion: 85, total: 225 },
      finishReason: "stop",
      provider: this.name,
      model: options?.model ?? "mock-v1",
      costUsd: 0,
    };
  }

  async stream(
    messages: LLMMessage[],
    options?: LLMGenerateOptions,
    onChunk?: (chunk: string) => void
  ): Promise<LLMGenerateResult> {
    const result = await this.generate(messages, options);
    onChunk?.(result.content);
    return result;
  }
}
