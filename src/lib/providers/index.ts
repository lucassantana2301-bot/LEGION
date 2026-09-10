import { SandboxProvider, MockSandboxProvider } from "./sandbox";
import { E2BSandboxProvider } from "./e2b-sandbox";
import {
  LLMProvider,
  MockLLMProvider,
  AnthropicLLMProvider,
  OpenAILLMProvider,
  GoogleGeminiLLMProvider,
} from "./llm";

export * from "./llm";
export * from "./sandbox";
export * from "./e2b-sandbox";
export * from "./git";
export * from "./deployment";

/**
 * Returns the active SandboxProvider based on environment configuration.
 * Falls back safely to MockSandboxProvider when no external API key is present.
 */
export function getSandboxProvider(): SandboxProvider {
  const providerType = process.env.SANDBOX_PROVIDER?.toLowerCase();
  const hasE2BKey = Boolean(process.env.E2B_API_KEY && process.env.E2B_API_KEY.trim().length > 0);

  if ((providerType === "e2b" || providerType === "real") && hasE2BKey) {
    return new E2BSandboxProvider();
  }

  return new MockSandboxProvider();
}

/**
 * Returns the active LLMProvider based on environment configuration.
 * Falls back safely to MockLLMProvider for deterministic tests and offline dev.
 */
export function getLLMProvider(): LLMProvider {
  const providerType = process.env.LLM_PROVIDER?.toLowerCase();
  const hasGeminiKey = Boolean(
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0) ||
      (process.env.GOOGLE_API_KEY && process.env.GOOGLE_API_KEY.trim().length > 0)
  );
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim().length > 0);
  const hasOpenAIKey = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
  const hasGenericLLMKey = Boolean(process.env.LLM_API_KEY && process.env.LLM_API_KEY.trim().length > 0);

  if (providerType === "google" || providerType === "gemini" || (hasGeminiKey && providerType !== "anthropic" && providerType !== "openai" && providerType !== "mock")) {
    return new GoogleGeminiLLMProvider();
  }

  if (providerType === "anthropic" || (hasAnthropicKey && providerType !== "openai" && providerType !== "google" && providerType !== "gemini" && providerType !== "mock")) {
    return new AnthropicLLMProvider();
  }

  if (providerType === "openai" || (hasOpenAIKey && providerType !== "anthropic" && providerType !== "google" && providerType !== "gemini" && providerType !== "mock")) {
    return new OpenAILLMProvider();
  }

  if (hasGenericLLMKey) {
    if (providerType === "google" || providerType === "gemini") return new GoogleGeminiLLMProvider();
    if (providerType === "openai") return new OpenAILLMProvider();
    return new AnthropicLLMProvider();
  }

  return new MockLLMProvider();
}


