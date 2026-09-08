import { SandboxProvider, MockSandboxProvider } from "./sandbox";
import { E2BSandboxProvider } from "./e2b-sandbox";

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
