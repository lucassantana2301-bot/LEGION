// Isolated Sandbox Execution Provider Abstraction

export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
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
    timeoutMs?: number
  ): Promise<SandboxExecutionResult>;
  readFile(sandboxId: string, filePath: string): Promise<string>;
  writeFile(sandboxId: string, filePath: string, content: string): Promise<void>;
  listFiles(sandboxId: string, directoryPath: string): Promise<SandboxFileEntry[]>;
  destroy(sandboxId: string): Promise<void>;
}

/**
 * Resolves a sandbox-relative path against a virtual root and throws if the
 * result would escape that root (e.g. "../../etc/passwd"). Every
 * SandboxProvider implementation must apply an equivalent containment check
 * before touching a real filesystem.
 */
export function resolveSandboxPath(root: string, requestedPath: string): string {
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/+$/, "");
  const combined = `${normalizedRoot}/${requestedPath.replace(/\\/g, "/")}`;

  const segments: string[] = [];
  for (const segment of combined.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) {
        throw new Error(`Path traversal rejected: "${requestedPath}" escapes sandbox root.`);
      }
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  const resolved = "/" + segments.join("/");
  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(`Path traversal rejected: "${requestedPath}" escapes sandbox root.`);
  }
  return resolved;
}

/**
 * Mock Sandbox Provider for development and deterministic testing
 */
export class MockSandboxProvider implements SandboxProvider {
  name = "mock-sandbox-provider";
  private readonly root = "/sandbox";
  private virtualFiles: Map<string, string> = new Map();

  async create(_env?: Record<string, string>, _limits?: SandboxResourceLimits): Promise<SandboxInstance> {
    return {
      id: `sandbox_${Date.now()}`,
      status: "RUNNING",
      createdAt: new Date().toISOString(),
    };
  }

  async execute(
    _sandboxId: string,
    command: string,
    onOutput?: (stream: "stdout" | "stderr", text: string) => void,
    _timeoutMs?: number
  ): Promise<SandboxExecutionResult> {
    onOutput?.("stdout", `> ${command}\nExecuting in mock sandbox...\nCompleted.`);
    return {
      exitCode: 0,
      stdout: `Mock execution of '${command}' succeeded.`,
      stderr: "",
      durationMs: 180,
    };
  }

  async readFile(_sandboxId: string, filePath: string): Promise<string> {
    const safePath = resolveSandboxPath(this.root, filePath);
    return this.virtualFiles.get(safePath) || `// Virtual file content for ${safePath}`;
  }

  async writeFile(_sandboxId: string, filePath: string, content: string): Promise<void> {
    const safePath = resolveSandboxPath(this.root, filePath);
    this.virtualFiles.set(safePath, content);
  }

  async listFiles(_sandboxId: string, _directoryPath: string): Promise<SandboxFileEntry[]> {
    return Array.from(this.virtualFiles.keys()).map((path) => ({
      path,
      isDirectory: false,
      sizeBytes: this.virtualFiles.get(path)?.length || 0,
      updatedAt: new Date().toISOString(),
    }));
  }

  async destroy(_sandboxId: string): Promise<void> {
    this.virtualFiles.clear();
  }
}
