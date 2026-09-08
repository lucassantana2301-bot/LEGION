// Isolated Sandbox Execution Provider Abstraction

import { SandboxPathError, SandboxTimeoutError, SandboxUnavailableError } from "../sandbox/errors";
import { getExecutionLimits } from "../config/limits";

export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated?: boolean;
}

export interface SandboxFileEntry {
  path: string;
  isDirectory: boolean;
  sizeBytes: number;
  updatedAt: string;
}

export interface SandboxInstance {
  id: string;
  status: "STARTING" | "RUNNING" | "STOPPED" | "TERMINATED";
  createdAt: string;
  provider: string;
}

export interface SandboxResourceLimits {
  cpuCores?: number;
  memoryMb?: number;
  diskMb?: number;
}

export interface SandboxProvider {
  name: string;
  create(env?: Record<string, string>, limits?: SandboxResourceLimits): Promise<SandboxInstance>;
  execute(
    sandboxId: string,
    command: string,
    onOutput?: (stream: "stdout" | "stderr", text: string) => void,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<SandboxExecutionResult>;
  readFile(sandboxId: string, filePath: string): Promise<string>;
  writeFile(sandboxId: string, filePath: string, content: string): Promise<void>;
  listFiles(sandboxId: string, directoryPath: string): Promise<SandboxFileEntry[]>;
  destroy(sandboxId: string): Promise<void>;
}

/**
 * Resolves a sandbox-relative path against a virtual root and throws SandboxPathError
 * if the result would escape that root (e.g. "../../etc/passwd").
 */
export function resolveSandboxPath(root: string, requestedPath: string): string {
  if (!requestedPath || typeof requestedPath !== "string") {
    throw new SandboxPathError("Requested path must be a non-empty string.", requestedPath || "");
  }

  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRequested = requestedPath.replace(/\\/g, "/");

  // Prevent absolute paths escaping the root if they don't start with root
  let combined: string;
  if (normalizedRequested.startsWith("/")) {
    if (!normalizedRequested.startsWith(normalizedRoot)) {
      combined = `${normalizedRoot}${normalizedRequested}`;
    } else {
      combined = normalizedRequested;
    }
  } else {
    combined = `${normalizedRoot}/${normalizedRequested}`;
  }

  const segments: string[] = [];
  for (const segment of combined.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) {
        throw new SandboxPathError(
          `Path traversal rejected: "${requestedPath}" escapes sandbox root.`,
          requestedPath
        );
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const resolved = "/" + segments.join("/");
  if (!resolved.startsWith(normalizedRoot)) {
    throw new SandboxPathError(
      `Path traversal rejected: "${requestedPath}" escapes sandbox root.`,
      requestedPath
    );
  }
  return resolved;
}

/**
 * Mock Sandbox Provider for development, testing, and fallback when no external API key is present
 */
export class MockSandboxProvider implements SandboxProvider {
  name = "mock-sandbox-provider";
  private readonly root = "/workspace";
  private virtualFiles: Map<string, string> = new Map();
  private activeSandboxes: Map<string, SandboxInstance> = new Map();

  async create(_env?: Record<string, string>, _limits?: SandboxResourceLimits): Promise<SandboxInstance> {
    const id = `mock_sbx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const instance: SandboxInstance = {
      id,
      status: "RUNNING",
      createdAt: new Date().toISOString(),
      provider: "MOCK",
    };
    this.activeSandboxes.set(id, instance);
    return instance;
  }

  async execute(
    sandboxId: string,
    command: string,
    onOutput?: (stream: "stdout" | "stderr", text: string) => void,
    timeoutMs?: number,
    signal?: AbortSignal
  ): Promise<SandboxExecutionResult> {
    if (!this.activeSandboxes.has(sandboxId)) {
      throw new SandboxUnavailableError(`Sandbox "${sandboxId}" not found or already destroyed.`);
    }

    if (signal?.aborted) {
      throw new Error("Execution cancelled by signal.");
    }

    const limits = getExecutionLimits();
    const effectiveTimeout = timeoutMs || limits.sandboxTimeoutMs;
    const startTime = Date.now();

    // Check for simulated command outputs
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    const trimmed = command.trim();
    if (trimmed === "node --version" || trimmed === "node -v") {
      stdout = "v20.18.0\n";
    } else if (trimmed === "npm --version" || trimmed === "npm -v") {
      stdout = "10.8.2\n";
    } else if (trimmed.startsWith("echo ")) {
      stdout = trimmed.slice(5).replace(/^['"]|['"]$/g, "") + "\n";
    } else if (trimmed === "pwd") {
      stdout = "/workspace\n";
    } else if (trimmed === "whoami") {
      stdout = "user\n";
    } else if (trimmed === "date") {
      stdout = new Date().toUTCString() + "\n";
    } else if (trimmed === "uname -a") {
      stdout = "Linux legion-sandbox 6.1.0 #1 SMP x86_64 GNU/Linux\n";
    } else if (trimmed === "ls" || trimmed === "ls -la" || trimmed === "ls -l") {
      const files = Array.from(this.virtualFiles.keys());
      stdout = files.length > 0 ? files.map((f) => f.replace(/^\/workspace\/?/, "")).join("\n") + "\n" : "total 0\n";
    } else {
      stdout = `[Mock Sandbox] Executed: ${trimmed}\n`;
    }

    if (onOutput) {
      if (stdout) onOutput("stdout", stdout);
      if (stderr) onOutput("stderr", stderr);
    }

    const durationMs = Date.now() - startTime;
    return {
      exitCode,
      stdout,
      stderr,
      durationMs,
      truncated: false,
    };
  }

  async readFile(sandboxId: string, filePath: string): Promise<string> {
    if (!this.activeSandboxes.has(sandboxId)) {
      throw new SandboxUnavailableError(`Sandbox "${sandboxId}" not found.`);
    }
    const safePath = resolveSandboxPath(this.root, filePath);
    const content = this.virtualFiles.get(safePath);
    if (content === undefined) {
      throw new Error(`File not found: ${filePath}`);
    }
    return content;
  }

  async writeFile(sandboxId: string, filePath: string, content: string): Promise<void> {
    if (!this.activeSandboxes.has(sandboxId)) {
      throw new SandboxUnavailableError(`Sandbox "${sandboxId}" not found.`);
    }
    const safePath = resolveSandboxPath(this.root, filePath);
    this.virtualFiles.set(safePath, content);
  }

  async listFiles(sandboxId: string, directoryPath: string): Promise<SandboxFileEntry[]> {
    if (!this.activeSandboxes.has(sandboxId)) {
      throw new SandboxUnavailableError(`Sandbox "${sandboxId}" not found.`);
    }
    const safeDir = resolveSandboxPath(this.root, directoryPath);
    const entries: SandboxFileEntry[] = [];
    for (const [path, content] of this.virtualFiles.entries()) {
      if (path.startsWith(safeDir)) {
        entries.push({
          path,
          isDirectory: false,
          sizeBytes: Buffer.byteLength(content, "utf-8"),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    return entries;
  }

  async destroy(sandboxId: string): Promise<void> {
    this.activeSandboxes.delete(sandboxId);
    this.virtualFiles.clear();
  }
}
