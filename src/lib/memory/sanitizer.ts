// LEGION Phase 09.5 — Global Secret Sanitizer Boundary
// Detects and redacts API keys, credentials, tokens, private keys, database connection strings, and sensitive env variables.

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp; replacement: string }> = [
  // Google Gemini API keys
  {
    name: "GOOGLE_API_KEY",
    pattern: /AIza[0-9A-Za-z-_]{20,}/g,
    replacement: "[REDACTED_API_KEY]",
  },
  // Anthropic API keys
  {
    name: "ANTHROPIC_API_KEY",
    pattern: /sk-ant-[a-zA-Z0-9_-]{10,}/g,
    replacement: "[REDACTED_API_KEY]",
  },
  // OpenAI Project API keys
  {
    name: "OPENAI_PROJ_API_KEY",
    pattern: /sk-proj-[a-zA-Z0-9_-]{10,}/g,
    replacement: "[REDACTED_API_KEY]",
  },
  // Generic OpenAI / standard sk- API keys
  {
    name: "OPENAI_API_KEY",
    pattern: /sk-[a-zA-Z0-9_-]{20,}/g,
    replacement: "[REDACTED_API_KEY]",
  },
  // E2B API keys
  {
    name: "E2B_API_KEY",
    pattern: /e2b_[a-zA-Z0-9_-]{10,}/g,
    replacement: "[REDACTED_SECRET]",
  },
  // GitHub / GitLab Personal Access Tokens
  {
    name: "GIT_TOKEN",
    pattern: /(?:ghp_[a-zA-Z0-9]{20,}|glpat-[a-zA-Z0-9_-]{20,})/g,
    replacement: "[REDACTED_TOKEN]",
  },
  // Authorization Headers (Bearer)
  {
    name: "BEARER_TOKEN",
    pattern: /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi,
    replacement: "[REDACTED_BEARER_TOKEN]",
  },
  // Authorization Headers (Basic)
  {
    name: "BASIC_AUTH",
    pattern: /Basic\s+[A-Za-z0-9+/=]{10,}/gi,
    replacement: "[REDACTED_AUTH]",
  },
  // Private Keys (RSA, EC, PGP, OpenSSH, Generic)
  {
    name: "PRIVATE_KEY",
    pattern: /-----BEGIN\s+(?:[A-Z\s]+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:[A-Z\s]+)?PRIVATE\s+KEY-----/gi,
    replacement: "[REDACTED_PRIVATE_KEY]",
  },
  // Database / Redis / Message Queue URLs with credentials (e.g. postgres://user:password@host)
  {
    name: "DATABASE_URL_CREDENTIALS",
    pattern: /((?:postgres|postgresql|mysql|mongodb|redis|amqp|http|https):\/\/[^:\s]+:)([^@\s]+)(@[^\s]+)/gi,
    replacement: "$1[REDACTED_SECRET]$3",
  },
  // Key/Value credentials in configs, JSON, or .env files
  {
    name: "KEY_VALUE_SECRET",
    pattern: /(password|secret|apiKey|api_key|token|access_token|private_key|database_url|db_url|db_password|client_secret)\s*[:=]\s*["']?([a-zA-Z0-9_\-.~@!#$%^&*+=/:]{6,})["']?/gi,
    replacement: "$1=[REDACTED_SECRET]",
  },
];

/**
 * Sanitizes any raw string by replacing detected secrets and credentials with safe placeholders
 */
export function sanitizeMemoryContent(content: string): string {
  if (!content || typeof content !== "string") {
    return content as unknown as string;
  }

  let sanitized = content;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }

  return sanitized;
}

export const sanitizeSecrets = sanitizeMemoryContent;

/**
 * Universal recursive sanitizer for any data structure (objects, arrays, strings, errors)
 */
export function sanitizeValue<T>(val: T): T {
  if (typeof val === "string") {
    return sanitizeMemoryContent(val) as unknown as T;
  }

  if (val === null || val === undefined || typeof val !== "object") {
    return val;
  }

  if (val instanceof Error) {
    const cloned = new Error(sanitizeMemoryContent(val.message));
    cloned.name = val.name;
    cloned.stack = val.stack ? sanitizeMemoryContent(val.stack) : undefined;
    return cloned as unknown as T;
  }

  if (Array.isArray(val)) {
    return val.map((item) => sanitizeValue(item)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(val as Record<string, unknown>)) {
    result[key] = sanitizeValue(value);
  }

  return result as T;
}

/**
 * Recursively sanitizes strings inside objects or metadata dictionaries
 */
export function sanitizeMemoryMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object") {
    return metadata;
  }
  return sanitizeValue(metadata);
}
