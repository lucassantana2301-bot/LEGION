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

export interface SandboxProvider {
  name: string;
  create(env?: Record<string, string>): Promise<SandboxInstance>;
  execute(
    sandboxId: string,
    command: string,
    onOutput?: (stream: "stdout" | "stderr", text: string) => void
  ): Promise<SandboxExecutionResult>;
  readFile(sandboxId: string, filePath: string): Promise<string>;
  writeFile(sandboxId: string, filePath: string, content: string): Promise<void>;
  listFiles(sandboxId: string, directoryPath: string): Promise<SandboxFileEntry[]>;
  destroy(sandboxId: string): Promise<void>;
}

/**
 * Mock Sandbox Provider for development and deterministic testing
 */
export class MockSandboxProvider implements SandboxProvider {
  name = "mock-sandbox-provider";
  private virtualFiles: Map<string, string> = new Map();

  async create(): Promise<SandboxInstance> {
    return {
      id: `sandbox_${Date.now()}`,
      status: "RUNNING",
      createdAt: new Date().toISOString(),
    };
  }

  async execute(
    _sandboxId: string,
    command: string,
    onOutput?: (stream: "stdout" | "stderr", text: string) => void
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
    return this.virtualFiles.get(filePath) || `// Virtual file content for ${filePath}`;
  }

  async writeFile(_sandboxId: string, filePath: string, content: string): Promise<void> {
    this.virtualFiles.set(filePath, content);
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
