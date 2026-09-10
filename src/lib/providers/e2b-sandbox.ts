import {
  SandboxProvider,
  SandboxInstance,
  SandboxExecutionResult,
  SandboxFileEntry,
  SandboxResourceLimits,
  SandboxExecuteOptions,
  resolveSandboxPath,
  registerTrustedRealSandboxProvider,
} from "./sandbox";
import {
  SandboxError,
  SandboxTimeoutError,
  SandboxUnavailableError,
  SandboxExecutionError,
} from "../sandbox/errors";
import { getExecutionLimits } from "../config/limits";
import { Sandbox as E2BSandbox } from "@e2b/code-interpreter";

export class E2BSandboxProvider implements SandboxProvider {
  public readonly name = "e2b-sandbox-provider";
  public readonly executionMode = "REAL" as const;
  private readonly defaultRoot = "/home/user";
  private sandboxes: Map<string, E2BSandbox> = new Map();

  constructor() {
    registerTrustedRealSandboxProvider(this);
  }

  private sanitizeErrorMessage(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    const apiKey = process.env.E2B_API_KEY;
    if (apiKey && apiKey.length > 4) {
      return raw.replace(new RegExp(apiKey, "g"), "[REDACTED_API_KEY]");
    }
    return raw;
  }

  async create(env?: Record<string, string>, _limits?: SandboxResourceLimits): Promise<SandboxInstance> {
    const apiKey = process.env.E2B_API_KEY;
    if (!apiKey || apiKey.trim().length === 0) {
      throw new SandboxUnavailableError(
        "E2B Sandbox Provider requires E2B_API_KEY to be set in environment variables."
      );
    }

    const limits = getExecutionLimits();
    try {
      const sbx = await E2BSandbox.create({
        apiKey,
        envs: env,
        timeoutMs: limits.sandboxTimeoutMs * 2, // Sandbox total lifetime
      });

      const instance: SandboxInstance = {
        id: sbx.sandboxId,
        status: "RUNNING",
        createdAt: new Date().toISOString(),
        provider: "E2B",
      };

      this.sandboxes.set(sbx.sandboxId, sbx);
      return instance;
    } catch (err: unknown) {
      const sanitized = this.sanitizeErrorMessage(err);
      if (sanitized.toLowerCase().includes("timeout")) {
        throw new SandboxTimeoutError(`Failed to create E2B sandbox: ${sanitized}`, limits.sandboxTimeoutMs);
      }
      throw new SandboxUnavailableError(`E2B sandbox creation failed: ${sanitized}`);
    }
  }

  async execute(
    sandboxId: string,
    command: string,
    onOutput?: (stream: "stdout" | "stderr", text: string) => void,
    timeoutMs?: number,
    signal?: AbortSignal,
    options?: SandboxExecuteOptions
  ): Promise<SandboxExecutionResult> {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx) {
      throw new SandboxUnavailableError(`E2B sandbox instance "${sandboxId}" not found or already closed.`);
    }

    if (signal?.aborted) {
      throw new SandboxError("Execution cancelled before start.", "EXECUTION_CANCELLED");
    }

    const limits = getExecutionLimits();
    const effectiveTimeout = timeoutMs || options?.timeoutMs || limits.sandboxTimeoutMs;
    const effectiveCwd = options?.cwd && options.cwd !== "."
      ? resolveSandboxPath(this.defaultRoot, options.cwd)
      : this.defaultRoot;
    const startTime = Date.now();

    let totalBytes = 0;
    let truncated = false;
    let stdoutAcc = "";
    let stderrAcc = "";

    const handleChunk = (stream: "stdout" | "stderr", chunk: string) => {
      const chunkBytes = Buffer.byteLength(chunk, "utf-8");
      if (totalBytes + chunkBytes > limits.maxOutputBytes) {
        if (!truncated) {
          truncated = true;
          const warning = "\n[SYSTEM] Output truncated by LEGION safety limit.\n";
          if (onOutput) onOutput("stderr", warning);
          stderrAcc += warning;
        }
        return;
      }

      totalBytes += chunkBytes;
      if (stream === "stdout") {
        stdoutAcc += chunk;
      } else {
        stderrAcc += chunk;
      }

      if (onOutput) {
        onOutput(stream, chunk);
      }
    };

    try {
      const abortPromise = new Promise<never>((_, reject) => {
        if (!signal) return;
        signal.addEventListener("abort", async () => {
          try {
            // Actively terminate running processes in remote sandbox
            await sbx.commands.run("pkill -9 -f node || pkill -9 -f python || true", { timeoutMs: 3_000 }).catch(() => {});
          } catch {
            // ignore
          }
          reject(new SandboxError("Execution cancelled by user.", "EXECUTION_CANCELLED"));
        }, { once: true });
      });

      const execPromise = sbx.commands.run(command, {
        cwd: effectiveCwd,
        onStdout: (chunk) => handleChunk("stdout", chunk),
        onStderr: (chunk) => handleChunk("stderr", chunk),
        timeoutMs: effectiveTimeout,
      });

      const result = await Promise.race([execPromise, abortPromise]);
      const durationMs = Date.now() - startTime;

      return {
        exitCode: result.exitCode ?? 0,
        stdout: stdoutAcc || result.stdout || "",
        stderr: stderrAcc || result.stderr || "",
        durationMs,
        truncated,
      };
    } catch (err: unknown) {
      const sanitized = this.sanitizeErrorMessage(err);
      if (err instanceof SandboxError) {
        throw err;
      }
      if (sanitized.toLowerCase().includes("timeout")) {
        throw new SandboxTimeoutError(`Execution timed out after ${effectiveTimeout}ms.`, effectiveTimeout);
      }
      throw new SandboxExecutionError(`Execution failed: ${sanitized}`);
    }
  }

  async readFile(sandboxId: string, filePath: string): Promise<string> {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx) {
      throw new SandboxUnavailableError(`E2B sandbox instance "${sandboxId}" not found.`);
    }

    const safePath = resolveSandboxPath(this.defaultRoot, filePath);
    try {
      return await sbx.files.read(safePath);
    } catch (err: unknown) {
      throw new SandboxError(`Failed to read file "${safePath}": ${this.sanitizeErrorMessage(err)}`);
    }
  }

  async writeFile(sandboxId: string, filePath: string, content: string): Promise<void> {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx) {
      throw new SandboxUnavailableError(`E2B sandbox instance "${sandboxId}" not found.`);
    }

    const safePath = resolveSandboxPath(this.defaultRoot, filePath);
    try {
      await sbx.files.write(safePath, content);
    } catch (err: unknown) {
      throw new SandboxError(`Failed to write file "${safePath}": ${this.sanitizeErrorMessage(err)}`);
    }
  }

  async deleteFile(sandboxId: string, filePath: string): Promise<void> {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx) {
      throw new SandboxUnavailableError(`E2B sandbox instance "${sandboxId}" not found.`);
    }

    const safePath = resolveSandboxPath(this.defaultRoot, filePath);
    try {
      await sbx.files.remove(safePath);
    } catch (err: unknown) {
      const sanitized = this.sanitizeErrorMessage(err);
      if (!sanitized.toLowerCase().includes("not found") && !sanitized.toLowerCase().includes("no such file")) {
        throw new SandboxError(`Failed to delete file "${safePath}": ${sanitized}`);
      }
    }
  }

  async listFiles(sandboxId: string, directoryPath: string): Promise<SandboxFileEntry[]> {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx) {
      throw new SandboxUnavailableError(`E2B sandbox instance "${sandboxId}" not found.`);
    }

    const safeDir = resolveSandboxPath(this.defaultRoot, directoryPath);
    try {
      const fileList = await sbx.files.list(safeDir);
      return fileList.map((entry) => ({
        path: `${safeDir}/${entry.name}`.replace(/\/+/g, "/"),
        isDirectory: entry.type === "dir",
        sizeBytes: 0,
        updatedAt: new Date().toISOString(),
      }));
    } catch (err: unknown) {
      throw new SandboxError(`Failed to list files in "${safeDir}": ${this.sanitizeErrorMessage(err)}`);
    }
  }

  async destroy(sandboxId: string): Promise<void> {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx) return;
    try {
      await sbx.kill();
    } catch (err: unknown) {
      const sanitized = this.sanitizeErrorMessage(err);
      throw new SandboxError(`E2B sandbox destroy failed for container "${sandboxId}": ${sanitized}`);
    } finally {
      this.sandboxes.delete(sandboxId);
    }
  }
}
